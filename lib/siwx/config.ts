import { getSolanaChainId, parseCaip10AccountId } from '@tuwaio/orbit-core'
import type { SiwxVerificationPolicy } from '@tuwaio/siwx-core'
import type { SiwxSession } from '@tuwaio/siwx-server'
import { SOLANA_CONFIG, type SolanaNetwork } from '../../constants/index.ts'

/**
 * Shared by the browser and the server. Relative imports only, so the node:test
 * suite can import it.
 */

/** One sign-in lasts a day: Heres is opened rarely, and a shorter session brings the wallet popups back. */
export const SIWX_SESSION_TTL_SECONDS = 24 * 60 * 60

/** CAIP-2 chain ID of the configured cluster, e.g. `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` on devnet. */
export function getSiwxChainId(network: SolanaNetwork = SOLANA_CONFIG.NETWORK): `solana:${string}` {
  const chainId = getSolanaChainId(network)
  if (!chainId?.startsWith('solana:')) throw new Error(`Unsupported Solana network for sign-in: ${network}`)
  return chainId as `solana:${string}`
}

/**
 * What the server accepts in a SIWX message. The domain is pinned by
 * NEXT_PUBLIC_APP_ORIGIN when it is set; otherwise it is the host the request
 * reached (localhost, Vercel previews), which a phishing site cannot choose.
 */
export function getSiwxPolicy(requestHost: string): SiwxVerificationPolicy {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim()
  return {
    expectedDomain: configuredOrigin ? new URL(configuredOrigin).host : requestHost,
    allowedChainIds: [getSiwxChainId()],
  }
}

/** Base58 Solana wallet of a SIWX session, or null for no session or another namespace. */
export function walletOfSession(session: Pick<SiwxSession, 'address'> | null | undefined): string | null {
  const account = session ? parseCaip10AccountId(session.address) : undefined
  return account?.namespace === 'solana' ? account.address : null
}
