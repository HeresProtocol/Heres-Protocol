// Summary of what a wallet holds, shown on the landing hero's "Your Legacy" card.
// Pure (no imports) so it is shared by the API route and unit-tested directly.

export type WalletLegacySummary = {
  lamports: number
  /** Non-fungible assets (NFTs, compressed NFTs, Core assets). */
  nfts: number
  /** Distinct collections among those NFTs; null when the data source cannot tell (plain RPC). */
  collections: number | null
  /** Fungible tokens with a non-zero balance (SOL itself is not counted). */
  tokens: number
  source: 'das' | 'rpc'
}

const FUNGIBLE_INTERFACES = new Set(['FungibleToken', 'FungibleAsset'])

type DasItem = {
  id?: string
  interface?: string
  burnt?: boolean
  grouping?: Array<{ group_key?: string; group_value?: string }>
  token_info?: { balance?: number | string }
}

/** Summarise Helius DAS getAssetsByOwner items (fetched with showFungible + showNativeBalance). */
export function summarizeDasAssets(items: DasItem[], nativeLamports: number): WalletLegacySummary {
  let nfts = 0
  let tokens = 0
  const collections = new Set<string>()
  for (const item of items) {
    if (!item || item.burnt) continue
    if (FUNGIBLE_INTERFACES.has(item.interface ?? '')) {
      if (Number(item.token_info?.balance ?? 0) > 0) tokens += 1
      continue
    }
    nfts += 1
    const collection = item.grouping?.find((g) => g.group_key === 'collection')?.group_value
    // An NFT outside any verified collection is its own collection of one.
    collections.add(collection ? `c:${collection}` : `n:${item.id ?? nfts}`)
  }
  return { lamports: Math.max(0, nativeLamports || 0), nfts, collections: collections.size, tokens, source: 'das' }
}

type ParsedTokenAmount = { amount: string; decimals: number }

/** Fallback when DAS is unavailable: classify raw token accounts (amount 1, 0 decimals = NFT). */
export function summarizeTokenAccounts(accounts: ParsedTokenAmount[], lamports: number): WalletLegacySummary {
  let nfts = 0
  let tokens = 0
  for (const { amount, decimals } of accounts) {
    if (!/^\d+$/.test(amount) || BigInt(amount) === 0n) continue
    if (decimals === 0 && amount === '1') nfts += 1
    else tokens += 1
  }
  return { lamports: Math.max(0, lamports || 0), nfts, collections: null, tokens, source: 'rpc' }
}
