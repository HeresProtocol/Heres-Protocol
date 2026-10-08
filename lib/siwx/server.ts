import 'server-only'

import { Redis } from '@upstash/redis'
import {
  getSiwxServerSession,
  MemorySiwxNonceStore,
  MemorySiwxSessionStore,
  type SiwxNonceStore,
  type SiwxSessionStore,
} from '@tuwaio/siwx-server'
import { debugWarn } from '@/lib/log'
import { getSiwxPolicy, walletOfSession } from '@/lib/siwx/config'
import { createKeyValueNonceStore, createKeyValueSessionStore } from '@/lib/siwx/stores'

type SiwxStores = { nonceStore: SiwxNonceStore; sessionStore: SiwxSessionStore }

declare global {
  var __heresSiwxStores: SiwxStores | undefined
}

function createStores(): SiwxStores {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    const redis = new Redis({ url, token })
    const kv = {
      set: (key: string, value: string, ttlSeconds: number) => redis.set(key, value, { ex: ttlSeconds }),
      get: (key: string) => redis.get(key),
      getdel: (key: string) => redis.getdel(key),
      del: (key: string) => redis.del(key),
    }
    return { nonceStore: createKeyValueNonceStore(kv), sessionStore: createKeyValueSessionStore(kv) }
  }
  // Local dev without Redis, like lib/intent-delivery/store.ts. Both stores throw in production.
  return { nonceStore: new MemorySiwxNonceStore(), sessionStore: new MemorySiwxSessionStore() }
}

/** Nonce and session stores of SIWX sign-in, created once per server instance. */
export function getSiwxStores(): SiwxStores {
  if (!globalThis.__heresSiwxStores) {
    globalThis.__heresSiwxStores = createStores()
  }
  return globalThis.__heresSiwxStores
}

/**
 * Base58 wallet of the request's SIWX session cookie, or null when there is no
 * valid session. Store errors are logged and treated as no session, so the
 * routes fall back to their signed-request check.
 */
export async function getSessionWallet(request: Request): Promise<string | null> {
  try {
    const session = await getSiwxServerSession({
      cookieSource: request,
      sessionStore: getSiwxStores().sessionStore,
      policy: getSiwxPolicy(new URL(request.url).host),
    })
    return walletOfSession(session)
  } catch (error) {
    debugWarn('[siwx] session lookup failed:', error)
    return null
  }
}
