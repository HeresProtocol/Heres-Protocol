import { buildMessage } from '@tuwaio/siwx-core'
import { createSolanaSiwxSigner } from '@tuwaio/siwx-solana'
import type { SiwxSession } from '@tuwaio/siwx-server'
import { getSiwxChainId, SIWX_SESSION_TTL_SECONDS } from '@/lib/siwx/config'

const SIWX_API = '/api/siwx'

/** The SIWX session of the session cookie, or null when the browser is not signed in. */
export async function fetchSiwxSession(): Promise<SiwxSession | null> {
  const res = await fetch(`${SIWX_API}/session`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as SiwxSession | null
}

/**
 * Signs the wallet in with SIWX (CAIP-122): one wallet signature over a message
 * bound to this domain, a server nonce and a 24-hour expiry. The server sets an
 * HttpOnly session cookie and returns the session.
 */
export async function signInWithSiwx(params: {
  wallet: string
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
}): Promise<SiwxSession> {
  const nonceRes = await fetch(`${SIWX_API}/nonce`, { method: 'POST', cache: 'no-store' })
  if (!nonceRes.ok) throw new Error('Could not start wallet sign-in')
  const { nonce } = (await nonceRes.json()) as { nonce: string }

  const chainId = getSiwxChainId()
  const issuedAt = new Date()
  const message = buildMessage({
    domain: window.location.host,
    address: `${chainId}:${params.wallet}`,
    statement: 'Sign in to Heres. This does not send a transaction or cost any fees.',
    uri: window.location.origin,
    version: '1',
    chainId,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: new Date(issuedAt.getTime() + SIWX_SESSION_TTL_SECONDS * 1000).toISOString(),
  })
  const signature = await createSolanaSiwxSigner({ signMessage: params.signMessage })(message)

  const res = await fetch(`${SIWX_API}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new Error(data?.error || 'Wallet sign-in failed')
  return data as SiwxSession
}

/** Ends the SIWX session and clears its cookie. */
export async function signOutSiwx(): Promise<void> {
  await fetch(`${SIWX_API}/logout`, { method: 'POST' })
}
