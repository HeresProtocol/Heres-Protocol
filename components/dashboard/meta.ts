/**
 * Small, shared helpers for the dashboard and capsule pages.
 *
 * Capsule names and recipient names are NOT stored on-chain (the program only keeps addresses and
 * shares). When a capsule is created in this browser we remember the names the owner typed, keyed by
 * the capsule address, so the dashboard can say "For Jake & Maria" instead of an address. Anything
 * missing simply falls back to addresses. Nothing here is sent anywhere.
 */

export type CapsuleLabels = {
  /** recipient address -> name typed at creation */
  names: Record<string, string>
  createdAt: number
  /** A sealed note was registered at creation (the note itself lives off-chain, encrypted). */
  note?: boolean
  /** Representative email, masked (j•••@gmail.com), shown back to the owner only. */
  representative?: string
}

const key = (capsuleAddress: string) => `heres:capsule-labels:${capsuleAddress}`

export function readCapsuleLabels(capsuleAddress: string | null | undefined): CapsuleLabels | null {
  if (!capsuleAddress || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(capsuleAddress))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CapsuleLabels
    return parsed && typeof parsed === 'object' && parsed.names ? parsed : null
  } catch {
    return null
  }
}

export function saveCapsuleLabels(
  capsuleAddress: string,
  names: Record<string, string>,
  extra: { note?: boolean; representative?: string } = {}
) {
  if (typeof window === 'undefined') return
  const clean = Object.fromEntries(Object.entries(names).filter(([addr, name]) => addr && name && name.trim()).map(([a, n]) => [a, n.trim()]))
  try {
    window.localStorage.setItem(key(capsuleAddress), JSON.stringify({ names: clean, createdAt: Date.now(), ...extra } satisfies CapsuleLabels))
  } catch {
    /* storage unavailable: labels are optional */
  }
}

export function forgetCapsuleLabels(capsuleAddress: string) {
  try {
    window.localStorage.removeItem(key(capsuleAddress))
  } catch {
    /* ignore */
  }
}

/** "jane@gmail.com" -> "j•••@gmail.com" */
export function maskEmail(email: string) {
  const [user, domain] = email.trim().split('@')
  if (!user || !domain) return ''
  return `${user[0]}•••@${domain}`
}

/** Short, human capsule code shared with the builder's success screen: HR-XXXX. */
export const capsuleCode = (capsuleAddress: string) => `HR-${capsuleAddress.slice(-4).toUpperCase()}`

/** "Jake", "Jake & Maria", "Jake, Maria & Sam" */
export function joinNames(names: string[]) {
  const n = names.filter(Boolean)
  if (n.length <= 1) return n[0] ?? ''
  return `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`
}

/** Title for a capsule: "For Jake & Maria" when we know the names, otherwise "Your capsule". */
export function capsuleTitle(labels: CapsuleLabels | null, recipientAddresses: string[]) {
  const names = recipientAddresses.length
    ? recipientAddresses.map((a) => labels?.names[a]).filter((n): n is string => Boolean(n))
    : Object.values(labels?.names ?? {})
  return names.length ? `For ${joinNames(names)}` : 'Your capsule'
}

/** Remaining time, the way people say it: "1 yr 11 mo", "5 mo", "14 days", "6 hrs", "12 min". */
export function formatRemaining(seconds: number) {
  if (seconds <= 0) return 'now'
  const min = Math.floor(seconds / 60)
  const hrs = Math.floor(seconds / 3600)
  const days = Math.floor(seconds / 86400)
  if (days >= 365) {
    // Round to the nearest month so a freshly created 2-year capsule reads "2 yrs", not "1 yr 11 mo".
    const months = Math.round(days / 30.44)
    const y = Math.floor(months / 12)
    const m = months % 12
    return m ? `${y} yr ${m} mo` : `${y} yr${y === 1 ? '' : 's'}`
  }
  if (days >= 60) return `${Math.floor(days / 30)} mo`
  if (days >= 2) return `${days} days`
  if (hrs >= 2) return `${hrs} hrs`
  if (hrs >= 1) return '1 hr'
  return `${Math.max(1, min)} min`
}

/** Compact trigger label: "Inactivity · 2 yrs" or "Date · 4 Mar 2041". */
export function triggerShort(inactivitySeconds: number, targetDate: number | null | undefined) {
  const period = formatPeriod(inactivitySeconds)
  if (targetDate != null && inactivitySeconds >= 90 * 365 * 86400) return `Date · ${shortDate(targetDate)}`
  if (targetDate != null) return `Inactivity · ${period} or ${shortDate(targetDate)}`
  return `Inactivity · ${period}`
}

/** 63072000 -> "2 yrs", 15552000 -> "6 mo", 7776000 -> "3 mo", 604800 -> "7 days" */
export function formatPeriod(seconds: number) {
  const days = Math.round(seconds / 86400)
  if (days >= 365 && days % 365 === 0) {
    const y = days / 365
    return `${y} yr${y === 1 ? '' : 's'}`
  }
  if (days >= 30 && days % 30 === 0) return `${days / 30} mo`
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`
  const min = Math.round(seconds / 60)
  return min >= 60 ? `${Math.round(min / 60)} hr${min >= 120 ? 's' : ''}` : `${min} min`
}

export const shortDate = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const longDate = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

/** "4 days ago", "just now" */
export function agoWords(unixSeconds: number, now = Date.now()) {
  const diff = Math.max(0, Math.floor(now / 1000) - unixSeconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    return `${h} hr${h === 1 ? '' : 's'} ago`
  }
  const d = Math.floor(diff / 86400)
  if (d < 60) return `${d} day${d === 1 ? '' : 's'} ago`
  return `${Math.floor(d / 30)} months ago`
}
