'use client'

import { useState } from 'react'
import { isValidSolanaAddress } from '@/config/solana'
import { StepHead } from './CreateShell'
import { RECIPIENT_COLORS, type CatalogAsset } from './useAssetCatalog'
import type { NftItem } from '@/hooks/useCreateCapsuleForm'
import { IconPlusSquare, IconX, maskAddr, trimNum } from './ui'

export type RecipientRow = { id: string; address: string; amount: string }
export type ShareUnit = 'all' | string // 'all' (USD) or an asset key

export const pctOf = (value: string) => {
  const n = parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Row-level problems, shared by the page's gate and the inline messages. */
export function recipientIssues(rows: { address: string; pct: number }[], owner: string) {
  const seen = new Set<string>()
  return rows.map((row) => {
    const addr = row.address.trim()
    if (!addr) return row.pct > 0 ? 'Add a Solana address for this share.' : null
    if (!isValidSolanaAddress(addr)) return 'Enter a valid Solana address.'
    if (addr === owner) return 'You can’t list your own wallet.'
    if (seen.has(addr)) return 'This address is already a recipient.'
    seen.add(addr)
    return null
  })
}

/** Total allocated share in basis points (exact, like the program's share_bps). */
export const totalBps = (rows: { amount: string }[]) => rows.reduce((s, r) => s + Math.round(pctOf(r.amount) * 100), 0)

function Avatar({ name, index }: { name: string; index: number }) {
  const letter = (name.trim()[0] || 'N').toUpperCase()
  return <span className="cf-avatar" style={{ background: RECIPIENT_COLORS[index % RECIPIENT_COLORS.length] }} aria-hidden>{letter}</span>
}

/* ---------------- fungible (share %) recipients ---------------- */

function AmountInput({ pct, unitValue, unitLabel, disabled, onPct }: { pct: number; unitValue: number | null; unitLabel: string; disabled: boolean; onPct: (pct: string) => void }) {
  // While typing we keep the raw text so the caret never jumps; the synced value shows otherwise.
  const [draft, setDraft] = useState<string | null>(null)
  const value = unitValue == null ? null : (pct * unitValue) / 100
  const synced = value == null ? '' : value.toFixed(unitLabel !== 'USD' && value !== 0 && Math.abs(value) < 1 ? 4 : 2)
  const shown = draft ?? synced
  return (
    <span className="cf-affix cf-affix--unit">
      <input
        className="cf-input"
        inputMode="decimal"
        value={shown}
        placeholder={unitValue == null ? '—' : '0.00'}
        disabled={disabled || unitValue == null || unitValue <= 0}
        aria-label={`Amount in ${unitLabel}`}
        onFocus={() => setDraft(shown)}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '')
          setDraft(raw)
          if (!unitValue) return
          const n = parseFloat(raw)
          const next = Number.isFinite(n) ? Math.min(100, (n / unitValue) * 100) : 0
          onPct(trimNum(next, 2) || '0')
        }}
      />
      <span>{unitLabel}</span>
    </span>
  )
}

