import { randomBytes } from 'node:crypto'
import type { SiwxNonceStore, SiwxSessionRecord, SiwxSessionStore } from '@tuwaio/siwx-server'

/**
 * Key-value operations the SIWX stores need. lib/siwx/server.ts adapts Upstash
 * Redis to it (shared by every serverless instance); tests pass an in-memory fake.
 *
 * Dependency-free (no path aliases, no 'server-only') so the node:test suite can
 * import it directly.
 */
export interface SiwxKeyValue {
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>
  get(key: string): Promise<unknown>
  /** Reads and deletes the key in one atomic step (Redis GETDEL). */
  getdel(key: string): Promise<unknown>
  del(key: string): Promise<unknown>
}

const NONCE_PREFIX = 'siwx:nonce:'
const SESSION_PREFIX = 'siwx:session:'

/** Single-use sign-in nonces: GETDEL lets exactly one request consume each nonce. */
export function createKeyValueNonceStore(kv: SiwxKeyValue): SiwxNonceStore {
  return {
    async issue({ nonce, ttlSeconds }) {
      await kv.set(NONCE_PREFIX + nonce, '1', ttlSeconds)
    },
    async consume({ nonce }) {
      const value = await kv.getdel(NONCE_PREFIX + nonce)
      return value !== null && value !== undefined
    },
  }
}

// Upstash parses JSON values on read; the test fake returns the stored string.
function parseRecord(value: unknown): SiwxSessionRecord | null {
  if (value === null || value === undefined) return null
  try {
    const record = (typeof value === 'string' ? JSON.parse(value) : value) as SiwxSessionRecord
    return record && typeof record.id === 'string' && record.session ? record : null
  } catch {
    return null
  }
}

/** Wallet sessions created after a verified SIWX sign-in. The record id is the session cookie value. */
export function createKeyValueSessionStore(kv: SiwxKeyValue): SiwxSessionStore {
  const store: SiwxSessionStore = {
    async create({ session, ttlSeconds }) {
      const createdAt = Date.now()
      const record: SiwxSessionRecord = {
        id: randomBytes(32).toString('base64url'),
        session,
        createdAt,
        expiresAt: createdAt + ttlSeconds * 1000,
      }
      await kv.set(SESSION_PREFIX + record.id, JSON.stringify(record), ttlSeconds)
      return record
    },
    async get(id) {
      if (!id) return null
      const record = parseRecord(await kv.get(SESSION_PREFIX + id))
      if (!record || record.expiresAt <= Date.now()) return null
      return record
    },
    async bindSubject(id, subjectId) {
      const record = await store.get(id)
      if (!record) return false
      const ttlSeconds = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000))
      await kv.set(SESSION_PREFIX + id, JSON.stringify({ ...record, subjectId }), ttlSeconds)
      return true
    },
    async revoke(id) {
      await kv.del(SESSION_PREFIX + id)
    },
  }
  return store
}
