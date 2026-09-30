'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PublicKey, StakeProgram } from '@solana/web3.js'
import type { WalletFungibleAsset } from '@/lib/fungible-assets'
import { getSolanaConnection, getSolanaFallbackConnection } from '@/config/solana'
import { SOLANA_CONFIG } from '@/constants'

export const WSOL_MINT = 'So11111111111111111111111111111111111111112'

export type TokenMeta = { symbol: string; name: string; icon: string | null; usdPrice: number | null }

/** Colour per asset, shared by the recipient chips and the review list. */
export const ASSET_COLORS = ['#9747ff', '#10b981', '#f59e0b', '#ec4899', '#47f0ff', '#ddf542', '#ff9447', '#5047e8']
export const RECIPIENT_COLORS = ['#5047e8', '#0a9587', '#b35504', '#b8327b', '#2f7fd8', '#7a8a1d', '#8b4bd6', '#c0392b']

export type CatalogAsset = WalletFungibleAsset & {
  displaySymbol: string
  name: string
  icon: string | null
  usdPrice: number | null
  color: string
}

/**
 * Token names, icons and USD prices come from Jupiter's public token API (mainnet listings).
 * On devnet most mints are unknown to it, so those fall back to the shortened mint; SOL still
 * gets an indicative price. Any failure simply leaves names/prices empty — nothing blocks.
 */
export function useTokenMeta(mints: string[]) {
  const key = [...new Set([WSOL_MINT, ...mints])].sort()
  return useQuery({
    queryKey: ['create', 'token-meta', key.join(',')],
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<Record<string, TokenMeta>> => {
      const out: Record<string, TokenMeta> = {}
      for (let i = 0; i < key.length; i += 100) {
        const batch = key.slice(i, i + 100)
        const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${batch.join(',')}`)
        if (!res.ok) continue
        const rows: Array<{ id?: string; symbol?: string; name?: string; icon?: string; usdPrice?: number }> = await res.json()
        for (const row of Array.isArray(rows) ? rows : []) {
          if (!row?.id || !batch.includes(row.id)) continue
          out[row.id] = {
            symbol: row.symbol || '',
            name: row.name || '',
            icon: row.icon || null,
            usdPrice: typeof row.usdPrice === 'number' && row.usdPrice > 0 ? row.usdPrice : null,
          }
        }
      }
      return out
    },
  })
}

/** Total SOL the wallet has in stake accounts (shown for context; staked SOL can't go in a capsule). */
export function useStakedSol(owner: PublicKey | null) {
  return useQuery({
    queryKey: ['create', 'staked-sol', owner?.toBase58() ?? ''],
    enabled: Boolean(owner),
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async (): Promise<number> => {
      // Stake account layout: authorized.staker starts at byte 12.
      const filters = [{ memcmp: { offset: 12, bytes: owner!.toBase58() } }]
      const accounts = await getSolanaConnection()
        .getParsedProgramAccounts(StakeProgram.programId, { filters })
        .catch(() => getSolanaFallbackConnection().getParsedProgramAccounts(StakeProgram.programId, { filters }))
      const lamports = accounts.reduce((sum, a) => sum + a.account.lamports, 0)
      return lamports / 1e9
    },
  })
}

export function useAssetCatalog(walletAssets: WalletFungibleAsset[]) {
  const mints = walletAssets.map((a) => a.mint).filter((m): m is string => Boolean(m))
  const meta = useTokenMeta(mints)
  const catalog = useMemo<CatalogAsset[]>(() => {
    const m = meta.data ?? {}
    return walletAssets.map((asset, index) => {
      const info = asset.mint ? m[asset.mint] : m[WSOL_MINT]
      const isSol = !asset.mint
      return {
        ...asset,
        displaySymbol: isSol ? 'SOL' : info?.symbol || asset.symbol,
        name: isSol ? 'Solana' : info?.name || 'Unknown token',
        icon: isSol ? null : info?.icon ?? null,
        usdPrice: info?.usdPrice ?? null,
        color: ASSET_COLORS[index % ASSET_COLORS.length],
      }
    })
  }, [walletAssets, meta.data])
  const solPrice = meta.data?.[WSOL_MINT]?.usdPrice ?? null
  return { catalog, solPrice, metaLoading: meta.isLoading }
}

export const isDevnet = SOLANA_CONFIG.NETWORK !== 'mainnet-beta'
