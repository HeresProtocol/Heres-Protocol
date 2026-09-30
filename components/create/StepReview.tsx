'use client'

import { StepHead } from './CreateShell'
import { RECIPIENT_COLORS } from './useAssetCatalog'
import { IconLock, IconPencil, IconSpinner, fmtAmount, fmtUsd, maskAddr, trimNum } from './ui'

export type ReviewLine = { key: string; color: string; symbol: string; name: string; amount: number | null; usd: number | null }
export type ReviewRecipient = { name: string; address: string; detail: string }

function Edit({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="cf-edit" onClick={onClick} aria-label={`Edit ${label}`}>
      <IconPencil /> Edit
    </button>
  )
}

export function StepReview(props: {
  lines: ReviewLine[]
  totalUsd: number | null
  recipients: ReviewRecipient[]
  unallocatedPct: number
  triggerShort: string
  triggerLong: string
  intent: string
  email: string
  reminder: boolean
  feeSol: number
  isNft: boolean
  multiSign: boolean
  ack: boolean
  onAck: (v: boolean) => void
  pending: boolean
  progress: string | null
  error: string | null
  blocker: string | null
  onEdit: (step: 0 | 1 | 2) => void
  onBack: () => void
  onCreate: () => void
}) {
  const canCreate = props.ack && !props.pending && !props.blocker
  const assetsLabel = `${props.lines.length} ${props.isNft ? (props.lines.length === 1 ? 'NFT' : 'NFTs') : props.lines.length === 1 ? 'asset' : 'assets'}`
  const peopleLabel = `${props.recipients.length} ${props.recipients.length === 1 ? 'beneficiary' : 'beneficiaries'}`

  return (
    <div className="cf-body cf-body--review">
      <div className="cf-review">
        <div className="cf-review__main">
          <StepHead
            eyebrow="Step 4 of 4 — final step"
            title="Review your capsule"
            sub="Check everything below before you create it. You can edit any section, and cancel the whole capsule any time after it's created."
          />
          <div className="cf-review__left cf-scroll">
          <section className="cf-rcard" aria-labelledby="cf-r-assets">
            <div className="cf-rcard__h">
              <h2 id="cf-r-assets">Assets</h2>
              <Edit onClick={() => props.onEdit(0)} label="assets" />
            </div>
            {props.lines.map((l) => (
              <div key={l.key} className="cf-rline">
                <i style={{ background: l.color }} />
                <span style={{ minWidth: 0 }}>
                  <span className="cf-rline__sym">{l.symbol}</span>{' '}
                  <span className="cf-rline__name">{l.name}</span>
                </span>
                <span className="cf-rline__amt">
                  {props.isNft ? '1' : `${fmtAmount(l.amount)} ${l.symbol}`}
                  {!props.isNft && <small>{l.usd == null ? '—' : `≈ ${fmtUsd(l.usd)}`}</small>}
                </span>
              </div>
            ))}
            {!props.isNft && (
              <div className="cf-rtotal">
                <span>Total value</span>
                <strong>{fmtUsd(props.totalUsd)}</strong>
              </div>
            )}
            {props.unallocatedPct > 0 && (
              <p className="cf-rnote">{trimNum(props.unallocatedPct, 2)}% of each asset was left unallocated, so it stays in your wallet. Amounts above are what goes into the capsule.</p>
            )}
          </section>

          <section className="cf-rcard" aria-labelledby="cf-r-people">
            <div className="cf-rcard__h">
              <h2 id="cf-r-people">Beneficiaries</h2>
              <Edit onClick={() => props.onEdit(1)} label="beneficiaries" />
            </div>
            {props.recipients.map((r, i) => (
              <div key={r.address + i} className="cf-rperson">
                <span className="cf-avatar" style={{ background: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }} aria-hidden>
                  {(r.name.trim()[0] || 'N').toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="cf-rperson__name">{r.name.trim() || 'Unnamed'}</span>
                  <span className="cf-rperson__addr" title={r.address}>{maskAddr(r.address, 6, 6)}</span>
                </span>
                <strong>{r.detail}</strong>
              </div>
            ))}
          </section>

          <section className="cf-rcard" aria-labelledby="cf-r-trigger">
            <div className="cf-rcard__h">
              <h2 id="cf-r-trigger">Trigger</h2>
              <Edit onClick={() => props.onEdit(2)} label="trigger and note" />
            </div>
            <div className="cf-kv"><span>Trigger</span><strong>{props.triggerLong}</strong></div>
          </section>

          <section className="cf-rcard" aria-labelledby="cf-r-note">
            <div className="cf-rcard__h">
              <h2 id="cf-r-note">Note</h2>
              <Edit onClick={() => props.onEdit(2)} label="note" />
            </div>
            <p className="cf-quote">{props.intent.trim() || 'No note added.'}</p>
          </section>

          <section className="cf-rcard" aria-labelledby="cf-r-representative">
            <div className="cf-rcard__h">
              <h2 id="cf-r-representative">Representative</h2>
              <Edit onClick={() => props.onEdit(2)} label="representative" />
            </div>
            <div className="cf-kv"><span>Representative</span><strong>{props.email}</strong></div>
            <div className="cf-kv"><span>Reminder emails</span><strong>{props.reminder ? 'Monthly' : 'Off'}</strong></div>
          </section>
          </div>
        </div>

        <aside className="cf-summary" aria-label="Summary">
          <p className="cf-summary__label">Total in this capsule</p>
          <p className="cf-summary__total">{props.isNft ? assetsLabel : fmtUsd(props.totalUsd)}</p>
          <p className="cf-summary__sub">Across {assetsLabel}, {peopleLabel}</p>
          <div className="cf-summary__rule" />
          <div className="cf-kv"><span>Trigger</span><strong>{props.triggerShort}</strong></div>
          <div className="cf-kv"><span>Note</span><strong>{props.intent.trim() ? 'Added' : 'None'}</strong></div>
          <div className="cf-kv"><span>Representative</span><strong title={props.email}>{props.email.length > 22 ? `${props.email.slice(0, 20)}…` : props.email}</strong></div>
          <div className="cf-kv"><span>Creation fee</span><strong>{props.feeSol} SOL</strong></div>

          <p className="cf-warn">
            Once created, these assets move into your capsule and become <strong>inaccessible to you</strong> &mdash; no trading, staking, or spending &mdash; until it executes or you cancel it. Cancelling any time restores full access.
          </p>
          <label className="cf-ack">
            <input type="checkbox" className="cf-check" checked={props.ack} onChange={(e) => props.onAck(e.target.checked)} disabled={props.pending} />
            <span>I understand these assets will be locked until this capsule executes or I cancel it.</span>
          </label>
          {props.multiSign && !props.pending && !props.error && (
            <p className="cf-summary__sub" style={{ marginTop: 'calc(12 * var(--u))' }}>Your wallet will ask you to approve a few signatures to create the capsule.</p>
          )}
          {props.pending && (
            <p className="cf-progress" role="status"><IconSpinner /> {props.progress || 'Creating your capsule…'}</p>
          )}
          {(props.error || props.blocker) && !props.pending && (
            <p className="cf-alert" role="alert" style={{ marginTop: 'calc(12 * var(--u))' }}>{props.error || props.blocker}</p>
          )}
        </aside>
      </div>

      <footer className="cf-foot">
        <p className="cf-foot__note"><IconLock /> Beneficiary details and your note stay sealed until execution.</p>
        <div className="cf-foot__actions">
          <button type="button" className="cf-btn cf-btn--ghost" onClick={props.onBack} disabled={props.pending}>Back</button>
          <button type="button" className="cf-btn cf-btn--red" onClick={props.onCreate} disabled={!canCreate}>
            {props.pending ? <><IconSpinner /> Creating…</> : 'Create capsule'}
          </button>
        </div>
      </footer>
    </div>
  )
}
