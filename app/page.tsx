import type { Metadata } from 'next'
import Image, { getImageProps } from 'next/image'
import Link from 'next/link'
import { PrivyLoginButton } from '@/components/PrivyLoginButton'
import { HorizontalSteps } from '@/components/landing/HorizontalSteps'
import { HomeLogoLink } from '@/components/landing/HomeLogoLink'
import { LandingRouteWarmup } from '@/components/landing/LandingRouteWarmup'
import { LegacyCard } from '@/components/landing/LegacyCard'
import { getHeroStats } from '@/lib/landing-stats'
import { ThreadRibbon } from '@/components/landing/ThreadRibbon'
import { RibbonArt } from '@/components/landing/RibbonArt'
import { LandingRibbons } from '@/components/landing/LandingRibbons'
import { Roboto } from 'next/font/google'
import '@/components/landing/landing-v2.css'

// The live "Protected on Heres" card is set in Roboto (per the design), the same font files as the
// capsule builder, so it looks identical on every device instead of falling back to each system font.
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-roboto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { absolute: 'Heres — Leave something that lives on' },
  description: 'Set Your Intents, who gets it and when. Non-custodial digital inheritance and asset continuity on Solana.',
  openGraph: {
    title: 'Heres — Leave something that lives on',
    description: 'Set Your Intents, who gets it and when. Non-custodial digital inheritance and asset continuity on Solana.',
  },
}

const steps = [
  {
    num: '01',
    title: 'Create your intention',
    description: 'Choose what you want to leave behind, and who you want it to reach.',
  },
  {
    num: '02',
    title: 'Set your conditions',
    description: 'Define exactly when your intention should be carried out.',
  },
  {
    num: '03',
    title: 'Stay in control',
    description: 'Review, update, or cancel your intention while you still can.',
  },
  {
    num: '04',
    title: 'Your assets arrive',
    description: 'The protocol carries out your intention automatically. Your assets move directly to your beneficiary\'s wallet, no court process, no waiting on someone else to act, nothing further for either of you to do.',
  },
]

const infraPartners = [
  { name: 'Solana', icon: '/figma/partners/solana.png' },
  { name: 'MagicBlock', icon: '/figma/partners/magicblock.png' },
  { name: 'Helius', icon: '/figma/partners/helius.png' },
  { name: 'Alchemy', icon: '/figma/partners/alchemy.png' },
]

const privacyPartners: { name: string; icon: string; label: React.ReactNode }[] = [
  { name: 'Ship talk', icon: '/figma/partners/shiptalk.png', label: 'Ship talk' },
  { name: 'Superteam', icon: '/figma/partners/superteam.png', label: 'Superteam' },
  { name: 'Superteam Korea', icon: '/figma/partners/superteam-korea.png', label: <>Superteam<br />Korea</> },
  { name: 'Superteam Nigeria', icon: '/figma/partners/superteam-nigeria.png', label: <>Superteam<br />Nigeria</> },
]

const audiences = [
  {
    title: 'Digital Asset holders',
    description: 'Make sure your assets don\'t become inaccessible simply because you\'re no longer around to manage them.',
  },
  {
    title: 'Founders',
    description: 'Define what happens to treasury, vesting or personal holdings.',
  },
  {
    title: 'Families',
    description: 'Pass digital assets to the people who matter to you.',
  },
  {
    title: 'Lost-wallet protection',
    description: 'Define backup addresses or cold storage keys you control to recover orphaned holdings.',
  },
]

const heroImage = {
  alt: 'Parents lifting their child in a meadow',
  fill: true,
  priority: true,
  sizes: '(max-width: 1512px) 100vw, 1512px',
} as const
const { props: heroClean } = getImageProps({ ...heroImage, src: '/figma/hero-wide-bg-clean.png' })
const { props: privacyClean } = getImageProps({ alt: '', width: 372, height: 463, sizes: '372px', src: '/figma/figures/privacy-couple-clean@2x.png' })

// Re-render the static page every 5 minutes so the protocol totals baked into it stay current.
export const revalidate = 300

