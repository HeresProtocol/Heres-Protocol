/**
 * Helius API integration for real-time on-chain monitoring
 * 
 * Updated to use getTransactionsForAddress RPC method for better performance
 * and advanced filtering capabilities.
 * 
 * @see https://www.helius.dev/docs/rpc/gettransactionsforaddress
 */

import { HELIUS_CONFIG, SOLANA_CONFIG } from '@/constants'
import type { WalletActivity } from '@/types'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  activityFromTransactions,
  fetchHeliusJson,
  getDefaultHeliusRpcUrl,
  isValidHeliusApiKey,
} from './helius-client'

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const SOLANA_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/

function isValidSolanaAddress(value: string): boolean {
  return SOLANA_ADDRESS_RE.test(value)
}

function isValidSolanaSignature(value: string): boolean {
  return SOLANA_SIGNATURE_RE.test(value)
}

function getHeliusApiKey(): string | null {
  const serverKey = typeof window === 'undefined' ? process.env.HELIUS_API_KEY : undefined
  const key = serverKey || SOLANA_CONFIG.HELIUS_API_KEY
  return isValidHeliusApiKey(key) ? key.trim() : null
}

export function getHeliusRpcUrl(): string | null {
  const key = getHeliusApiKey()
  return key ? getDefaultHeliusRpcUrl(SOLANA_CONFIG.NETWORK, key) : null
}

/**
 * Interface for getTransactionsForAddress request parameters
 */
export interface GetTransactionsForAddressParams {
  transactionDetails?: 'signatures' | 'full'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  paginationToken?: string
  commitment?: 'finalized' | 'confirmed'
  filters?: {
    slot?: {
      gte?: number
      gt?: number
      lte?: number
      lt?: number
    }
    blockTime?: {
      gte?: number
      gt?: number
      lte?: number
      lt?: number
      eq?: number
    }
    signature?: {
      gte?: string
      gt?: string
      lte?: string
      lt?: string
    }
    status?: 'succeeded' | 'failed'
    tokenAccounts?: 'none' | 'balanceChanged' | 'all'
  }
}

/**
 * Interface for getTransactionsForAddress response
 */
export interface GetTransactionsForAddressResponse {
  data: any[]
  paginationToken?: string
}

/**
 * Get transactions for an address using Helius getTransactionsForAddress RPC method
 * 
 * This is a Helius-exclusive RPC method that provides:
 * - Full transaction data in one call (no need for getTransaction)
 * - Associated Token Accounts (ATA) support
 * - Advanced filtering and sorting
 * - Efficient pagination
 * 
 * @param address - Base-58 encoded public key
 * @param params - Query parameters
 * @returns Transaction data with pagination token
 */
export async function getTransactionsForAddress(
  address: string,
  params: GetTransactionsForAddressParams = {}
): Promise<GetTransactionsForAddressResponse | null> {
  try {
    const {
      transactionDetails = 'signatures',
      sortOrder = 'desc',
      limit = 100,
      paginationToken,
      commitment = 'finalized',
      filters = {},
    } = params

    if (!isValidSolanaAddress(address)) return null
    const rpcUrl = getHeliusRpcUrl()
    if (!rpcUrl) return null

    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransactionsForAddress',
      params: [
        address,
        {
          transactionDetails,
          sortOrder,
          limit,
          ...(paginationToken && { paginationToken }),
          commitment,
          ...(Object.keys(filters).length > 0 && { filters }),
        },
      ],
    }

    const data = await fetchHeliusJson<any>(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (data.error) {
      const errorCode = data.error.code
      const errorMessage = data.error.message || ''
      
      // Check if it's a paid plan requirement error (403 or -32403)
      if (errorCode === -32403 || errorMessage.includes('paid plans') || errorMessage.includes('upgrade')) {
        console.warn('getTransactionsForAddress requires a paid Helius plan. Falling back to Enhanced Transactions API.')
        return null // Return null to trigger fallback
      }
      
      console.error('Helius RPC error:', data.error)
      throw new Error(data.error.message || 'Helius RPC error')
    }

    return data.result || null
  } catch (error: any) {
    // Check if it's a 403 error in the error message
    if (error?.message?.includes('403') || error?.message?.includes('paid plans')) {
      console.warn('getTransactionsForAddress requires a paid Helius plan. Falling back to alternative methods.')
      return null
    }
    console.error('Error fetching transactions from Helius RPC:', error)
    return null
  }
}

/**
 * Get wallet activity information from Helius
 * 
 * Falls back to Enhanced Transactions API if getTransactionsForAddress is not available (requires paid plan)
 */
export async function getWalletActivity(walletAddress: string): Promise<WalletActivity | null> {
  if (!isValidSolanaAddress(walletAddress)) return null

  // Activity only needs signatures and block times, so use the standard Solana RPC method. This
  // keeps liveness working when the legacy Enhanced REST API is unavailable or the key is throttled.
  const endpoints = [HELIUS_CONFIG.RPC_URL, HELIUS_CONFIG.RPC_URL_ALT, HELIUS_CONFIG.PUBLIC_RPC_URL]
  const attempted = new Set<string>()
  for (const endpoint of endpoints) {
    if (!endpoint || attempted.has(endpoint)) continue
    attempted.add(endpoint)
    try {
      const connection = new Connection(endpoint, 'confirmed')
      const signatures = await connection.getSignaturesForAddress(new PublicKey(walletAddress), { limit: 100 }, 'confirmed')
      return activityFromTransactions(walletAddress, signatures)
    } catch {
      // Try the next independent endpoint. A provider outage must never look like wallet inactivity.
    }
  }
  return null
}

