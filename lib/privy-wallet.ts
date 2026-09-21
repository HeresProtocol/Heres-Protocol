/** Minimal shape needed to choose which connected Privy Solana wallet Heres uses. */
export interface PrivySolanaWalletLike {
  address: string
  standardWallet?: {
    name?: string
  }
}

export function isPrivyEmbeddedWallet(wallet: PrivySolanaWalletLike): boolean {
  return wallet.standardWallet?.name?.trim().toLowerCase() === 'privy'
}

/**
 * Prefer a connected external wallet when one is present. Privy may also create an
 * embedded wallet after external-wallet login, so choosing the embedded wallet first
 * would make Heres read and sign for an address the user did not select.
 */
export function selectHeresSolanaWallet<T extends PrivySolanaWalletLike>(
  wallets: readonly T[]
): T | undefined {
  return wallets.find((wallet) => !isPrivyEmbeddedWallet(wallet)) ?? wallets[0]
}
