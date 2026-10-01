'use client'

import { useState } from 'react'
import { FULL_PCT, amountToPct, displayPct, pctToScaled, relativeShareBps, scaledToNumber, sumPct, unitsForPct, valueToPct } from '@/lib/recipient-amount'
import { formatBaseUnits, parseDecimalToBaseUnits } from '@/lib/fungible-assets'
import { isValidSolanaAddress } from '@/config/solana'
import { StepHead } from './CreateShell'
import { RECIPIENT_COLORS, type CatalogAsset } from './useAssetCatalog'
import type { NftItem } from '@/hooks/useCreateCapsuleForm'
import { IconPlusSquare, IconX, maskAddr } from './ui'

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

/** Total allocated share, exact (scaled by 10^30; FULL_PCT = 100%). */
export const totalScaled = (rows: { amount: string }[]) => sumPct(rows.map((r) => r.amount))

/** Active recipients whose part of the deposit would round to 0 bps on-chain (too small next to the others). */
export function tooSmallShares(pcts: string[], active: number[]): Set<number> {
  const bps = relativeShareBps(active.map((i) => pctToScaled(pcts[i])))
  return new Set(active.filter((_, k) => bps[k] === 0))
}

function Avatar({ name, index }: { name: string; index: number }) {
  const letter = (name.trim()[0] || 'N').toUpperCase()
  return <span className="cf-avatar" style={{ background: RECIPIENT_COLORS[index % RECIPIENT_COLORS.length] }} aria-hidden>{letter}</span>
}

/* ---------------- fungible (share %) recipients ---------------- */

/** What the amount column is measured in: one asset (exact base units) or the USD total. */
type AmountUnit =
  | { kind: 'asset'; label: string; total: string; decimals: number; totalUnits: bigint }
  | { kind: 'usd'; label: 'USD'; total: number }

const fmtTokenAmount = (unitsValue: bigint, decimals: number) => {
  const full = formatBaseUnits(unitsValue, decimals)
  const [whole, frac = ''] = full.split('.')
  return frac ? `${whole}.${frac.slice(0, 6).replace(/0+$/, '') || '0'}`.replace(/\.0$/, '') : whole
}

/** The amount this share works out to, in the unit column. */
function amountForPct(pct: string, unit: AmountUnit | null): string {
  if (!unit) return ''
  if (unit.kind === 'asset') return fmtTokenAmount(unitsForPct(unit.totalUnits, pctToScaled(pct)), unit.decimals)
  const value = (pctOf(pct) * unit.total) / 100
  return value.toFixed(2)
}

function AmountInput({ pct, unit, onPct }: { pct: string; unit: AmountUnit | null; onPct: (pct: string) => void }) {
  // While typing, keep exactly what the user typed (so "10" stays "10"); otherwise show the synced value.
  const [draft, setDraft] = useState<{ raw: string; pct: string } | null>(null)
  const synced = pctToScaled(pct) > 0n ? amountForPct(pct, unit) : ''
  const shown = draft && draft.pct === pct ? draft.raw : synced
  const label = unit?.label ?? ''
  return (
    <span className="cf-affix cf-affix--unit">
      <input
        className="cf-input"
        inputMode="decimal"
        value={shown}
        placeholder={unit ? '0' : '—'}
        disabled={!unit || (unit.kind === 'asset' ? unit.totalUnits <= 0n : unit.total <= 0)}
        aria-label={`Amount in ${label}`}
        onFocus={() => setDraft({ raw: shown, pct })}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          if (!unit) return
          const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
          const next = unit.kind === 'asset' ? amountToPct(raw, unit.total, unit.decimals) : valueToPct(parseFloat(raw), unit.total)
          setDraft({ raw, pct: next })
          onPct(next)
        }}
      />
      <span title={label}>{label}</span>
    </span>
  )
}

/** Percent box: shows a readable figure, but keeps the exact share underneath. */
function PctInput({ pct, index, onPct }: { pct: string; index: number; onPct: (pct: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const readable = pctToScaled(pct) > 0n ? displayPct(pctOf(pct)) : pct.trim() === '' ? '' : '0'
  return (
    <span className="cf-affix">
      <input
        className="cf-input"
        inputMode="decimal"
        value={draft ?? readable}
        placeholder="0"
        onFocus={() => setDraft(readable)}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
          setDraft(raw)
          onPct(raw)
        }}
        aria-label={`Recipient ${index + 1} share percent`}
      />
      <span>%</span>
    </span>
  )
}

