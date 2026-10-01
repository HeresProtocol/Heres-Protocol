// Exact recipient-share math for the create flow.
//
// A recipient's share is kept as a percentage string with up to 30 decimal places, NOT rounded to
// 0.01%. Only the on-chain split *between* recipients uses basis points (share_bps); the part of each
// asset that goes into the capsule is `protected amount x allocated %`, computed here in integer base
// units. So "give Joseph 10 tokens" out of a 14.97M balance deposits exactly 10 tokens.
// Self-contained (no imports) so node:test can load it directly.

export const PCT_DIGITS = 30
const SCALE = 10n ** BigInt(PCT_DIGITS)
/** 100% in scaled units. */
export const FULL_PCT = 100n * SCALE

/** Non-negative decimal string -> integer scaled by 10^digits. Extra fraction digits are truncated. */
function parseScaled(value: string, digits: number): bigint | null {
  const raw = value.trim()
  if (!/^\d*\.?\d*$/.test(raw) || raw === '' || raw === '.') return null
  const [intPart = '', fracPart = ''] = raw.split('.')
  return BigInt(`${intPart || '0'}${fracPart.slice(0, digits).padEnd(digits, '0')}`)
}

function formatScaled(value: bigint, digits: number): string {
  const digitsStr = value.toString().padStart(digits + 1, '0')
  const whole = digitsStr.slice(0, -digits) || '0'
  const fraction = digitsStr.slice(-digits).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/** A share percentage string (as typed or computed) in scaled units; invalid/blank -> 0. */
export function pctToScaled(pct: string): bigint {
  return parseScaled(pct, PCT_DIGITS) ?? 0n
}

export function scaledToPct(scaled: bigint): string {
  return formatScaled(scaled < 0n ? 0n : scaled, PCT_DIGITS)
}

/** Scaled percent -> number, for display and bars only (never for amounts). */
export function scaledToNumber(scaled: bigint): number {
  return Number(scaled / 10n ** 22n) / 1e8
}

export function sumPct(pcts: string[]): bigint {
  return pcts.reduce((sum, p) => sum + pctToScaled(p), 0n)
}

/** Exact percent that `amount` is of `total` (both decimal strings of one asset). Capped at 100. */
export function amountToPct(amount: string, total: string, decimals: number): string {
  const a = parseScaled(amount, decimals)
  const t = parseScaled(total, decimals)
  if (a == null || t == null || a <= 0n || t <= 0n) return '0'
  if (a >= t) return '100'
  return scaledToPct((a * FULL_PCT) / t)
}

/** Percent that a USD value is of a USD total (prices are approximate, so float precision is fine). */
export function valueToPct(value: number, total: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(total) || value <= 0 || total <= 0) return '0'
  if (value >= total) return '100'
  return (value / total * 100).toFixed(20).replace(/\.?0+$/, '')
}

/**
 * Base units of an asset covered by a scaled percent, rounded to the nearest unit. Because
 * `amountToPct` floors at 30 decimals, this reproduces the typed amount exactly.
 */
export function unitsForPct(totalUnits: bigint, scaledPct: bigint): bigint {
  if (totalUnits <= 0n || scaledPct <= 0n) return 0n
  if (scaledPct >= FULL_PCT) return totalUnits
  return (totalUnits * scaledPct + FULL_PCT / 2n) / FULL_PCT
}

/**
 * On-chain split of the deposit between recipients, in basis points summing to exactly 10000.
 * Each recipient gets floor(their share of the allocated total); the last absorbs the remainder.
 * A result of 0 bps means that recipient's share is too small relative to the others.
 */
export function relativeShareBps(scaledPcts: bigint[]): number[] {
  const total = scaledPcts.reduce((s, p) => s + p, 0n)
  if (total <= 0n) return scaledPcts.map(() => 0)
  let used = 0
  return scaledPcts.map((p, i) => {
    const bps = i === scaledPcts.length - 1 ? 10000 - used : Number((p * 10000n) / total)
    used += bps
    return bps
  })
}

/** Human percent: 2 decimals normally, more for tiny shares so they never read as "0". */
export function displayPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0'
  const fixed = pct >= 0.01 ? pct.toFixed(2) : pct.toPrecision(2)
  const plain = Number(fixed).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 })
  return plain
}
