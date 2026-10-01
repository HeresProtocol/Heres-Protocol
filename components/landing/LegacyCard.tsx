'use client'

import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { getSolanaConnection } from '@/config/solana'
import { useDashboardSummary } from '@/hooks/queries/useDashboardSummary'
import { useOwnedCapsuleOverview } from '@/hooks/queries/useOwnedCapsuleOverview'
import type { WalletLegacySummary } from '@/lib/wallet-legacy'
import type { HeroStatsData } from '@/lib/landing-stats'

// Live version of the hero's "Your Legacy" card (previously a static image).
// Connected wallet -> that wallet's real holdings and whether a capsule protects them.
// No wallet -> live Heres protocol totals. Values are never invented: while loading
// they show a skeleton, and on failure a dash.

const LAMPORTS_PER_SOL = 1_000_000_000
const WALLET_POLL_MS = 20_000
const PROTOCOL_POLL_MS = 60_000

const fmtSol = (lamports: number) =>
  (lamports / LAMPORTS_PER_SOL).toLocaleString('en-US', { maximumFractionDigits: 3 })
const fmtCount = (n: number) => n.toLocaleString('en-US')
const plural = (n: number, one: string, many: string) => `${fmtCount(n)} ${n === 1 ? one : many}`

/* ---------- icons (white glyphs on the dark tiles, drawn to match the original card) ---------- */
const SolIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.8 4.2h14l-2.8 3.6H4zM4 10.2h14l2.8 3.6h-14zM6.8 16.2h14L18 19.8H4z" fill="currentColor" />
  </svg>
)
const NftIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
    <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z" />
    <path d="m7.6 15.2 3.1-3.4 2.3 2.4 1.6-1.6 2.2 2.6" strokeLinecap="round" />
    <circle cx="14.6" cy="9.3" r="1.25" fill="currentColor" stroke="none" />
  </svg>
)
const TokenIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.6 20.2 7.3v9.4L12 21.4l-8.2-4.7V7.3z" fill="currentColor" />
    <path d="M12 12.4 7.4 9.7M12 12.4l4.6-2.7M12 12.4v5.4" stroke="#221c26" strokeWidth="1.9" strokeLinecap="round" fill="none" />
  </svg>
)
const CoinsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="15.4" cy="8.6" r="6.1" fill="currentColor" />
    <circle cx="8.8" cy="15.2" r="6.6" fill="currentColor" stroke="#221c26" strokeWidth="1.7" />
    <path d="M8.8 12.2v6M5.8 15.2h6" stroke="#221c26" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 19 5.8v5.6c0 4.3-2.9 7.9-7 9.6-4.1-1.7-7-5.3-7-9.6V5.8z" />
    <path d="m8.8 12 2.2 2.2 4.2-4.4" />
  </svg>
)

type Row = { key: string; icon: ReactNode; title: string; value: string | null; error?: boolean }

