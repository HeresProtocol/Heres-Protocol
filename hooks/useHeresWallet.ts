'use client'

import { useMemo } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useWallets, useSignTransaction, useSignMessage } from '@privy-io/react-auth/solana'
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import type { HeresWallet } from '@/types/wallet'
import { isPrivyEmbeddedWallet, selectHeresSolanaWallet } from '@/lib/privy-wallet'

// Demo behavior: suppress Privy's per-signature confirmation modal so a flow that
// signs several transactions (capsule creation signs 3+) runs without popups. The
// PrivyProvider sets the same default via embeddedWallets.showWalletUIs; both are
// flipped to `true` to restore an explicit confirmation on every signature.
const SHOW_WALLET_UIS = false

/**
 * Unified implementation of the app's `HeresWallet` contract.
 *
 * Installed Solana extensions are connected directly through Wallet Adapter.
 * Privy continues to provide the email-created embedded wallet. When both are
 * connected, Heres uses the external wallet selected in Wallet Adapter.
 * The app builds @solana/web3.js `Transaction`s and broadcasts them to its own RPC
 * connections (base layer + MagicBlock ER + TEE), so this shim only needs to SIGN:
 * it serializes a Transaction to the raw wire bytes Privy expects, then deserializes
 * the signed bytes back into a Transaction for the existing send paths in lib/solana.ts.
 */
export function useHeresWallet(): HeresWallet {
  const { ready, authenticated } = usePrivy()
  const { ready: walletsReady, wallets } = useWallets()
  const { signTransaction: privySignTransaction } = useSignTransaction()
  const { signMessage: privySignMessage } = useSignMessage()
  const solanaWallet = useSolanaWallet()

  const selectedWallet = useMemo(() => selectHeresSolanaWallet(wallets), [wallets])

  const publicKey = useMemo(
    () => (selectedWallet ? new PublicKey(selectedWallet.address) : null),
    [selectedWallet]
  )

  const privyConnected = ready && walletsReady && authenticated && !!selectedWallet

  const externalWallet = useMemo<HeresWallet | null>(() => {
    if (!solanaWallet.connected || !solanaWallet.publicKey) return null

    const signTransaction = solanaWallet.signTransaction
    const signAllTransactions =
      solanaWallet.signAllTransactions ??
      (signTransaction
        ? async <T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> => {
            const signed: T[] = []
            for (const transaction of transactions) {
              signed.push(await signTransaction(transaction))
            }
            return signed
          }
        : undefined)

    return {
      publicKey: solanaWallet.publicKey,
      connected: true,
      walletName: solanaWallet.wallet?.adapter.name ?? 'Solana wallet',
      isEmbedded: false,
      signTransaction,
      signAllTransactions,
      signMessage: solanaWallet.signMessage,
    }
  }, [
    solanaWallet.connected,
    solanaWallet.publicKey,
    solanaWallet.wallet,
    solanaWallet.signTransaction,
    solanaWallet.signAllTransactions,
    solanaWallet.signMessage,
  ])

  return useMemo<HeresWallet>(() => {
    if (externalWallet) return externalWallet

    if (!selectedWallet || !publicKey) {
      return { publicKey: null, connected: false }
    }

    const signTransaction = async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      const isVersioned = tx instanceof VersionedTransaction
      const bytes = isVersioned
        ? tx.serialize()
        : (tx as Transaction).serialize({ requireAllSignatures: false, verifySignatures: false })

      const { signedTransaction } = await privySignTransaction({
        transaction: new Uint8Array(bytes),
        wallet: selectedWallet,
        options: { uiOptions: { showWalletUIs: SHOW_WALLET_UIS } },
      })

      const signed = isVersioned
        ? VersionedTransaction.deserialize(signedTransaction)
        : Transaction.from(signedTransaction)
      return signed as T
    }

    // Privy signs each tx without a popup (showWalletUIs:false), so signing
    // sequentially has no UX cost and avoids the batch-overload typing.
    const signAllTransactions = async <T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> => {
      const signed: T[] = []
      for (const tx of txs) signed.push(await signTransaction(tx))
      return signed
    }

    // Raw Ed25519 over the exact message bytes (no offchain prefix), which the
    // MagicBlock TEE `getAuthToken` flow and the CRE/admin auth headers rely on.
    const signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
      const { signature } = await privySignMessage({
        message,
        wallet: selectedWallet,
        options: { uiOptions: { showWalletUIs: SHOW_WALLET_UIS } },
      })
      return signature
    }

    return {
      publicKey,
      connected: privyConnected,
      walletName: selectedWallet.standardWallet?.name || 'Solana wallet',
      isEmbedded: isPrivyEmbeddedWallet(selectedWallet),
      signTransaction,
      signAllTransactions,
      signMessage,
    }
  }, [
    externalWallet,
    privyConnected,
    selectedWallet,
    publicKey,
    privySignTransaction,
    privySignMessage,
  ])
}
