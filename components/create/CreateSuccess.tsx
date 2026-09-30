'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

export type CreateSuccessDetails = {
  capsuleId: string
  capsuleAddress?: string
  recipientNames: string[]
  totalLocked: string
  recipients: number
  trigger: string
  triggerLabel: string
}

export function CreateSuccess(props: CreateSuccessDetails) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const names = props.recipientNames
  const who =
    names.length === 0
      ? 'Your beneficiaries'
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return (
    <div className="cf-card cf-card--success" role="status" aria-live="polite">
      <span className="cf-done" aria-hidden>
        <svg viewBox="0 0 24 24"><path d="M5.5 12.5l4 4L18.5 7.5" pathLength={1} /></svg>
      </span>
      <h1 ref={heading} tabIndex={-1} className="cf-success-title">Your capsule is live.</h1>
      <p className="cf-success-sub">
        {who} will receive your assets under the conditions you set. You can check on it or cancel it any time from your dashboard.
      </p>
      <p className="cf-success-id" title={props.capsuleAddress}>Capsule {props.capsuleId}</p>
      <div className="cf-stats">
        <div className="cf-stat"><strong>{props.totalLocked}</strong><span>Total locked</span></div>
        <div className="cf-stat"><strong>{props.recipients}</strong><span>Recipients</span></div>
        <div className="cf-stat"><strong>{props.trigger}</strong><span>{props.triggerLabel}</span></div>
      </div>
      <p className="cf-sealed">
        <strong>Your assets are now sealed</strong> and inaccessible while this capsule is active. Cancel any time from your dashboard to restore full access.
      </p>
      <div className="cf-success-actions">
        <Link href="/dashboard" className="cf-btn cf-btn--light">Go to dashboard</Link>
        <Link href={props.capsuleAddress ? `/capsules/${props.capsuleAddress}` : '/dashboard'}>View this capsule</Link>
      </div>
    </div>
  )
}