export default async function HomePage() {
  const heroStats = await getHeroStats()
  return (
    <div className={`hr-site ${roboto.variable}`} id="top">
      <LandingRouteWarmup />
      {/* HEADER */}
      <header className="hr-header">
        <div className="hr-shell hr-header-inner">
          <HomeLogoLink className="hr-brand">
            <Image src="/figma/logo.png" alt="Heres" width={32} height={32} priority />
          </HomeLogoLink>

          <nav className="hr-nav" aria-label="Primary navigation">
            <a href="#how">How it works</a>
            <a href="#why">Why Heres</a>
            <a href="#security">Security</a>
            <Link href="/pricing" prefetch>Pricing</Link>
            <a href="https://doc.heresprotocol.com" target="_blank" rel="noopener noreferrer">Docs</a>
          </nav>

          <div className="hr-header-action">
            <PrivyLoginButton className="hr-login" />
          </div>

          <details className="hr-mobile-menu">
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile navigation">
              <a href="#how">How it works</a>
              <a href="#why">Why Heres</a>
              <a href="#security">Security</a>
              <Link href="/pricing" prefetch>Pricing</Link>
              <a href="https://doc.heresprotocol.com" target="_blank" rel="noopener noreferrer">Docs</a>
            </nav>
          </details>
        </div>
      </header>

      <main>
        <LandingRibbons />
        <noscript>
          <style>{'.hr-art path[data-draw]{stroke-dashoffset:0!important}.hr-art-hero{visibility:visible;opacity:1}'}</style>
        </noscript>
        {/* HERO SECTION */}
        <section className="hr-hero" aria-labelledby="hr-hero-title">
          <div className="hr-hero-bg-wrap">
            {/* Ribbon-free photo; the ribbon is live vector artwork drawn over it (see LandingRibbons). */}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
            <img {...heroClean} className="hr-hero-bg-img" loading="eager" fetchPriority="high" />
            <RibbonArt art="header" window={[0, 0, 1795, 555]} draw="load" layer="hero-photo" className="hr-art-hero" />
          </div>

          <div className="hr-shell hr-hero-content">
            <div className="hr-hero-copy">
              <h1 id="hr-hero-title">
                Leave something that lives on.
              </h1>
              <p>Set Your Intents, who gets it and when.</p>
              <div className="hr-hero-actions">
                <Link className="hr-button hr-button-red hr-create-link" href="/create" prefetch>
                  Create a Capsule
                </Link>
                <a className="hr-button hr-button-outline" href="#how">
                  See how it works
                </a>
              </div>

              <p className="hr-hero-best-work">Get the best work.</p>

              <div className="hr-hero-legacy-card">
                <LegacyCard initialProtocol={heroStats} />
              </div>
            </div>
          </div>
        </section>

        {/* HERO TO MISSION TRANSITION: SILHOUETTE & CONTINUOUS RED RIBBON */}
        <div className="hr-hero-transition" aria-hidden="true">
          <RibbonArt art="header" window={[0, 555, 1795, 204]} draw="load" layer="hero-band" className="hr-art-hero" />
        </div>

        {/* MISSION SECTION */}
        <section className="hr-mission hr-shell" id="why" aria-labelledby="hr-mission-title">
          <div className="hr-mission-grid">
            <div className="hr-mission-copy">
              <span className="hr-eyebrow">OUR MISSION</span>
              <h2 id="hr-mission-title">
                The people who matter to us aren’t always the people we expect.
              </h2>
              <p>
                A partner. A parent. A friend who&apos;s been there longer than family. A child. A pet. Even a cause you&apos;d want to keep going.
              </p>
              <p>
                Heres doesn&apos;t assume who belongs on your list, you decide.
              </p>
              <Link href="/create" className="hr-red-link" prefetch>
                This is for you <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="hr-mission-visual">
              <Image sizes="(max-width: 860px) 100vw, 708px"
                src="/figma/mission/mission-collage-ribbon.png"
                alt="Friends leaping pasture fence, hand reaching to cat, and family preparing food with interwoven continuous red ribbon and protected badge"
                width={708}
                height={637}
                className="hr-mission-composite-img"
              />
            </div>
          </div>
        </section>

        {/* DIGITAL CONTINUITY FULL-BLEED PHOTO */}
        <section className="hr-continuity" aria-labelledby="hr-continuity-title">
          <div className="hr-continuity-bg">
            <Image
              src="/figma/continuity-carry.png"
              alt="Father smiling as he carries his child comfortably on his shoulders"
              fill
              sizes="100vw"
            />
          </div>
          <div className="hr-shell hr-continuity-content">
            <span className="hr-eyebrow">DIGITAL CONTINUITY</span>
            <h2 id="hr-continuity-title">Some things are meant to continue.</h2>
            <p>
              A decision you make today can shape what happens tomorrow. Heres helps carry your intentions forward, even when you&apos;re no longer there to act on them yourself.
            </p>
          </div>
        </section>

        {/* SIMPLE STEPS / HOW IT WORKS (PINNED HORIZONTAL SCROLL) */}
        <HorizontalSteps steps={steps} />

        {/* SILHOUETTES & CONTINUOUS RIBBON BRIDGE */}
        <div className="hr-steps-ribbon-bar" aria-hidden="true">
          <RibbonArt art="how" draw="scroll" pace={0.5} className="hr-art-how" />
          <Image sizes="100vw"
            src="/figma/threads/thread-steps-ground.png"
            alt=""
            width={1512}
            height={368}
            className="hr-thread-ground"
          />
        </div>

        {/* BUILT ON SOLANA (DARK SECTION) */}
        <section className="hr-security-wrap" id="security" aria-labelledby="hr-security-title">
          <div className="hr-shell hr-security-card">
            <span className="hr-eyebrow">BUILT ON SOLANA</span>
            <h2 id="hr-security-title">
              Your intention shouldn&apos;t depend on anyone&apos;s discretion, including ours.
            </h2>
            <p className="hr-security-subhead">
              Built on infrastructure you can verify.
            </p>

            <div className="hr-partner-tiles-row">
              {infraPartners.map((p) => (
                <div className="hr-partner-tile" key={p.name}>
                  <div className="hr-partner-tile-img">
                    <Image
                      src={p.icon}
                      alt={p.name}
                      width={74}
                      height={74}
                    />
                  </div>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>

            <p className="hr-infra-caption">
              Heres Protocol sets this up to run automatically on Solana blockchain infrastructure.
            </p>

            <div className="hr-feature-grid">
              <div className="hr-feature-card">
                <h3>
                  <span className="hr-red-halo-dot" />
                  <span>Programmatic</span>
                </h3>
                <p>Your conditions are enforced automatically by the protocol. No person at Heres reviews, approves, or has discretion over the final distribution.</p>
              </div>
              <div className="hr-feature-card">
                <h3>
                  <span className="hr-red-halo-dot" />
                  <span>Transparent</span>
                </h3>
                <p>
                  Your selected assets, recipients, and execution conditions are shown for review before you create a capsule.
                </p>
              </div>
              <div className="hr-feature-card">
                <h3>
                  <span className="hr-red-halo-dot" />
                  <span>Tested</span>
                </h3>
                <p>Core custody, settlement, delegation, and wallet paths are covered by automated tests and Devnet verification.</p>
              </div>
            </div>

            <p className="hr-disclaimer-text">
              This isn&apos;t a replacement for a will, it&apos;s what happens automatically once the conditions in your will (or simply your own intentions) are met. Talk to a lawyer about your estate; talk to Heres about making sure your digital assets actually reach the people your will can&apos;t always account for.
            </p>

            <a
              href="https://doc.heresprotocol.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hr-button hr-button-red hr-security-action"
            >
              Explore Protocol
            </a>
          </div>
        </section>

        {/* PRIVACY SECTION */}
        <section className="hr-privacy-wrap" id="privacy" aria-labelledby="hr-privacy-title">
          <div className="hr-shell hr-privacy-shell">
            <div className="hr-privacy-copy">
              <h2 id="hr-privacy-title">
                Your inheritance plan is yours.<br />Private by design.
              </h2>
              <p className="hr-privacy-subhead">
                Their information remains sealed until the protocol needs to execute your intention.
              </p>

              <div className="hr-partners-block">
                <div className="hr-partners-label">Our Partners</div>
                <div className="hr-privacy-badges-row">
                  {privacyPartners.map((p) => (
                    <div className="hr-privacy-badge-col" key={p.name}>
                      <div className="hr-badge-img-wrap">
                        <Image
                          src={p.icon}
                          alt={p.name}
                          width={126}
                          height={126}
                        />
                      </div>
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hr-privacy-visual-wrap" aria-hidden="true">
            {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative; alt="" comes from getImageProps */}
            <img {...privacyClean} className="hr-privacy-visual-img" />
          </div>
          {/* >= 1200px: the couple and one continuous ribbon down through "Who it's for" (live artwork). */}
          <RibbonArt art="people" draw="scroll" pace={0.4} className="hr-art-people" />
        </section>

        {/* WHO IT'S FOR */}
        <section className="hr-audience" aria-labelledby="hr-audience-title">
          <div className="hr-audience-thread-wrap" aria-hidden="true">
            <ThreadRibbon name="audience" className="hr-thread-img" />
          </div>
          <div className="hr-shell hr-audience-shell hr-audience-grid">
            <div className="hr-audience-copy">
              <span className="hr-eyebrow">WHO IT’S FOR</span>
              <h2 id="hr-audience-title">Built for people who live on-chain.</h2>
            </div>

            <div className="hr-cards-2x2">
              {audiences.map((item) => (
                <article className="hr-audience-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CLOSE SECTION */}
        <section className="hr-close" aria-labelledby="hr-close-title" id="close">
          <div className="hr-close-thread-wrap" aria-hidden="true">
            <ThreadRibbon name="close" className="hr-thread-img" />
          </div>
          <div className="hr-shell hr-close-shell hr-close-grid">
            <div className="hr-close-copy">
              <h2 id="hr-close-title">
                Because what matters<br />
                doesn’t end with you.
              </h2>
              <p className="hr-close-lines">
                Your stories are different.<br />
                Your relationships are different.<br />
                What you want to leave behind is different.
              </p>
              <p className="hr-close-emphasis">
                Heres just makes sure it actually gets there.
              </p>
              <Link className="hr-button hr-button-red hr-create-link" href="/create" prefetch>
                Create a capsule
              </Link>
            </div>

            <div className="hr-close-visual">
              <div className="hr-close-photo-wrap">
                <Image sizes="(max-width: 860px) 100vw, 552px"
                  src="/figma/close-beach-walk-clean.png"
                  alt="Family walking together away across a natural open horizon"
                  width={552}
                  height={725}
                />
                <RibbonArt art="because" className="hr-art-because" />
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="hr-final" aria-labelledby="hr-final-title">
          <div className="hr-shell hr-final-content">
            <span className="hr-eyebrow">BEGIN YOUR LEGACY</span>
            <h2 id="hr-final-title">Decide what continues.</h2>
            <p>
              Create your intention today and let Heres carry it forward<br className="hr-desktop-br" /> when the time comes.
            </p>
            <a className="hr-final-link" href="https://t.me/heresprotocol" target="_blank" rel="noopener noreferrer">
              Have questions? Talk to us <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="hr-final-dog-walker" aria-hidden="true">
            <RibbonArt art="decide" draw="scroll" pace={0.4} className="hr-art-decide" />
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="hr-footer">
        <div className="hr-shell hr-footer-top">
          <div className="hr-footer-brand-col">
            <HomeLogoLink>
              <Image src="/figma/logo.png" alt="Heres" width={40} height={40} className="hr-footer-logo" />
            </HomeLogoLink>
            <div className="hr-social-links">
              <a href="https://t.me/heresprotocol" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
              </a>
              <a href="https://x.com/Heresprotocol" target="_blank" rel="noopener noreferrer" aria-label="X / Twitter">
                <svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://discord.gg/gMfRwKGYg3" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.73 5.77a18.8 18.8 0 0 0-4.66-1.44l-.57 1.16a17.4 17.4 0 0 0-5 0l-.57-1.16a18.8 18.8 0 0 0-4.66 1.44C1.32 10.15.52 14.42.92 18.64a19 19 0 0 0 5.74 2.9l1.23-2.01c-.68-.26-1.34-.58-1.97-.95l.48-.38c3.8 1.74 7.4 1.74 11.2 0l.48.38c-.63.37-1.29.69-1.97.95l1.23 2.01a19 19 0 0 0 5.74-2.9c.47-4.9-.8-9.14-3.35-12.87ZM8.86 16.05c-1.12 0-2.03-1.02-2.03-2.27s.89-2.27 2.03-2.27c1.15 0 2.05 1.02 2.03 2.27 0 1.25-.89 2.27-2.03 2.27Zm6.28 0c-1.12 0-2.03-1.02-2.03-2.27s.89-2.27 2.03-2.27c1.15 0 2.05 1.02 2.03 2.27 0 1.25-.89 2.27-2.03 2.27Z"/></svg>
              </a>
              <a href="https://www.linkedin.com/company/heres-protocol/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
              </a>
            </div>
            <a href="https://t.me/heresprotocol" target="_blank" rel="noopener noreferrer" className="hr-custodians-link">
              For custodians and institutions <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="hr-footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#how">How It Works</a></li>
              <li><a href="#security">Security</a></li>
              <li><Link href="/pricing" prefetch>Pricing</Link></li>
              <li><a href="https://doc.heresprotocol.com/welcome/how-heres-protocol-works" target="_blank" rel="noopener noreferrer">Protocol</a></li>
              <li><a href="https://doc.heresprotocol.com/reference/faq" target="_blank" rel="noopener noreferrer">FAQ</a></li>
            </ul>
          </div>

          <div className="hr-footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="https://doc.heresprotocol.com/welcome/readme" target="_blank" rel="noopener noreferrer">About</a></li>
              <li><a href="https://t.me/heresprotocol" target="_blank" rel="noopener noreferrer">Contact</a></li>
            </ul>
          </div>

          <div className="hr-footer-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="https://doc.heresprotocol.com" target="_blank" rel="noopener noreferrer">Documentation</a></li>
              <li><a href="https://doc.heresprotocol.com/concepts/fees-limits-statuses" target="_blank" rel="noopener noreferrer">Fees &amp; limits</a></li>
              <li><a href="https://doc.heresprotocol.com/user-guide/manage-a-capsule" target="_blank" rel="noopener noreferrer">Managing a capsule</a></li>
            </ul>
          </div>

          <div className="hr-footer-col">
            <h4>Learn</h4>
            <ul>
              <li><a href="#how">How it works</a></li>
              <li><a href="#why">Why Choose Us</a></li>
              <li><a href="#security">Security</a></li>
              <li><a href="#privacy">Privacy</a></li>
              <li><a href="https://doc.heresprotocol.com" target="_blank" rel="noopener noreferrer">Docs</a></li>
              <li><a href="https://doc.heresprotocol.com/user-guide/create-a-capsule" target="_blank" rel="noopener noreferrer">Tutorials</a></li>
            </ul>
          </div>

          <div className="hr-footer-col">
            <h4>Trust</h4>
            <ul>
              <li><a href="https://doc.heresprotocol.com/concepts/privacy-and-security" target="_blank" rel="noopener noreferrer">Privacy &amp; security</a></li>
              <li><a href="https://doc.heresprotocol.com/getting-started/supported-networks-and-assets" target="_blank" rel="noopener noreferrer">Networks &amp; assets</a></li>
            </ul>
            <div className="hr-footer-trio" aria-hidden="true">
              <Image
                src="/figma/figures/trio.png"
                alt=""
                width={115}
                height={139}
              />
            </div>
          </div>
        </div>

        <div className="hr-shell hr-footer-bottom">
          <span>© 2026 Heres Protocol. All rights reserved.</span>
          <span className="hr-solana-badge">
            <Image src="/logos/solana.svg" alt="" width={28} height={25} unoptimized />
            Powered by Solana
          </span>
        </div>
      </footer>
    </div>
  )
}
