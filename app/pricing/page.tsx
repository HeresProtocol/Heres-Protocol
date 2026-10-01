import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { PrivyLoginButton } from '@/components/PrivyLoginButton'
import { HomeLogoLink } from '@/components/landing/HomeLogoLink'
import { LandingRouteWarmup } from '@/components/landing/LandingRouteWarmup'
import PricingBackdrop from '@/components/landing/PricingBackdrop'
import '@/components/landing/landing-v2.css'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'One capsule. $2 to create. $2/month while your capsule is active. Non-custodial digital inheritance and asset continuity on Solana.',
  openGraph: {
    title: 'Pricing — Heres Protocol',
    description: 'One capsule. $2 to create. $2/month while your capsule is active.',
  },
}

export default function PricingPage() {
  return (
    <div className="hr-site hr-pricing-page" id="top">
      <LandingRouteWarmup />
      {/* HEADER WITH FLOATING ISLAND */}
      <header className="hr-header">
        <div className="hr-shell hr-header-inner">
          <HomeLogoLink className="hr-brand">
            <Image src="/figma/logo.png" alt="Heres" width={32} height={32} priority />
          </HomeLogoLink>

          <nav className="hr-nav" aria-label="Primary navigation">
            <Link href="/#how">How it works</Link>
            <Link href="/#why">Why Heres</Link>
            <Link href="/#security">Security</Link>
            <Link href="/pricing" className="hr-nav-link-active" aria-current="page">Pricing</Link>
            <a href="https://doc.heresprotocol.com" target="_blank" rel="noopener noreferrer">Docs</a>
          </nav>

          <div className="hr-header-action">
            <PrivyLoginButton className="hr-login" />
          </div>

          <details className="hr-mobile-menu">
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile navigation">
              <Link href="/#how">How it works</Link>
              <Link href="/#why">Why Heres</Link>
              <Link href="/#security">Security</Link>
              <Link href="/pricing" className="hr-nav-link-active" aria-current="page">Pricing</Link>
              <a href="https://doc.heresprotocol.com" target="_blank" rel="noopener noreferrer">Docs</a>
            </nav>
          </details>
        </div>
      </header>

      {/* PHOTO + HAND-DRAWN RIBBON (traced from the reference mockup) */}
      <PricingBackdrop />

      {/* MAIN PRICING CONTENT */}
      <main className="hr-pricing-content-wrap">
        <div className="hr-pricing-card">
          <h1 className="hr-pricing-title">
            One capsule. $2 to create. $2/month
          </h1>

          <ul className="hr-pricing-features">
            <li className="hr-pricing-feature-item">
              <span className="hr-pricing-bullet" aria-hidden="true" />
              <span>$2 one-time creation fee</span>
            </li>
            <li className="hr-pricing-feature-item">
              <span className="hr-pricing-bullet" aria-hidden="true" />
              <span>$2/month while your capsule is active</span>
            </li>
            <li className="hr-pricing-feature-item">
              <span className="hr-pricing-bullet" aria-hidden="true" />
              <span>Cancel anytime</span>
            </li>
            <li className="hr-pricing-feature-item">
              <span className="hr-pricing-bullet" aria-hidden="true" />
              <span>No long-term commitment</span>
            </li>
          </ul>

          <Link href="/create" className="hr-button hr-button-red hr-pricing-btn" prefetch>
            Create a capsule
          </Link>

          <h2 className="hr-pricing-subhead">
            Try before you commit.
          </h2>

          <p className="hr-pricing-subtext">
            Explore Heres on Solana Devnet using test assets with no monetary value. Experience the capsule flow before using real assets.
          </p>

          <Link href="/create?network=devnet" className="hr-pricing-devnet-link" prefetch>
            Try on Devnet <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
