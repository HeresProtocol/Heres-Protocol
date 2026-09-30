'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { HdIcon } from './icons'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  code: string
  valueText: string
  recipientsText: string
  /** Who loses their share, for the consequence line ("Sam", "Jake & Maria", "Your recipients"). */
  recipientsWho: string
  trigger: string
  hasNote: boolean
  /** The capsule still runs on the private rollup and must move back to Solana first. */
  needsPrepare: boolean
  /** Capsule state is still being read; hold the confirm button. */
  checking?: boolean
  preparing: boolean
  onPrepare: () => void
  /** Token accounts to recover one by one (each needs a wallet approval). */
  tokenAccounts: number
  deleting: boolean
  progress: string | null
  error: string | null
  onConfirm: () => void
}

/** "Delete this capsule?" — typed confirmation, with the honest extra step when it's still delegated. */
export function DeleteCapsuleDialog(props: Props) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const phrase = `DELETE ${props.code}`
  const matches = typed.trim().replace(/\s+/g, ' ').toUpperCase() === phrase
  const busy = props.deleting || props.preparing

  const onCloseRef = useRef(props.onClose)
  onCloseRef.current = props.onClose
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => {
    if (!props.open) return
    setTyped('')
    const prev = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => (props.needsPrepare ? dialogRef.current : inputRef.current)?.focus(), 60)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCloseRef.current()
      if (e.key !== 'Tab' || !dialogRef.current) return
      const f = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]')
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prev?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open])

  if (!props.open) return null

  return (
    <div className="hd-modal" role="presentation">
      <div className="hd-modal__backdrop" onClick={() => !busy && props.onClose()} aria-hidden />
      <div className="hd-modal__panel" role="alertdialog" aria-modal="true" aria-labelledby="hd-del-title" aria-describedby="hd-del-desc" ref={dialogRef} tabIndex={-1}>
        <span className="hd-modal__icon" aria-hidden><HdIcon.Alert /></span>
        <h2 id="hd-del-title">Delete this capsule?</h2>
        <p id="hd-del-desc" className="hd-modal__lead">
          This stops <strong>“{props.title}”</strong> and can’t be undone once confirmed — you’d need to set it up again from scratch.
        </p>

        <dl className="hd-modal__facts">
          <div><dt>Capsule</dt><dd>#{props.code}</dd></div>
          <div><dt>Value locked</dt><dd>{props.valueText}</dd></div>
          <div><dt>Recipients</dt><dd>{props.recipientsText}</dd></div>
          <div><dt>Trigger</dt><dd>{props.trigger}</dd></div>
        </dl>

        <ul className="hd-modal__effects">
          <li className="is-ok"><HdIcon.Check />Your assets are unsealed and returned to your wallet, fully usable again.</li>
          <li className="is-bad"><HdIcon.X />{props.recipientsWho} will no longer receive anything from this capsule. They are not notified.</li>
          <li className="is-bad"><HdIcon.X />The trigger{props.hasNote ? ' and the note you wrote are' : ' is'} permanently discarded.</li>
        </ul>

        {props.needsPrepare && (
          <div className="hd-modal__step">
            <p>
              <strong>First, move your capsule back to Solana.</strong> It currently runs on a private rollup and can only be deleted from Solana. Moving it makes the recipient addresses visible on-chain.
            </p>
            <button type="button" className="cf-btn cf-btn--pill" onClick={props.onPrepare} disabled={busy}>
              {props.preparing ? <><HdIcon.Spinner /> Moving to Solana…</> : 'Move to Solana'}
            </button>
          </div>
        )}

        {props.tokenAccounts > 1 && !props.needsPrepare && (
          <p className="hd-modal__hint">Your wallet will ask for {props.tokenAccounts} approvals — one for each token being returned.</p>
        )}

        <label className="hd-modal__label" htmlFor="hd-del-input">
          Type <strong>{phrase}</strong> to confirm.
        </label>
        <input
          id="hd-del-input"
          ref={inputRef}
          className="hd-modal__input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && matches && !busy && !props.needsPrepare) props.onConfirm() }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={busy || props.needsPrepare}
          aria-invalid={typed.length > 0 && !matches}
        />

        {props.checking && !busy && <p className="hd-modal__hint" role="status"><HdIcon.Spinner />Checking your capsule’s current state…</p>}
        {props.progress && busy && <p className="hd-modal__progress" role="status"><HdIcon.Spinner />{props.progress}</p>}
        {props.error && !busy && <p className="hd-modal__error" role="alert">{props.error}</p>}

        <div className="hd-modal__actions">
          <button type="button" className="cf-btn cf-btn--light" onClick={props.onClose} disabled={busy}>Keep capsule</button>
          <button type="button" className="cf-btn hd-btn-danger" onClick={props.onConfirm} disabled={!matches || busy || props.needsPrepare || props.checking}>
            {props.deleting ? <><HdIcon.Spinner /> Deleting…</> : 'Delete capsule'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Shown once the deletion transaction is confirmed. */
export function CapsuleDeleted({ title, code }: { title: string; code: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])
  return (
    <div className="cf-card hd-deleted" role="status" aria-live="polite">
      <span className="hd-deleted__icon" aria-hidden><HdIcon.Alert /></span>
      <h1 ref={heading} tabIndex={-1}>{title === 'Your capsule' ? 'Capsule deleted' : `“${title}” capsule deleted`}</h1>
      <p className="hd-deleted__code">Deleted #{code}</p>
      <p>Your assets have returned to your wallet.</p>
      <Link href="/dashboard" className="cf-btn cf-btn--light">Go to dashboard</Link>
    </div>
  )
}
