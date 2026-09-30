'use client'

import Link from 'next/link'
import { usePrivy } from '@privy-io/react-auth'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { StepHead } from './CreateShell'
import { IconSpinner } from './ui'

function CapsuleHint() {
  return (
    <p className="cf-connect-card__hint">
      Already have a capsule? Go to <Link href="/dashboard" className="cf-link">My Capsule</Link>
    </p>
  )
}

/** Step 1 before a wallet exists: external wallet (Wallet Adapter) or Privy email wallet. */
export function StepConnect({ onBack }: { onBack: () => void }) {
  const { ready, authenticated, login } = usePrivy()
  const { setVisible } = useWalletModal()
  // Signed in with Privy but the embedded wallet is still being provisioned.
  const provisioning = ready && authenticated

  return (
    <div className="cf-body cf-body--connect">
      <StepHead eyebrow="Step 1 of 4" title="Connect your wallet" sub="Connect your wallet to see your real balances and continue." />
      <div className="cf-content">
        <section className="cf-why" aria-labelledby="cf-why-title">
          <h2 className="cf-why__title" id="cf-why-title">Why we ask you to connect now</h2>
          <ul>
            <li>We read your wallet&rsquo;s balances so you can choose exact amounts, nothing moves or locks yet.</li>
            <li>We check you don&rsquo;t already have an active capsule, so you never configure one you can&rsquo;t create.</li>
            <li>Connecting only lets us read public balances. No transaction happens until you sign at Step 4.</li>
          </ul>
        </section>

        <div className="cf-connect-grid">
          <div className="cf-connect-card">
            <h2>Connect with wallet</h2>
            <button type="button" className="cf-btn cf-btn--light" onClick={() => setVisible(true)}>
              Connect
            </button>
            <CapsuleHint />
          </div>
          <div className="cf-connect-card">
            <h2>Sign in with email</h2>
            <p>
              We&rsquo;ll create a new wallet for you automatically &mdash; separate from any wallet you already have. No seed
              phrase, no browser extension required.
            </p>
            <button
              type="button"
              className="cf-btn cf-btn--light"
              disabled={!ready || provisioning}
              onClick={() => login({ loginMethods: ['email'] })}
            >
              {provisioning ? <><IconSpinner /> Preparing</> : 'Sign in'}
            </button>
            <CapsuleHint />
          </div>
        </div>
      </div>
      <footer className="cf-foot">
        <p className="cf-foot__note">You can review beneficiary and capsule creation options after signing in</p>
        <div className="cf-foot__actions">
          <button type="button" className="cf-btn cf-btn--ghost" onClick={onBack}>Back</button>
          <button type="button" className="cf-btn cf-btn--light" disabled>Continue</button>
        </div>
      </footer>
    </div>
  )
}