/**
 * Subscribe to wallet activity webhooks (for production use)
 */
export async function createWebhook(
  walletAddress: string,
  webhookUrl: string,
  authHeader?: string
): Promise<string | null> {
  const apiKey = getHeliusApiKey()
  if (!apiKey || !isValidSolanaAddress(walletAddress)) return null
  const webhookAuth = authHeader || (typeof window === 'undefined' ? process.env.HELIUS_WEBHOOK_AUTH_TOKEN : undefined)
  try {
    const url = new URL(`${HELIUS_CONFIG.BASE_URL}/webhooks`)
    url.searchParams.set('api-key', apiKey)
    const data = await fetchHeliusJson<any>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookURL: webhookUrl,
        transactionTypes: ['ANY'],
        accountAddresses: [walletAddress],
        webhookType: 'enhanced',
        ...(webhookAuth ? { authHeader: webhookAuth } : {}),
      }),
    })

    return data.webhookID || data.webhookId || null
  } catch (error) {
    console.error('Error creating webhook:', error)
    return null
  }
}

/**
 * Check if wallet has been inactive for a given period
 */
export function isWalletInactive(
  lastActivityTimestamp: number,
  inactivityPeriodSeconds: number
): boolean {
  const now = Date.now()
  const timeSinceActivity = (now - lastActivityTimestamp) / 1000 // Convert to seconds
  return timeSinceActivity >= inactivityPeriodSeconds
}

/** Normalized NFT item from Helius DAS */
export interface HeliusNftItem {
  mint: string
  name?: string
  symbol?: string
  imageUri?: string
}

/**
 * Get NFTs (and other digital assets) by owner via Helius DAS getAssetsByOwner.
 * Use when HELIUS_API_KEY is set for full metadata (name, image).
 * @see https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api/get-assets-by-owner
 */
export async function getAssetsByOwner(ownerAddress: string): Promise<HeliusNftItem[] | null> {
  if (!isValidSolanaAddress(ownerAddress)) return null
  const rpcUrl = getHeliusRpcUrl()
  if (!rpcUrl) return null

  try {
    const data = await fetchHeliusJson<any>(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAssetsByOwner',
        params: {
          ownerAddress,
          page: 1,
          limit: 1000,
          displayOptions: { showFungible: false, showNativeBalance: false, showZeroBalance: false },
        },
      }),
    })
    if (data.error) throw new Error(data.error.message || 'Helius DAS error')
    const result = data.result
    if (!result || !Array.isArray(result.items)) return null

    const items: HeliusNftItem[] = result.items
      // Heres currently custodies mint/ATA-backed NFTs through SPL TransferChecked. Exclude cNFTs,
      // programmable NFTs, and Core assets because each requires its own program-specific transfer.
      .filter((item: any) => item?.interface === 'V1_NFT' && item?.compression?.compressed !== true)
      .map((item: any) => {
        const content = item?.content || {}
        const files = content?.files || []
        const metadata = content?.metadata || {}
        const imageUri = files[0]?.cdn_uri || files[0]?.uri
        return {
          mint: item.id || '',
          name: metadata?.name ?? undefined,
          symbol: metadata?.symbol ?? undefined,
          imageUri: imageUri ?? undefined,
        }
      })
    return items
  } catch (e) {
    console.error('Helius getAssetsByOwner error:', e)
    return null
  }
}

/**
 * Get NFTs by owner (alias for getAssetsByOwner).
 * Use when HELIUS_API_KEY is set for full metadata (name, image).
 */
export async function getNftsByOwner(ownerAddress: string): Promise<HeliusNftItem[]> {
  const items = await getAssetsByOwner(ownerAddress)
  if (items === null) throw new Error('Helius NFT service is temporarily unavailable')
  return items
}

/**
 * Get transactions for a program/address from Helius Enhanced Transactions API.
 * Use as primary source when HELIUS_API_KEY is set.
 */
export async function getEnhancedTransactions(
  address: string,
  limit = 100,
  before?: string
): Promise<any[]> {
  const apiKey = getHeliusApiKey()
  if (!apiKey) return []
  if (!isValidSolanaAddress(address)) return []
  try {
    const safeAddress = encodeURIComponent(address)
    const url = new URL(`${HELIUS_CONFIG.BASE_URL}/addresses/${safeAddress}/transactions`)
    url.searchParams.set('api-key', apiKey)
    url.searchParams.set('limit', String(limit))
    if (before && isValidSolanaSignature(before)) {
      url.searchParams.set('before', before)
    }
    const data = await fetchHeliusJson<any>(url)
    const list = Array.isArray(data) ? data : data?.transactions ?? data?.data ?? data?.result ?? []
    return Array.isArray(list) ? list : []
  } catch (e) {
    console.error('Helius getEnhancedTransactions error:', e)
    return []
  }
}