function LegacyRows({ rows }: { rows: Row[] }) {
  return (
    <ul className="hr-legacy__rows">
      {rows.map((row) => (
        <li className="hr-legacy__row" key={row.key}>
          <span className="hr-legacy__tile">{row.icon}</span>
          <span className="hr-legacy__text">
            <span className="hr-legacy__title">{row.title}</span>
            {row.value === null ? (
              <span className="hr-legacy__skel" aria-label="Loading" />
            ) : (
              <span className={`hr-legacy__value${row.error ? ' is-muted' : ''}`}>{row.value}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

function useWalletLegacy(address: string | null) {
  const query = useQuery({
    queryKey: ['landing', 'wallet-legacy', address ?? ''],
    enabled: Boolean(address),
    refetchInterval: WALLET_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    retry: 1,
    queryFn: async (): Promise<WalletLegacySummary> => {
      const res = await fetch(`/api/wallet/legacy?wallet=${encodeURIComponent(address!)}`)
      if (!res.ok) throw new Error(`Holdings API failed with ${res.status}`)
      return (await res.json()).summary as WalletLegacySummary
    },
  })

  // Push updates: refetch as soon as the wallet's account changes on-chain, instead of
  // waiting for the next poll. Polling stays as the fallback if the socket is unavailable.
  const { refetch } = query
  useEffect(() => {
    if (!address) return
    let id: number | null = null
    let connection: ReturnType<typeof getSolanaConnection> | null = null
    try {
      connection = getSolanaConnection()
      id = connection.onAccountChange(
        new PublicKey(address),
        () => { void refetch() },
        { commitment: 'confirmed' }
      )
    } catch {
      // websocket unsupported by this RPC; polling covers it
    }
    return () => {
      if (connection && id !== null) void connection.removeAccountChangeListener(id).catch(() => {})
    }
  }, [address, refetch])

  return query
}

export function LegacyCard({ initialProtocol = null }: { initialProtocol?: HeroStatsData | null }) {
  const { wallet, query: capsuleQuery } = useOwnedCapsuleOverview()
  const address = wallet.connected && wallet.publicKey ? wallet.publicKey.toBase58() : null
  const holdings = useWalletLegacy(address)
  const protocol = useDashboardSummary()

  const { refresh: refreshProtocol } = protocol
  useEffect(() => {
    if (address) return
    const timer = window.setInterval(refreshProtocol, PROTOCOL_POLL_MS)
    return () => window.clearInterval(timer)
  }, [address, refreshProtocol])

  if (address) {
    const h = holdings.data
    const failed = holdings.isError && !h
    const capsule = capsuleQuery.data
    const protectedNow = Boolean(capsule && capsule.isActive && !capsule.executedAt)
    const capsuleValue = capsuleQuery.isLoading
      ? null
      : capsuleQuery.isError
        ? 'Status unavailable'
        : !capsule
          ? 'Not protected yet'
          : capsule.executedAt
            ? 'Delivered'
            : capsule.isActive
              ? 'Secured'
              : 'Paused'

    const rows: Row[] = [
      { key: 'sol', icon: <SolIcon />, title: 'Sol', value: failed ? '—' : h ? `${fmtSol(h.lamports)} Sol` : null, error: failed },
      {
        key: 'nfts',
        icon: <NftIcon />,
        title: 'NFTs',
        value: failed ? '—' : h ? (h.collections === null ? plural(h.nfts, 'NFT', 'NFTs') : plural(h.collections, 'Collection', 'Collections')) : null,
        error: failed,
      },
      { key: 'tokens', icon: <TokenIcon />, title: 'Tokens', value: failed ? '—' : h ? plural(h.tokens, 'Asset', 'Assets') : null, error: failed },
      { key: 'digital', icon: <CoinsIcon />, title: 'Digital assets', value: capsuleValue, error: !protectedNow },
    ]

    return (
      <section className="hr-legacy" aria-label="Your Legacy" aria-live="polite">
        <p className="hr-legacy__label">Your Legacy</p>
        <p className="hr-legacy__status">
          <span className={`hr-legacy__dot${protectedNow ? '' : ' is-idle'}`} aria-hidden="true" />
          {protectedNow ? 'Onchain & Protected' : 'Onchain · Not protected'}
        </p>
        <LegacyRows rows={rows} />
      </section>
    )
  }

  // Server-rendered totals show instantly; the live query replaces them as soon as it answers.
  const live = protocol.lastUpdated !== null || (!protocol.isLoading && !protocol.error)
  const s = live || !initialProtocol
    ? protocol.summary
    : { ...protocol.summary, total: initialProtocol.total, active: initialProtocol.active, executed: initialProtocol.executed, activeValueLockedLamports: initialProtocol.securedLamports }
  const ready = live || Boolean(initialProtocol)
  const failed = Boolean(protocol.error) && protocol.lastUpdated === null && !initialProtocol
  const val = (text: string) => (failed ? '—' : ready ? text : null)
  const rows: Row[] = [
    { key: 'sol', icon: <SolIcon />, title: 'Sol', value: val(`${fmtSol(s.activeValueLockedLamports)} Sol secured`), error: failed },
    { key: 'active', icon: <ShieldIcon />, title: 'Active capsules', value: val(`${fmtCount(s.active)} protecting now`), error: failed },
    { key: 'created', icon: <TokenIcon />, title: 'Capsules created', value: val(`${fmtCount(s.total)} all time`), error: failed },
    { key: 'settled', icon: <CoinsIcon />, title: 'Delivered', value: val(plural(s.executed, 'capsule settled', 'capsules settled')), error: failed },
  ]

  return (
    <section className="hr-legacy" aria-label="Protected on Heres" aria-live="polite">
      <p className="hr-legacy__label">Protected on Heres</p>
      <p className="hr-legacy__status">
        <span className="hr-legacy__dot" aria-hidden="true" />
        Live onchain
      </p>
      <LegacyRows rows={rows} />
    </section>
  )
}
