import type { SVGProps } from 'react'

/* ---------------- formatting ---------------- */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtUsd = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? '—' : usd.format(value))

/** Human token amount: grouping, up to 4 decimals (fewer for big numbers), never scientific. */
export function fmtAmount(value: number | null | undefined, maxDecimals = 4): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? Math.min(maxDecimals, 4) : maxDecimals
  return value.toLocaleString('en-US', { minimumFractionDigits: abs >= 1 && abs < 1000 ? 2 : 0, maximumFractionDigits: digits })
}

/** Compact amount for tight places: 12,500,000 -> 12.5M */
export function fmtCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`
  return fmtAmount(value)
}

export const maskAddr = (address: string, head = 6, tail = 4) =>
  address.length > head + tail + 3 ? `${address.slice(0, head)}...${address.slice(-tail)}` : address

/** Trim a number to at most `dp` decimals, without trailing zeros ("22.40" -> "22.4"). */
export const trimNum = (value: number, dp = 2) => {
  if (!Number.isFinite(value)) return ''
  const fixed = value.toFixed(dp)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

/* ---------------- icons (stroke = currentColor) ---------------- */

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p })

export const IconCheck = (p: P) => <svg {...base(p)}><path d="M5 12.5l4.2 4.2L19 7" /></svg>
export const IconX = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const IconInfo = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.2" /></svg>
export const IconChevron = (p: P) => <svg {...base(p)}><path d="M6 15l6-6 6 6" /></svg>
export const IconChevronDown = (p: P) => <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>
export const IconShield = (p: P) => <svg {...base(p)}><path d="M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>
export const IconLock = (p: P) => <svg {...base(p)}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></svg>
export const IconPencil = (p: P) => <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}><path d="M4 16.8V20h3.2l9.4-9.4-3.2-3.2L4 16.8zm15.1-8.7a.85.85 0 000-1.2l-2-2a.85.85 0 00-1.2 0l-1.6 1.6 3.2 3.2 1.6-1.6z" /></svg>
export const IconPlusSquare = (p: P) => <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}><path fillRule="evenodd" d="M6 3.5h12A2.5 2.5 0 0120.5 6v12a2.5 2.5 0 01-2.5 2.5H6A2.5 2.5 0 013.5 18V6A2.5 2.5 0 016 3.5zm5 4.5v3H8v2h3v3h2v-3h3v-2h-3V8h-2z" /></svg>
export const IconCalendar = (p: P) => <svg {...base(p)}><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16M8.5 14h2.5v2.5" /></svg>
export const IconCopy = (p: P) => <svg {...base(p)}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg>
export const IconLogout = (p: P) => <svg {...base(p)}><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>
export const IconWallet = (p: P) => <svg {...base(p)}><path d="M4 7.5A2.5 2.5 0 016.5 5H18v3M4 7.5V17a2 2 0 002 2h13a1 1 0 001-1v-3M4 7.5A2 2 0 006 9.5h13a1 1 0 011 1V15m0 0h-3.5a1.5 1.5 0 010-3H20" /></svg>
export const IconArrowLeft = (p: P) => <svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
export const IconArrowRight = (p: P) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
export const IconSpinner = (p: P) => <svg {...base(p)} className={`cf-spin ${p.className ?? ''}`}><path d="M12 3a9 9 0 109 9" /></svg>

export const IconTokens = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="10" cy="5.5" rx="6" ry="2.5" />
    <path d="M4 5.5v4c0 1.4 2.7 2.5 6 2.5M4 9.5v4c0 1.4 2.7 2.5 6 2.5M4 13.5v4c0 1.4 2.7 2.5 6 2.5M16 5.5v3.2" />
    <ellipse cx="16" cy="11.5" rx="5" ry="2.2" />
    <path d="M11 11.5v7c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-7M11 15c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2" />
  </svg>
)
export const IconNft = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z" />
    <circle cx="10" cy="10.2" r="1.5" />
    <path d="M6.2 15.4l3.7-2.8 2.4 1.8 2.8-2.6 3 2.8" />
  </svg>
)
/** Solana mark (three bars), gradient like the design. */
export const IconSolana = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <defs>
      <linearGradient id="cf-sol-g" x1="3" y1="20" x2="21" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#9945ff" />
        <stop offset="1" stopColor="#14f195" />
      </linearGradient>
    </defs>
    <path fill="url(#cf-sol-g)" d="M6.2 16.1a.7.7 0 01.5-.2h14.1c.3 0 .5.4.2.6l-2.8 2.8a.7.7 0 01-.5.2H3.6c-.3 0-.5-.4-.2-.6zM6.2 4.5a.7.7 0 01.5-.2h14.1c.3 0 .5.4.2.6l-2.8 2.8a.7.7 0 01-.5.2H3.6c-.3 0-.5-.4-.2-.6zM17.8 10.3a.7.7 0 00-.5-.2H3.2c-.3 0-.5.4-.2.6l2.8 2.8c.1.1.3.2.5.2h14.1c.3 0 .5-.4.2-.6z" />
  </svg>
)

/** Round token avatar: logo if we have one, the Solana mark for SOL, else initials. */
export function TokenIcon({ icon, symbol, isSol }: { icon: string | null; symbol: string; isSol?: boolean }) {
  return (
    <span className="cf-asset-row__icon">
      {isSol ? (
        <IconSolana />
      ) : icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span>{symbol.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  )
}
