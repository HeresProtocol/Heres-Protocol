import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getSolanaConnection, getSolanaFallbackConnection, isValidSolanaAddress } from '@/config/solana'
import { fetchHeliusJson } from '@/lib/helius-client'
import { getHeliusRpcUrl } from '@/lib/helius'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@/lib/spl'
import { summarizeDasAssets, summarizeTokenAccounts, type WalletLegacySummary } from '@/lib/wallet-legacy'

// Read-only holdings summary for the landing "Your Legacy" card. Public on-chain data only,
// no signatures. The card polls this, so results are cached briefly per wallet.
// Fresh for 15s; after that the last value is served instantly while one background refresh runs
// (stale-while-revalidate), so a slow public RPC never makes the card wait twice.
const FRESH_MS = 15_000
const STALE_MS = 5 * 60_000
const MAX_PAGES = 5
const PAGE_SIZE = 1000
const cache = new Map<string, { summary: WalletLegacySummary; fetchedAt: number }>()
const inFlight = new Map<string, Promise<WalletLegacySummary>>()

async function fromDas(rpcUrl: string, owner: string): Promise<WalletLegacySummary> {
  const items: unknown[] = []
  let nativeLamports = 0
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await fetchHeliusJson<any>(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'legacy',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: owner,
          page,
          limit: PAGE_SIZE,
          displayOptions: { showFungible: true, showNativeBalance: true, showZeroBalance: false },
        },
      }),
    })
    if (data?.error) throw new Error(data.error.message || 'Helius DAS error')
    const result = data?.result
    if (!result || !Array.isArray(result.items)) throw new Error('Unexpected DAS response')
    if (page === 1) nativeLamports = Number(result.nativeBalance?.lamports ?? 0)
    items.push(...result.items)
    if (result.items.length < PAGE_SIZE) break
  }
  return summarizeDasAssets(items as never, nativeLamports)
}

async function fromRpc(owner: string): Promise<WalletLegacySummary> {
  const ownerKey = new PublicKey(owner)
  const read = async (connection: ReturnType<typeof getSolanaConnection>) => {
    const [lamports, ...programs] = await Promise.all([
      connection.getBalance(ownerKey),
      ...[TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) =>
        connection.getParsedTokenAccountsByOwner(ownerKey, { programId })
      ),
    ])
    const amounts = (programs as Awaited<ReturnType<typeof connection.getParsedTokenAccountsByOwner>>[]).flatMap((res) =>
      res.value.map(({ account }) => (account.data as any).parsed?.info?.tokenAmount).filter(Boolean)
    )
    return summarizeTokenAccounts(amounts, lamports as number)
  }
  try {
    return await read(getSolanaConnection())
  } catch {
    return read(getSolanaFallbackConnection())
  }
}

async function readHoldings(wallet: string): Promise<WalletLegacySummary> {
  const rpcUrl = getHeliusRpcUrl()
  try {
    if (!rpcUrl) throw new Error('Helius not configured')
    return await fromDas(rpcUrl, wallet)
  } catch {
    return fromRpc(wallet)
  }
}

/** One lookup per wallet at a time; concurrent callers share it. Cache time is taken on completion. */
function refresh(wallet: string): Promise<WalletLegacySummary> {
  const pending = inFlight.get(wallet)
  if (pending) return pending
  const job = readHoldings(wallet)
    .then((summary) => {
      cache.set(wallet, { summary, fetchedAt: Date.now() })
      if (cache.size > 2000) cache.delete(cache.keys().next().value as string)
      return summary
    })
    .finally(() => inFlight.delete(wallet))
  inFlight.set(wallet, job)
  return job
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.trim() || ''
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: 'A valid wallet address is required' }, { status: 400 })
  }

  const headers = { 'Cache-Control': 'private, max-age=10' }
  const hit = cache.get(wallet)
  const age = hit ? Date.now() - hit.fetchedAt : Infinity
  if (hit && age < FRESH_MS) return NextResponse.json({ summary: hit.summary, timestamp: hit.fetchedAt }, { headers })
  if (hit && age < STALE_MS) {
    void refresh(wallet).catch(() => {})
    return NextResponse.json({ summary: hit.summary, timestamp: hit.fetchedAt, stale: true }, { headers })
  }

  try {
    const summary = await refresh(wallet)
    return NextResponse.json({ summary, timestamp: Date.now() }, { headers })
  } catch {
    return NextResponse.json({ error: 'Unable to read wallet holdings right now' }, { status: 503 })
  }
}