export function StepBeneficiaries(props: {
  owner: string
  assets: (CatalogAsset & { amount: number; amountStr: string })[]
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
  const unitTotalUnits = unitAsset ? parseDecimalToBaseUnits(unitAsset.amountStr, unitAsset.decimals) : null
  const amountUnit: AmountUnit | null = unitAsset
    ? unitTotalUnits
      ? { kind: 'asset', label: unitAsset.displaySymbol, total: unitAsset.amountStr, decimals: unitAsset.decimals, totalUnits: unitTotalUnits }
      : null
    : totalUsd != null && totalUsd > 0
      ? { kind: 'usd', label: 'USD', total: totalUsd }
      : null

  const shareStrs = props.rows.map((r) => r.amount)
  const pcts = shareStrs.map(pctOf)
  const issues = recipientIssues(props.rows.map((r, i) => ({ address: r.address, pct: pcts[i] })), props.owner)
  const active = props.rows.map((r, i) => (r.address.trim() && pctToScaled(r.amount) > 0n ? i : -1)).filter((i) => i >= 0)
  const tiny = tooSmallShares(shareStrs, active)
  const allocScaled = totalScaled(props.rows)
  const over = allocScaled > FULL_PCT
  const full = allocScaled === FULL_PCT
  const allocated = scaledToNumber(allocScaled)
  const singleAsset = props.assets.length === 1 ? props.assets[0] : null
  const receives = (i: number) => {
    if (singleAsset) {
      const totalUnits = parseDecimalToBaseUnits(singleAsset.amountStr, singleAsset.decimals)
      if (totalUnits) {
        const [whole, frac] = fmtTokenAmount(unitsForPct(totalUnits, pctToScaled(shareStrs[i])), singleAsset.decimals).split('.')
        return `Receives ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''} ${singleAsset.displaySymbol}`
      }
    }
    return `Receives ${displayPct(pcts[i])}% of every asset in this intention`
  }

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
      <p className="cf-share-note">Type an exact amount (for example 10 tokens) or a percentage. Whatever you don’t allocate stays in your wallet.</p>

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
                  <PctInput pct={row.amount} index={i} onPct={(v) => props.onShare(i, v)} />
                  <span className="cf-eq" aria-hidden>=</span>
                  <AmountInput key={props.unit} pct={row.amount} unit={amountUnit} onPct={(v) => props.onShare(i, v)} />
                  <button type="button" className="cf-x" onClick={() => props.onRemove(i)} disabled={props.rows.length <= 1} aria-label={`Remove recipient ${i + 1}`}>
                    <IconX />
                  </button>
                </div>
                <p className={`cf-row__sub${showIssue || tiny.has(i) ? ' cf-row__sub--err' : pcts[i] > 0 ? ' cf-row__sub--ok' : ''}`}>
                  {showIssue
                    ? issue
                    : tiny.has(i)
                      ? 'Too small next to the other shares (under 0.01% of what goes into the capsule). Increase it or lower the others.'
                      : pcts[i] > 0
                        ? receives(i)
                        : 'No share set yet'}
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
            <span>{displayPct(allocated)}%</span>
          </div>
          <div className="cf-alloc__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, allocated)} aria-label="Allocated share">
            {props.rows.map((row, i) => (
              <i key={row.id} style={{ width: `${Math.min(pcts[i], 100)}%`, background: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }} />
            ))}
          </div>
          <p className={`cf-alloc__note${over ? ' cf-alloc__note--err' : ''}`}>
            {over
              ? `${displayPct(allocated - 100)}% over — shares can't add up to more than 100%.`
              : full
                ? 'Fully allocated — every selected asset goes to your recipients.'
                : allocated > 0 && allocated < 0.01
                  ? `${displayPct(allocated)}% allocated — the rest stays in your wallet.`
                  : `${displayPct(100 - allocated)}% unallocated — that portion stays in your wallet.`}
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
