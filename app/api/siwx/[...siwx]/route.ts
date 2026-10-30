import { createSiwxApiHandler } from '@tuwaio/siwx-server/next'
import { getSiwxPolicy, SIWX_SESSION_TTL_SECONDS } from '@/lib/siwx/config'
import { getSiwxStores } from '@/lib/siwx/server'

/**
 * Wallet sign-in (SIWX, CAIP-122): GET|POST /nonce, POST /verify, GET /session,
 * POST /logout. A verified sign-in sets an HttpOnly session cookie that the
 * owner and admin read routes accept instead of a signature per request.
 */
function handlerFor(request: Request) {
  const { nonceStore, sessionStore } = getSiwxStores()
  return createSiwxApiHandler({
    nonceStore,
    sessionStore,
    policy: getSiwxPolicy(new URL(request.url).host),
    ttlSeconds: SIWX_SESSION_TTL_SECONDS,
    // Secure cookies are not set over plain http in every browser (local dev).
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  })
}

export function GET(request: Request) {
  return handlerFor(request).GET(request)
}

export function POST(request: Request) {
  return handlerFor(request).POST(request)
}

export function DELETE(request: Request) {
  return handlerFor(request).DELETE(request)
}
