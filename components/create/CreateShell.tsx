import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { IconCheck } from './ui'
import { CREATE_RIBBON_WINDOWS } from './ribbons'

export type StepKey = 'assets' | 'beneficiaries' | 'trigger' | 'review'
export const STEP_LABELS: { key: StepKey; label: string }[] = [
  { key: 'assets', label: 'Assets' },
  { key: 'beneficiaries', label: 'Beneficiaries' },
  { key: 'trigger', label: 'Trigger & Note' },
  { key: 'review', label: 'Review' },
]

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="cf-steps" aria-label="Progress">
      {STEP_LABELS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={step.key} className="cf-steps__item">
            {i > 0 && <span className={`cf-step__line${i <= current ? ' is-filled' : ''}`} aria-hidden />}
            <span className={`cf-step cf-step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="cf-step__dot">
                {state === 'done' ? <IconCheck className="cf-step__check" /> : <span>{i + 1}</span>}
              </span>
              <span className="cf-step__label">{step.label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Page frame: logo, the red threads, and the card stage. The threads live in the design's
 * 1512 x 853 artboard space, positioned from the card so their ends always tuck under it.
 */
export function CreateShell({ ribbons, children, success = false, spinLogo = false }: { ribbons: string[]; children: ReactNode; success?: boolean; spinLogo?: boolean }) {
  return (
    <div className="cf-page">
      <Link href="/" className={`cf-logo${spinLogo ? ' cf-logo--spin' : ''}`} aria-label="Heres home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/logo.png" alt="Heres" />
      </Link>
      <svg className="cf-ribbons" viewBox="0 0 1512 853" aria-hidden focusable="false">
        <g className="cf-ribbons__drift">
          {ribbons.map((d, i) => (
            <path
              key={i}
              d={d}
              pathLength={1}
              style={
                {
                  '--cf-delay': `${[0.2, 0.34, 0.5][i] ?? 0.3}s`,
                  '--cf-from': 1 - (CREATE_RIBBON_WINDOWS[i]?.from ?? 0),
                  '--cf-to': 1 - (CREATE_RIBBON_WINDOWS[i]?.to ?? 1),
                } as CSSProperties
              }
            />
          ))}
        </g>
      </svg>
      <main className={`cf-stage${success ? ' cf-stage--success' : ''}`}>{children}</main>
    </div>
  )
}

export function StepHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: ReactNode }) {
  return (
    <header className="cf-head">
      <p className="cf-eyebrow">{eyebrow}</p>
      <h1 className="cf-title">{title}</h1>
      {sub && <p className="cf-sub">{sub}</p>}
    </header>
  )
}
