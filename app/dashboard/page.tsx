'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'
import { CreateShell } from '@/components/create/CreateShell'
import { CREATE_RIBBONS } from '@/components/create/ribbons'
import { useOwnedCapsuleOverview } from '@/hooks/queries/useOwnedCapsuleOverview'
import { useAssetCatalog, isDevnet } from '@/components/create/useAssetCatalog'
import { formatBaseUnits, type WalletFungibleAsset } from '@/lib/fungible-assets'
import { dashboardStatus } from '@/lib/dashboard-status'
import { fmtAmount, fmtUsd, maskAddr } from '@/components/create/ui'
import {
  agoWords,
  capsuleCode,
  capsuleTitle,
  formatRemaining,
  joinNames,
  longDate,
  readCapsuleLabels,
  triggerShort,
  type CapsuleLabels,
} from '@/components/dashboard/meta'
import { HdIcon } from '@/components/dashboard/icons'

type Tone = 'ok' | 'warn' | 'done' | 'muted'

export default function DashboardPage() {
  const router = useRouter()
  const { wallet, query, vault } = useOwnedCapsuleOverview()
  const { login } = usePrivy()
  const { setVisible } = useWalletModal()
  const external = useSolanaWallet()
  const capsule = query.data ?? null

  // A remembered wallet reconnects a moment after load; wait for it so "Connect" never flashes.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 700)
    return () => clearTimeout(t)
  }, [])
  const booting = !wallet.connected && (!settled || external.connecting)

  // Names typed at creation live in this browser only (see meta.ts).
  const [labels, setLabels] = useState<CapsuleLabels | null>(null)
  useEffect(() => setLabels(readCapsuleLabels(capsule?.capsuleAddress)), [capsule?.capsuleAddress])

  /* ---------- vault value ---------- */
  const held = useMemo<WalletFungibleAsset[]>(
    () =>
      vault.data
        ? [
            { key: 'sol', mint: null, decimals: 9, symbol: 'SOL', balanceUi: vault.data.sol / 1e9, balanceBaseUnits: BigInt(vault.data.sol), tokenProgram: null },
            ...vault.data.tokens.map((t) => ({
              key: t.mint.toBase58(),
              mint: t.mint.toBase58(),
              decimals: t.decimals,
              symbol: maskAddr(t.mint.toBase58(), 4, 4),
              balanceUi: Number(formatBaseUnits(t.amount, t.decimals)),
              balanceBaseUnits: t.amount,
              tokenProgram: t.tokenProgram.toBase58(),
            })),
          ]
        : [],
    [vault.data]
  )
  const { catalog } = useAssetCatalog(held)
  const funded = catalog.filter((a) => (a.balanceBaseUnits ?? 0n) > 0n)
  const totalUsd = funded.length && funded.every((a) => a.usdPrice != null) ? funded.reduce((s, a) => s + (a.balanceUi ?? 0) * (a.usdPrice ?? 0), 0) : null
  const valueText = vault.isError
    ? 'Unavailable'
    : vault.isPending
      ? null
      : totalUsd != null
        ? fmtUsd(totalUsd)
        : funded.length === 1
          ? `${fmtAmount(funded[0].balanceUi)} ${funded[0].displaySymbol}`
          : funded.length
            ? `${funded.length} assets`
            : fmtUsd(0)

  /* ---------- capsule facts ---------- */
  const st = capsule ? dashboardStatus(capsule) : null
  const addresses = capsule?.beneficiaries.map((b) => b.pubkey.toBase58()) ?? []
  const labelNames = Object.values(labels?.names ?? {})
  const recipientCount = addresses.length || (capsule?.nftAssignments?.length ? new Set(capsule.nftAssignments.map((a) => a.recipient.toBase58())).size : 0) || labelNames.length
  const recipientText = addresses.length
    ? joinNames(addresses.map((a) => labels?.names[a] || maskAddr(a, 4, 4)))
    : labelNames.length
      ? joinNames(labelNames)
      : 'Private'
  const title = capsule ? capsuleTitle(labels, addresses) : ''
  const dateOnly = capsule?.targetDate != null && capsule.inactivityPeriod >= 90 * 365 * 86400

  const phase: 'active' | 'soon' | 'due' | 'executed' | 'draft' | null = !capsule
    ? null
    : capsule.executedAt
      ? 'executed'
      : !capsule.isActive
        ? 'draft'
        : st!.remaining === 0
          ? 'due'
          : st!.urgent
            ? 'soon'
            : 'active'
  const remaining = st ? formatRemaining(st.remaining) : ''
  const statusChip: { tone: Tone; text: string } =
    phase === 'soon' ? { tone: 'warn', text: `${remaining} left` }
      : phase === 'due' ? { tone: 'warn', text: 'Trigger reached' }
        : phase === 'executed' ? { tone: 'done', text: 'Executed' }
          : phase === 'draft' ? { tone: 'warn', text: 'Setup incomplete' }
            : { tone: 'ok', text: 'Active' }
  const statusCol: { tone: Tone; text: string } =
    phase === 'soon' ? { tone: 'warn', text: `in ${remaining} transfers` }
      : phase === 'due' ? { tone: 'warn', text: 'Awaiting execution' }
        : phase === 'executed' ? { tone: 'done', text: 'Transferring to recipients' }
          : phase === 'draft' ? { tone: 'warn', text: 'Finish or recover setup' }
            : { tone: 'muted', text: `${remaining} remaining` }
  const listHeading = phase === 'soon' || phase === 'due' ? 'Needs attention' : phase === 'executed' ? 'Executed' : phase === 'draft' ? 'Setup incomplete' : 'Active'
  const detailHref = capsule ? `/capsules/${capsule.capsuleAddress}` : '/dashboard'

  const banner = !capsule ? null : phase === 'active'
    ? {
        tone: 'ok' as Tone,
        icon: 'check' as const,
        title: dateOnly ? `Scheduled for ${longDate(capsule.targetDate!)}` : `You were last active ${agoWords(capsule.lastActivity)}`,
        text: dateOnly
          ? 'This capsule transfers on a fixed date. Wallet activity doesn’t change it. You can delete it any time before then.'
          : 'Any wallet transaction resets the clock on your inactivity-based capsule. You’re not close to triggering it.',
      }
    : phase === 'soon'
      ? {
          tone: 'warn' as Tone,
          icon: 'alert' as const,
          title: `Your capsule transfers in ${remaining}`,
          text: dateOnly ? 'It is set to transfer on a fixed date. Delete it before then if your plans changed.' : 'Use your wallet or check in to reset the clock if you’re not ready for it to carry out.',
        }
      : phase === 'due'
        ? { tone: 'warn' as Tone, icon: 'alert' as const, title: 'Your capsule’s trigger has been reached', text: 'It’s waiting to execute. Open it to follow each settlement step.' }
        : phase === 'executed'
          ? { tone: 'done' as Tone, icon: 'check' as const, title: 'Your capsule has executed', text: 'Assets are being transferred to your recipients. Open it to follow settlement.' }
          : { tone: 'warn' as Tone, icon: 'alert' as const, title: 'This capsule’s setup didn’t finish', text: 'It can’t execute in this state, and your assets are safe. Open it to recover them or delete it and start again.' }

  /* ---------- row menu ---------- */
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [menuOpen])

  const refreshing = query.isFetching || vault.isFetching
  const header = (
    <header className="hd-head">
      <div>
        <h1 className="hd-title">Your capsules</h1>
        <p className="hd-sub">Everything you’ve set up, and what’s happening with each one.</p>
      </div>
      <div className="hd-head__actions">
        {wallet.publicKey && (
          <span className="hd-wallet" title={wallet.publicKey.toBase58()}>
            <i className={query.isError ? 'is-warn' : ''} />
            {maskAddr(wallet.publicKey.toBase58(), 6, 4)}
          </span>
        )}
        {wallet.connected && !query.isPending && !query.isError && !capsule && (
          <Link href="/create" className="cf-btn cf-btn--red hd-new">
            <HdIcon.Plus /> New capsule
          </Link>
        )}
      </div>
    </header>
  )

  let body: React.ReactNode
  if (booting) {
    body = <DashboardSkeleton />
  } else if (!wallet.connected) {
    body = (
      <section className="hd-empty">
        <span className="hd-empty__icon"><HdIcon.Wallet /></span>
        <h2>Connect to see your capsules</h2>
        <p>Your dashboard follows the wallet you connect. Nothing moves and nothing is signed just by connecting.</p>
        <div className="hd-empty__actions">
          <button type="button" className="cf-btn cf-btn--light" onClick={() => setVisible(true)}>Connect wallet</button>
          <button type="button" className="cf-btn cf-btn--ghost" onClick={() => login({ loginMethods: ['email'] })}>Sign in with email</button>
        </div>
      </section>
    )
  } else if (query.isPending) {
    body = <DashboardSkeleton />
  } else if (query.isError) {
    body = (
      <section className="hd-empty" role="alert">
        <span className="hd-empty__icon hd-empty__icon--warn"><HdIcon.Alert /></span>
        <h2>We couldn’t load your capsule</h2>
        <p>{query.error.message}</p>
        <div className="hd-empty__actions">
          <button type="button" className="cf-btn cf-btn--light" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </section>
    )
  } else if (!capsule) {
    body = (
      <section className="hd-empty">
        <span className="hd-empty__icon"><HdIcon.Hourglass /></span>
        <h2>No capsules yet</h2>
        <p>When you create one, it’ll show up here — with everything you set: assets, recipients, and the conditions for when it carries out.</p>
        <Link href="/create" className="cf-btn cf-btn--red hd-new"><HdIcon.Plus /> New capsule</Link>
      </section>
    )
  } else {
    body = (
      <>
        {banner && (
          <section className={`hd-banner hd-banner--${banner.tone}`}>
            <span className="hd-banner__icon">{banner.icon === 'check' ? <HdIcon.Check /> : <HdIcon.Alert />}</span>
            <div>
              <h2>{banner.title}</h2>
              <p>{banner.text}</p>
            </div>
            {(phase === 'soon' || phase === 'due' || phase === 'executed' || phase === 'draft') && (
              <Link href={detailHref} className="cf-btn cf-btn--light hd-banner__cta">
                {phase === 'soon' && !dateOnly ? 'Check in' : 'Open capsule'}
              </Link>
            )}
          </section>
        )}

        <dl className="hd-stats">
          <div className="hd-stat">
            <dd>{valueText ?? <span className="cf-skel-line" />}</dd>
            <dt>Total value locked{isDevnet && totalUsd != null && <span className="cf-tag" title="Devnet balances priced at mainnet rates, for reference only">Indicative</span>}</dt>
          </div>
          <div className="hd-stat">
            <dd>{capsule.isActive && !capsule.executedAt ? 1 : 0}</dd>
            <dt>Active capsules</dt>
          </div>
          <div className="hd-stat">
            <dd>{recipientCount || '—'}</dd>
            <dt>Total recipients</dt>
          </div>
        </dl>

        <div className="hd-list-h">
          <h2>{listHeading}</h2>
          <button type="button" className="hd-refresh" onClick={() => { void query.refetch(); void vault.refetch() }} disabled={refreshing} aria-label="Refresh">
            <HdIcon.Refresh className={refreshing ? 'hd-spin' : undefined} /> {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        <article className="hd-row">
          <Link href={detailHref} className="hd-row__link" aria-label={`Open ${title}`} />
          <div className="hd-row__name">
            <h3>{title}</h3>
            <p>
              <span className="hd-code" title={capsule.capsuleAddress}>#{capsuleCode(capsule.capsuleAddress)}</span>
              <span className={`hd-chip hd-chip--${statusChip.tone}`}>
                {statusChip.tone === 'warn' ? <HdIcon.Alert /> : <i />}
                {statusChip.text}
              </span>
            </p>
          </div>
          <div className="hd-row__col">
            <span className="hd-label">Value</span>
            <strong>{valueText ?? <span className="cf-skel-line cf-skel-line--sm" />}</strong>
          </div>
          <div className="hd-row__col">
            <span className="hd-label">Recipients</span>
            <span title={recipientText === 'Private' ? 'Recipients stay private until the capsule executes' : undefined}>{recipientText}</span>
          </div>
          <div className="hd-row__col">
            <span className="hd-label">Trigger</span>
            <span>{triggerShort(capsule.inactivityPeriod, capsule.targetDate)}</span>
          </div>
          <div className="hd-row__col">
            <span className="hd-label">Status</span>
            <span className={`hd-tone--${statusCol.tone}`}>{statusCol.text}</span>
          </div>
          <div className="hd-row__menu" ref={menuRef}>
            <button type="button" className="hd-dots" aria-label="Capsule actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <HdIcon.Dots />
            </button>
            {menuOpen && (
              <div className="hd-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => router.push(detailHref)}><HdIcon.Eye /> View details</button>
                {!capsule.executedAt && (
                  <button type="button" role="menuitem" className="is-danger" onClick={() => router.push(`${detailHref}?delete=1`)}><HdIcon.Trash /> Delete capsule</button>
                )}
              </div>
            )}
          </div>
        </article>

        {vault.isError && <p className="hd-note hd-note--warn" role="alert">Vault balances couldn’t be loaded. Refresh to try again. Your capsule itself is fine.</p>}
        <p className="hd-note">One active capsule per wallet at a time. To set up a different plan, delete this one first — your assets return to your wallet — then create as many new ones as you like.</p>
      </>
    )
  }

  return (
    <CreateShell ribbons={CREATE_RIBBONS}>
      <div className="cf-card hd-card">
        {header}
        <div className="hd-body" key={booting ? 'boot' : !wallet.connected ? 'connect' : query.isPending ? 'loading' : capsule ? 'capsule' : 'empty'}>
          {body}
        </div>
      </div>
    </CreateShell>
  )
}

function DashboardSkeleton() {
  return (
    <div className="hd-skeleton" role="status" aria-label="Loading your capsules">
      <div className="hd-sk hd-sk--banner" />
      <div className="hd-stats">
        <div className="hd-sk hd-sk--stat" />
        <div className="hd-sk hd-sk--stat" />
        <div className="hd-sk hd-sk--stat" />
      </div>
      <div className="hd-sk hd-sk--h" />
      <div className="hd-sk hd-sk--row" />
    </div>
  )
}
