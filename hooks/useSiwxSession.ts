'use client'

import { useCallback } from 'react'
import type { SiwxSession } from '@tuwaio/siwx-server'
import type { HeresWallet } from '@/types/wallet'
import { fetchSiwxSession, signInWithSiwx, signOutSiwx } from '@/lib/siwx/client'
import { walletOfSession } from '@/lib/siwx/config'

// One sign-in at a time per wallet, so parallel queries share a single wallet popup.
const pendingSignIns = new Map<string, Promise<SiwxSession>>()

export interface UseSiwxSession {
  /**
   * Resolves with a SIWX session of the connected wallet. Reuses the session
   * cookie when it belongs to this wallet; otherwise asks the wallet for one
   * signature (valid for 24 hours). Throws if no wallet is connected or it
   * cannot sign messages.
   */
  ensureSession: () => Promise<SiwxSession>
}

export function useSiwxSession(wallet: Pick<HeresWallet, 'publicKey' | 'signMessage'>): UseSiwxSession {
  const address = wallet.publicKey?.toBase58() ?? null
  const signMessage = wallet.signMessage

  const ensureSession = useCallback(async (): Promise<SiwxSession> => {
    if (!address) throw new Error('Connect a wallet to continue')
    if (!signMessage) throw new Error('This wallet does not support message signing')

    const pending = pendingSignIns.get(address)
    if (pending) return pending

    const signIn = (async () => {
      const current = await fetchSiwxSession()
      if (current && walletOfSession(current) === address) return current
      // A session of another wallet: end it before signing in with this one.
      if (current) await signOutSiwx()
      return signInWithSiwx({ wallet: address, signMessage })
    })().finally(() => pendingSignIns.delete(address))

    pendingSignIns.set(address, signIn)
    return signIn
  }, [address, signMessage])

  return { ensureSession }
}
