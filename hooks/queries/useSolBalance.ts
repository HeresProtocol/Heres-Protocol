'use client'

import { useQuery } from '@tanstack/react-query'
import type { PublicKey } from '@solana/web3.js'
import { getSolanaConnection, getSolanaFallbackConnection } from '@/config/solana'
import { queryKeys } from '@/lib/query/keys'

/**
 * Live base-layer SOL balance (in lamports) for a wallet.
 *
 * Used by the wallet menu so a freshly-created Privy embedded wallet shows its
 * balance at a glance. Polls every 30s and refetches on demand (e.g. when the
 * menu opens) so a devnet airdrop shows up without a manual reload.
 */
export function useSolBalance(publicKey: PublicKey | null) {
  const address = publicKey?.toBase58() ?? ''

  const query = useQuery({
    queryKey: queryKeys.wallet.balance(address),
    enabled: !!publicKey,
    staleTime: 10_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!publicKey) return 0
      // Fall back to the public endpoint so an exhausted or unreachable keyed RPC
      // never leaves the balance blank (the token list already reads this way).
      try {
        return await getSolanaConnection().getBalance(publicKey)
      } catch {
        return getSolanaFallbackConnection().getBalance(publicKey)
      }
    },
  })

  return {
    lamports: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
