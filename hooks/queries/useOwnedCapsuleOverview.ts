'use client'

import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { useHeresWallet } from '@/hooks/useHeresWallet'
import { getCapsuleAccountLocations, getCapsuleByAddress } from '@/lib/solana'
import { hasExistingCapsuleAccounts } from '@/lib/capsule-lifecycle'
import { getCachedTeeToken } from '@/lib/tee'
import { getCapsuleVaultPDA } from '@/lib/program'
import { getSolanaConnection } from '@/config/solana'
import { getVaultTokenAccounts } from '@/lib/spl'

/** Owner-scoped, read-only lookup. Never requests a wallet signature. */
export function useOwnedCapsuleOverview() {
  const wallet = useHeresWallet()
  const owner = wallet.publicKey
  const ownerAddress = owner?.toBase58() ?? ''
  const query = useQuery({
    queryKey: ['dashboard', 'owned-capsule', ownerAddress],
    enabled: wallet.connected && Boolean(owner), staleTime: 15_000, refetchInterval: 60_000, retry: 1,
    queryFn: async () => {
      if (!owner) return null
      const locations = await getCapsuleAccountLocations(owner)
      if (locations.switch === 'missing') {
        if (hasExistingCapsuleAccounts(locations)) throw new Error('An incomplete capsule setup was found. Open My Capsule to recover it before creating another.')
        return null
      }
      const capsule = await getCapsuleByAddress(new PublicKey(locations.switchAddress), getCachedTeeToken(owner) ?? undefined)
      if (!capsule) throw new Error('Your capsule could not be read. Retry before creating another.')
      if (!capsule.owner.equals(owner)) throw new Error('This capsule does not belong to the connected wallet.')
      return capsule
    },
  })
  const vault = useQuery({
    queryKey: ['dashboard', 'owned-vault', ownerAddress],
    enabled: Boolean(query.data && owner), staleTime: 15_000, refetchInterval: 60_000, retry: 1,
    queryFn: async () => {
      if (!owner) return null
      const connection = getSolanaConnection()
      const [vaultAddress] = getCapsuleVaultPDA(owner)
      const [info, rent, tokens] = await Promise.all([connection.getAccountInfo(vaultAddress), connection.getMinimumBalanceForRentExemption(9), getVaultTokenAccounts(connection, vaultAddress)])
      return { sol: Math.max(0, (info?.lamports ?? 0) - rent), tokens: tokens.filter((t) => t.amount > 0n) }
    },
  })
  return { wallet, query, vault }
}
