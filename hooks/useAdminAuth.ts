'use client'

import { useCallback, useMemo } from 'react'
import { useHeresWallet } from '@/hooks/useHeresWallet'
import { useSiwxSession } from '@/hooks/useSiwxSession'
import { isAdminWallet } from '@/lib/admin'

export interface UseAdminAuth {
  /** Cosmetic gate: is the connected wallet on the allowlist? (No signature.) */
  isAdmin: boolean
  /**
   * Makes sure the admin wallet is signed in with SIWX (one wallet signature, valid
   * 24h) and returns the extra request headers. The session travels as an HttpOnly
   * cookie, so no headers are needed. Throws if the wallet is missing, cannot sign,
   * or is not allowlisted.
   */
  ensureAuthHeaders: () => Promise<Record<string, string>>
}

export function useAdminAuth(): UseAdminAuth {
  const wallet = useHeresWallet()
  const { ensureSession } = useSiwxSession(wallet)

  const isAdmin = useMemo(() => isAdminWallet(wallet.publicKey ?? null), [wallet.publicKey])

  const ensureAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const owner = wallet.publicKey?.toBase58()
    if (!owner) throw new Error('Connect an admin wallet to continue')
    if (!isAdminWallet(owner)) throw new Error('Wallet not authorized')

    await ensureSession()
    return {}
  }, [wallet.publicKey, ensureSession])

  return { isAdmin, ensureAuthHeaders }
}
