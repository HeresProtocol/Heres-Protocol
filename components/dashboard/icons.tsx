import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
})

/** Line icons for the dashboard, matched to the capsule builder's set. */
export const HdIcon = {
  Plus: (p: P) => <svg {...base({ strokeWidth: 2.4, ...p })}><path d="M12 5v14M5 12h14" /></svg>,
  Check: (p: P) => <svg {...base(p)}><path d="M5 12.5l4.2 4.2L19 7" /></svg>,
  Alert: (p: P) => <svg {...base(p)}><path d="M10.3 4.1L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 4.1a2 2 0 00-3.4 0z" /><path d="M12 9.5v4.2M12 17h.01" /></svg>,
  Hourglass: (p: P) => <svg {...base(p)}><path d="M6.5 3h11M6.5 21h11M7.5 3v2.8c0 1.7.8 3.2 2.2 4.2L12 11.8l2.3-1.8c1.4-1 2.2-2.5 2.2-4.2V3M7.5 21v-2.8c0-1.7.8-3.2 2.2-4.2L12 12.2l2.3 1.8c1.4 1 2.2 2.5 2.2 4.2V21" /></svg>,
  Wallet: (p: P) => <svg {...base(p)}><path d="M4 7.5A2.5 2.5 0 016.5 5H18v3M4 7.5V17a2 2 0 002 2h13a1 1 0 001-1v-3M4 7.5A2 2 0 006 9.5h13a1 1 0 011 1V15m0 0h-3.5a1.5 1.5 0 010-3H20" /></svg>,
  Refresh: (p: P) => <svg {...base(p)}><path d="M20 11a8 8 0 00-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0014.3 4.9L20 16m0 4v-4h-4" /></svg>,
  Dots: (p: P) => <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })}><circle cx="5.5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" /></svg>,
  Eye: (p: P) => <svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  Trash: (p: P) => <svg {...base(p)}><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12a2 2 0 002 1.9h5.4a2 2 0 002-1.9l.8-12M10 11v6M14 11v6" /></svg>,
  ArrowLeft: (p: P) => <svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  ArrowRight: (p: P) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  Lock: (p: P) => <svg {...base(p)}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></svg>,
  Pulse: (p: P) => <svg {...base(p)}><path d="M3 12h4l2.5-5 4 10 2.5-5H21" /></svg>,
  Copy: (p: P) => <svg {...base(p)}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg>,
  External: (p: P) => <svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" /></svg>,
  Clock: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  Info: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.2" /></svg>,
  X: (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  Mail: (p: P) => <svg {...base(p)}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></svg>,
  Pencil: (p: P) => <svg {...base(p)}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 00-3-3L5 17v3z" /></svg>,
  Chevron: (p: P) => <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>,
  Spinner: (p: P) => <svg {...base(p)} className={`hd-spin ${p.className ?? ''}`}><path d="M12 3a9 9 0 109 9" /></svg>,
}
