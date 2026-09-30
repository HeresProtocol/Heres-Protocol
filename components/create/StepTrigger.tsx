'use client'

import { MAX_INTENT_LENGTH } from '@/lib/schemas'
import { isValidEmail } from '@/utils/validation'
import type { InactivityUnit } from '@/hooks/useCreateCapsuleForm'
import { StepHead } from './CreateShell'
import { IconCalendar, IconInfo } from './ui'

export type TriggerMode = 'inactivity' | 'date'
export type TriggerPreset = '6m' | '1y' | '2y' | 'custom'

export const PRESETS: { key: Exclude<TriggerPreset, 'custom'>; label: string; value: string; unit: InactivityUnit }[] = [
  { key: '6m', label: '6 months', value: '6', unit: 'months' },
  { key: '1y', label: '1 year', value: '1', unit: 'years' },
  { key: '2y', label: '2 years', value: '2', unit: 'years' },
]

const UNIT_LABEL: Record<InactivityUnit, [string, string]> = {
  minutes: ['minute', 'minutes'],
  days: ['day', 'days'],
  months: ['month', 'months'],
  years: ['year', 'years'],
}
export function periodLabel(value: string, unit: InactivityUnit) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${n} ${UNIT_LABEL[unit][n === 1 ? 0 : 1]}`
}
export function longDate(iso: string) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function StepTrigger(props: {
  mode: TriggerMode
  onMode: (mode: TriggerMode) => void
  preset: TriggerPreset
  onPreset: (preset: TriggerPreset) => void
  value: string
  unit: InactivityUnit
  unitOptions: InactivityUnit[]
  onValue: (value: string) => void
  onUnit: (unit: InactivityUnit) => void
  date: string
  minDate: string
  onDate: (date: string) => void
  intent: string
  onIntent: (value: string) => void
  email: string
  onEmail: (value: string) => void
  reminder: boolean
  onReminder: (value: boolean) => void
  attempted: boolean
  canContinue: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const period = periodLabel(props.value, props.unit)
  const emailBad = props.email.trim() !== '' && !isValidEmail(props.email)
  const dateBad = props.mode === 'date' && props.date !== '' && props.date < props.minDate

  const select = (mode: TriggerMode) => () => props.mode !== mode && props.onMode(mode)
  const onKey = (mode: TriggerMode) => (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(mode)()
    }
  }

  return (
    <div className="cf-body cf-body--trigger">
      <StepHead
        eyebrow="Step 3 of 4"
        title="Set the conditions for execution"
        sub="Choose when and how your assets should be transferred, and leave anything you'd want understood when that happens."
      />
      <div className="cf-content">
        <div className="cf-trigger" role="radiogroup" aria-label="Trigger">
          {/* ---- inactivity ---- */}
          <div className="cf-opt" role="radio" aria-checked={props.mode === 'inactivity'} tabIndex={0} onClick={select('inactivity')} onKeyDown={onKey('inactivity')}>
            <div className="cf-opt__top">
              <span className="cf-opt__icon" aria-hidden><IconCalendar /></span>
              <div>
                <h3>By inactivity</h3>
                <p className="cf-opt__desc">If you don&rsquo;t interact with your wallet for a set period of time, the assets will be transferred.</p>
              </div>
              <span className="cf-radio" aria-hidden />
            </div>
            <span className="cf-label">Inactivity period</span>
            <div className="cf-seg" role="group" aria-label="Inactivity period">
              {PRESETS.map((p) => (
                <button key={p.key} type="button" aria-pressed={props.mode === 'inactivity' && props.preset === p.key} onClick={(e) => { e.stopPropagation(); props.onMode('inactivity'); props.onPreset(p.key) }}>
                  {p.label}
                </button>
              ))}
              <button type="button" aria-pressed={props.mode === 'inactivity' && props.preset === 'custom'} onClick={(e) => { e.stopPropagation(); props.onMode('inactivity'); props.onPreset('custom') }}>
                Custom
              </button>
            </div>
            {props.mode === 'inactivity' && props.preset === 'custom' && (
              <div className="cf-custom" onClick={(e) => e.stopPropagation()}>
                <input className="cf-input" inputMode="numeric" value={props.value} placeholder="e.g. 18" onChange={(e) => props.onValue(e.target.value.replace(/\D/g, '').slice(0, 5))} aria-label="Inactivity length" />
                <select className="cf-input cf-select" value={props.unit} onChange={(e) => props.onUnit(e.target.value as InactivityUnit)} aria-label="Inactivity unit">
                  {props.unitOptions.map((u) => <option key={u} value={u}>{UNIT_LABEL[u][1][0].toUpperCase() + UNIT_LABEL[u][1].slice(1)}</option>)}
                </select>
              </div>
            )}
            <p className="cf-info cf-info--card">
              <IconInfo />
              <span>
                {props.mode === 'inactivity' && period
                  ? `If you haven't made any transactions or interacted with your wallet for ${period}, the assets will be sent to your beneficiaries.`
                  : 'Pick how long your wallet can stay inactive before the assets are sent to your beneficiaries.'}
              </span>
            </p>
          </div>

          {/* ---- specific date ---- */}
          <div className="cf-opt" role="radio" aria-checked={props.mode === 'date'} tabIndex={0} onClick={select('date')} onKeyDown={onKey('date')}>
            <div className="cf-opt__top">
              <span className="cf-opt__icon" aria-hidden><IconCalendar /></span>
              <div>
                <h3>On a specific date</h3>
                <p className="cf-opt__desc">Choose a date in the future. On that day, the assets will be transferred to your beneficiaries.</p>
              </div>
              <span className="cf-radio" aria-hidden />
            </div>
            <label className="cf-label" htmlFor="cf-date">Select date</label>
            <div className="cf-date">
              <IconCalendar className="cf-date__icon" />
              <input
                id="cf-date"
                type="date"
                className={`cf-input${dateBad ? ' cf-input--error' : ''}`}
                min={props.minDate}
                value={props.mode === 'date' ? props.date : ''}
                onFocus={() => props.mode !== 'date' && props.onMode('date')}
                onChange={(e) => props.onDate(e.target.value)}
              />
            </div>
            <p className="cf-info cf-info--card">
              <IconInfo />
              <span>
                {dateBad
                  ? 'Choose a date after today.'
                  : props.mode === 'date' && props.date
                    ? `The assets will be transferred on ${longDate(props.date)} to your selected beneficiaries.`
                    : 'Pick the day the assets should be transferred to your selected beneficiaries.'}
              </span>
            </p>
          </div>
        </div>

        {/* ---- intent statement ---- */}
        <section className="cf-note" aria-labelledby="cf-note-h">
          <h3 id="cf-note-h">Intent Statement</h3>
          <p className="cf-note__sub">
            A private note for when this capsule executes &mdash; why you set it up and anything you&rsquo;d want understood. It&rsquo;s encrypted and delivered to your representative only after execution.
          </p>
          <textarea
            className={`cf-textarea${props.attempted && !props.intent.trim() ? ' cf-input--error' : ''}`}
            value={props.intent}
            maxLength={MAX_INTENT_LENGTH}
            placeholder="Write what you want your beneficiaries to know…"
            onChange={(e) => props.onIntent(e.target.value)}
            aria-label="Intent statement"
          />
          <div className="cf-note__meta">
            <span>{props.attempted && !props.intent.trim() ? <em>Add a short note to continue.</em> : 'Required'}</span>
            <span>{props.intent.length.toLocaleString('en-US')} / {MAX_INTENT_LENGTH.toLocaleString('en-US')}</span>
          </div>
          <div className="cf-note__grid">
            <div>
              <label className="cf-label" htmlFor="cf-email">Representative email</label>
              <input
                id="cf-email"
                type="email"
                className={`cf-input${emailBad || (props.attempted && !props.email.trim()) ? ' cf-input--error' : ''}`}
                value={props.email}
                placeholder="name@example.com"
                autoComplete="email"
                onChange={(e) => props.onEmail(e.target.value)}
              />
              <p className={emailBad || (props.attempted && !props.email.trim()) ? 'cf-field-error' : 'cf-note__meta'}>
                {emailBad ? 'Enter a valid email address.' : props.attempted && !props.email.trim() ? 'Add who should receive your note.' : 'Receives your encrypted note once the capsule executes.'}
              </p>
            </div>
            <label className="cf-toggle">
              <input type="checkbox" className="cf-check" checked={props.reminder} onChange={(e) => props.onReminder(e.target.checked)} />
              <span>
                <strong>Send recurring reminder emails</strong>
                Heres emails your representative about this capsule monthly until it executes or is cancelled.
              </span>
            </label>
          </div>
        </section>
      </div>

      <footer className="cf-foot cf-foot--rule">
        <p className="cf-foot__note">
          <span>This action is secure and can only be executed once.<br />You can change or cancel the conditions before the execution date.</span>
        </p>
        <div className="cf-foot__actions">
          <button type="button" className="cf-btn cf-btn--ghost" onClick={props.onBack}>Back</button>
          <button type="button" className="cf-btn cf-btn--light" onClick={props.onContinue} disabled={!props.canContinue && props.attempted}>Continue</button>
        </div>
      </footer>
    </div>
  )
}