export function StepBeneficiaries(props: {
  owner: string
  assets: (CatalogAsset & { amount: number })[]
  unit: ShareUnit
  onUnit: (unit: ShareUnit) => void
  rows: RecipientRow[]
  names: Record<string, string>
  onName: (id: string, name: string) => void
  onAddress: (index: number, value: string) => void
  onShare: (index: number, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onSplitEvenly: () => void
  onRemainderToLast: () => void
  maxRecipients: number
  attempted: boolean
  canContinue: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const totalUsd = props.assets.every((a) => a.usdPrice != null)
    ? props.assets.reduce((s, a) => s + a.amount * (a.usdPrice ?? 0), 0)
    : null
  const unitAsset = props.unit === 'all' ? null : props.assets.find((a) => a.key === props.unit) ?? null
  const unitValue = unitAsset ? unitAsset.amount : totalUsd
  const unitLabel = unitAsset ? unitAsset.displaySymbol : 'USD'

  const pcts = props.rows.map((r) => pctOf(r.amount))
  const issues = recipientIssues(props.rows.map((r, i) => ({ address: r.address, pct: pcts[i] })), props.owner)
  const bps = totalBps(props.rows)
  const over = bps > 10000
  const allocated = bps / 100

  return (
    <div className="cf-body cf-body--beneficiaries">
      <StepHead
        eyebrow="Step 2 of 4"
        title="Who receives your assets?"
        sub="Set each person's share. Type a percentage or a token amount — whichever is easier. They stay in sync."
      />
      <div className="cf-chips" role="group" aria-label="Show amounts in">
        <button type="button" className="cf-chip" aria-pressed={props.unit === 'all'} onClick={() => props.onUnit('all')} disabled={totalUsd == null} title={totalUsd == null ? 'USD prices are not available for every asset' : undefined}>
          <i style={{ background: '#ff9447' }} />All
        </button>
        {props.assets.map((a) => (
          <button key={a.key} type="button" className="cf-chip" aria-pressed={props.unit === a.key} onClick={() => props.onUnit(a.key)}>
            <i style={{ background: a.color }} />{a.displaySymbol}
          </button>
        ))}
      </div>

      <section className="cf-recipients" aria-labelledby="cf-rec-h">
        <div className="cf-recipients__h">
          <h2 id="cf-rec-h">Recipients</h2>
          <button type="button" className="cf-add" onClick={props.onAdd} disabled={props.rows.length >= props.maxRecipients}>
            <IconPlusSquare /> Add recipient
          </button>
          <div className="cf-recipients__tools">
            <button type="button" className="cf-btn cf-btn--pill" onClick={props.onSplitEvenly}>Split evenly</button>
            <button type="button" className="cf-btn cf-btn--pill" onClick={props.onRemainderToLast} disabled={props.rows.length < 1}>Give remainder to last</button>
          </div>
        </div>
        <div className="cf-rows">
          {props.rows.map((row, i) => {
            const name = props.names[row.id] ?? ''
            const issue = issues[i]
            const showIssue = issue && (props.attempted || row.address.trim())
            return (
              <div key={row.id} className="cf-row">
                <div className="cf-row__main">
                  <Avatar name={name} index={i} />
                  <input className="cf-input cf-input--name" placeholder="Name" value={name} maxLength={40} onChange={(e) => props.onName(row.id, e.target.value)} aria-label={`Recipient ${i + 1} name`} />
                  <input
                    className={`cf-input cf-input--addr${showIssue && row.address.trim() ? ' cf-input--error' : ''}`}
                    placeholder="Solana Address"
                    value={row.address}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => props.onAddress(i, e.target.value.trim())}
                    aria-label={`Recipient ${i + 1} Solana address`}
                  />
                  <span className="cf-affix">
                    <input
                      className="cf-input"
                      inputMode="decimal"
                      value={row.amount}
                      placeholder="0"
                      onChange={(e) => props.onShare(i, e.target.value.replace(/[^0-9.]/g, ''))}
                      aria-label={`Recipient ${i + 1} share percent`}
                    />
                    <span>%</span>
                  </span>
                  <span className="cf-eq" aria-hidden>=</span>
                  <AmountInput pct={pcts[i]} unitValue={unitValue} unitLabel={unitLabel} disabled={false} onPct={(v) => props.onShare(i, v)} />
                  <button type="button" className="cf-x" onClick={() => props.onRemove(i)} disabled={props.rows.length <= 1} aria-label={`Remove recipient ${i + 1}`}>
                    <IconX />
                  </button>
                </div>
                <p className={`cf-row__sub${showIssue ? ' cf-row__sub--err' : pcts[i] > 0 ? ' cf-row__sub--ok' : ''}`}>
                  {showIssue ? issue : pcts[i] > 0 ? `Receives ${trimNum(pcts[i], 2)}% of every asset in this intention` : 'No share set yet'}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <footer className="cf-foot">
        <div className="cf-alloc">
          <div className="cf-alloc__top">
            <span>Allocated</span>
            <span>{trimNum(allocated, 2)}%</span>
          </div>
          <div className="cf-alloc__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, allocated)} aria-label="Allocated share">
            {props.rows.map((row, i) => (
              <i key={row.id} style={{ width: `${Math.min(pcts[i], 100)}%`, background: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }} />
            ))}
          </div>
          <p className={`cf-alloc__note${over ? ' cf-alloc__note--err' : ''}`}>
            {over
              ? `${trimNum(allocated - 100, 2)}% over — shares can't add up to more than 100%.`
              : bps === 10000
                ? 'Fully allocated — every selected asset goes to your recipients.'
                : `${trimNum(100 - allocated, 2)}% unallocated — that portion stays in your wallet.`}
          </p>
        </div>
        <div className="cf-foot__actions">
          <button type="button" className="cf-btn cf-btn--ghost" onClick={props.onBack}>Back</button>
          <button type="button" className="cf-btn cf-btn--light" onClick={props.onContinue} aria-disabled={!props.canContinue} disabled={!props.canContinue && props.attempted}>Continue</button>
        </div>
      </footer>
    </div>
  )
}

/* ---------------- NFT recipients (each NFT goes to one person) ---------------- */

export function StepNftRecipients(props: {
  owner: string
  recipients: { address: string }[]
  names: string[]
  onName: (index: number, name: string) => void
  onAddress: (index: number, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
  nfts: NftItem[]
  selectedMints: string[]
  assignments: Record<string, number>
  onAssign: (mint: string, index: number) => void
  maxRecipients: number
  attempted: boolean
  canContinue: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const issues = recipientIssues(props.recipients.map((r) => ({ address: r.address, pct: 1 })), props.owner)
  return (
    <div className="cf-body cf-body--beneficiaries">
      <StepHead eyebrow="Step 2 of 4" title="Who receives your assets?" sub="Add the people who should receive your NFTs, then choose who gets each one." />
      <section className="cf-recipients" aria-labelledby="cf-rec-h">
        <div className="cf-recipients__h">
          <h2 id="cf-rec-h">Recipients</h2>
          <button type="button" className="cf-add" onClick={props.onAdd} disabled={props.recipients.length >= props.maxRecipients}>
            <IconPlusSquare /> Add recipient
          </button>
        </div>
        <div className="cf-rows">
          {props.recipients.map((r, i) => {
            const issue = issues[i]
            const showIssue = issue && (props.attempted || r.address.trim())
            return (
              <div key={i} className="cf-row">
                <div className="cf-row__main cf-row__main--nft">
                  <Avatar name={props.names[i] ?? ''} index={i} />
                  <input className="cf-input cf-input--name" placeholder="Name" value={props.names[i] ?? ''} maxLength={40} onChange={(e) => props.onName(i, e.target.value)} aria-label={`Recipient ${i + 1} name`} />
                  <input className={`cf-input cf-input--addr${showIssue && r.address.trim() ? ' cf-input--error' : ''}`} placeholder="Solana Address" value={r.address} spellCheck={false} onChange={(e) => props.onAddress(i, e.target.value.trim())} aria-label={`Recipient ${i + 1} Solana address`} />
                  <button type="button" className="cf-x" onClick={() => props.onRemove(i)} disabled={props.recipients.length <= 1} aria-label={`Remove recipient ${i + 1}`}><IconX /></button>
                </div>
                {showIssue && <p className="cf-row__sub cf-row__sub--err">{issue}</p>}
              </div>
            )
          })}
          <div className="cf-assign">
            {props.selectedMints.map((mint) => {
              const nft = props.nfts.find((n) => n.mint === mint)
              return (
                <label key={mint} className="cf-assign__row">
                  <strong style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nft?.name || maskAddr(mint, 4, 4)}</strong>
                  <span>goes to</span>
                  <select className="cf-input cf-select" value={props.assignments[mint] ?? 0} onChange={(e) => props.onAssign(mint, Number(e.target.value))}>
                    {props.recipients.map((r, i) => (
                      <option key={i} value={i}>{props.names[i]?.trim() || (r.address ? maskAddr(r.address) : `Recipient ${i + 1}`)}</option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        </div>
      </section>
      <footer className="cf-foot">
        <span />
        <div className="cf-foot__actions">
          <button type="button" className="cf-btn cf-btn--ghost" onClick={props.onBack}>Back</button>
          <button type="button" className="cf-btn cf-btn--light" onClick={props.onContinue} disabled={!props.canContinue && props.attempted}>Continue</button>
        </div>
      </footer>
    </div>
  )
}
