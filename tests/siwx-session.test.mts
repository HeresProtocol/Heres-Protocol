import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import bs58 from 'bs58'

// Must be set before lib/siwx/config.ts (and constants/index.ts) is imported.
process.env.NEXT_PUBLIC_SOLANA_NETWORK = 'devnet'
delete process.env.NEXT_PUBLIC_APP_ORIGIN

const { buildMessage, generateNonce } = await import('@tuwaio/siwx-core')
const { getSiwxServerSession, toSession, verifySiwxPayload } = await import('@tuwaio/siwx-server')
const { createKeyValueNonceStore, createKeyValueSessionStore } = await import('../lib/siwx/stores.ts')
const { getSiwxChainId, getSiwxPolicy, walletOfSession } = await import('../lib/siwx/config.ts')

const APP_HOST = 'app.example.com'

/** In-memory stand-in for Upstash Redis with expiry. */
function memoryKeyValue() {
  const data = new Map<string, { value: string; expiresAt: number }>()
  const read = (key: string) => {
    const entry = data.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      data.delete(key)
      return null
    }
    return entry.value
  }
  return {
    data,
    set: async (key: string, value: string, ttlSeconds: number) => {
      data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
    },
    get: async (key: string) => read(key),
    getdel: async (key: string) => {
      const value = read(key)
      data.delete(key)
      return value
    },
    del: async (key: string) => {
      data.delete(key)
    },
  }
}

function solanaWallet() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const spki = publicKey.export({ format: 'der', type: 'spki' })
  return {
    address: bs58.encode(spki.subarray(spki.length - 32)),
    signMessage: (message: string) => bs58.encode(sign(null, Buffer.from(message, 'utf8'), privateKey)),
  }
}

function signInMessage(wallet: string, nonce: string, domain = APP_HOST, chainId = getSiwxChainId()) {
  const issuedAt = new Date()
  return buildMessage({
    domain,
    address: `${chainId}:${wallet}`,
    statement: 'Sign in to Heres. This does not send a transaction or cost any fees.',
    uri: `https://${domain}`,
    version: '1',
    chainId,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: new Date(issuedAt.getTime() + 60_000).toISOString(),
  })
}

test('nonce store accepts each issued nonce exactly once', async () => {
  const nonces = createKeyValueNonceStore(memoryKeyValue())
  await nonces.issue({ nonce: 'abc', ttlSeconds: 300 })

  assert.equal(await nonces.consume({ nonce: 'abc' }), true)
  assert.equal(await nonces.consume({ nonce: 'abc' }), false)
  assert.equal(await nonces.consume({ nonce: 'never-issued' }), false)
})

test('nonce store rejects an expired nonce', async () => {
  const nonces = createKeyValueNonceStore(memoryKeyValue())
  await nonces.issue({ nonce: 'old', ttlSeconds: 0 })
  assert.equal(await nonces.consume({ nonce: 'old' }), false)
})

test('session store creates, reads, binds and revokes sessions', async () => {
  const kv = memoryKeyValue()
  const sessions = createKeyValueSessionStore(kv)
  const session = {
    address: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1:11111111111111111111111111111111',
    chainId: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    domain: APP_HOST,
    nonce: 'n1',
    issuedAt: new Date().toISOString(),
  }

  const record = await sessions.create({ session, ttlSeconds: 60 })
  assert.equal(record.id.length, 43, '32 random bytes, base64url')
  assert.deepEqual((await sessions.get(record.id))?.session, session)

  assert.equal(await sessions.bindSubject(record.id, 'user-1'), true)
  assert.equal((await sessions.get(record.id))?.subjectId, 'user-1')

  await sessions.revoke(record.id)
  assert.equal(await sessions.get(record.id), null)
  assert.equal(await sessions.bindSubject(record.id, 'user-1'), false)
  assert.equal(await sessions.get(''), null)

  kv.data.set('siwx:session:broken', { value: '{not json', expiresAt: Date.now() + 60_000 })
  assert.equal(await sessions.get('broken'), null)
})

test('session store reads values already parsed by Upstash', async () => {
  const kv = memoryKeyValue()
  // Upstash Redis returns JSON values as objects (automatic deserialization).
  const upstashLike = { ...kv, get: async (key: string) => {
    const value = await kv.get(key)
    return value === null ? null : JSON.parse(value)
  } }
  const sessions = createKeyValueSessionStore(upstashLike)
  const record = await sessions.create({
    session: { address: 'solana:x:y', chainId: 'solana:x', domain: APP_HOST, nonce: 'n', issuedAt: new Date().toISOString() },
    ttlSeconds: 60,
  })
  assert.equal((await sessions.get(record.id))?.id, record.id)
})

test('a SIWX sign-in creates a session that resolves to the owner wallet', async () => {
  const kv = memoryKeyValue()
  const nonceStore = createKeyValueNonceStore(kv)
  const sessionStore = createKeyValueSessionStore(kv)
  const policy = getSiwxPolicy(APP_HOST)
  const wallet = solanaWallet()

  const nonce = generateNonce()
  await nonceStore.issue({ nonce, ttlSeconds: 300 })
  const message = signInMessage(wallet.address, nonce)
  const result = await verifySiwxPayload({ message, signature: wallet.signMessage(message) }, { policy })
  assert.equal(result.success, true, result.error)
  assert.equal(await nonceStore.consume({ nonce }), true)

  const record = await sessionStore.create({ session: toSession(result.data!), ttlSeconds: 60 })
  const session = await getSiwxServerSession({
    cookieSource: `siwx-session-v2=${record.id}`,
    sessionStore,
    policy,
  })
  assert.equal(walletOfSession(session), wallet.address)

  const otherWallet = solanaWallet()
  assert.notEqual(walletOfSession(session), otherWallet.address)
})

test('sign-in messages for another domain, cluster or signer are rejected', async () => {
  const policy = getSiwxPolicy(APP_HOST)
  const wallet = solanaWallet()

  const phishing = signInMessage(wallet.address, generateNonce(), 'heres-airdrop.example')
  assert.equal((await verifySiwxPayload({ message: phishing, signature: wallet.signMessage(phishing) }, { policy })).success, false)

  const mainnet = signInMessage(wallet.address, generateNonce(), APP_HOST, getSiwxChainId('mainnet-beta'))
  assert.equal((await verifySiwxPayload({ message: mainnet, signature: wallet.signMessage(mainnet) }, { policy })).success, false)

  const forged = signInMessage(wallet.address, generateNonce())
  const signedByAnother = solanaWallet().signMessage(forged)
  assert.equal((await verifySiwxPayload({ message: forged, signature: signedByAnother }, { policy })).success, false)
})

test('NEXT_PUBLIC_APP_ORIGIN pins the expected domain', () => {
  assert.equal(getSiwxPolicy('preview-123.vercel.app').expectedDomain, 'preview-123.vercel.app')
  process.env.NEXT_PUBLIC_APP_ORIGIN = 'https://app.heresprotocol.com'
  try {
    assert.equal(getSiwxPolicy('preview-123.vercel.app').expectedDomain, 'app.heresprotocol.com')
  } finally {
    delete process.env.NEXT_PUBLIC_APP_ORIGIN
  }
})

test('walletOfSession returns only Solana wallets', () => {
  assert.equal(walletOfSession(null), null)
  assert.equal(walletOfSession({ address: 'eip155:1:0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B' }), null)
  assert.equal(
    walletOfSession({ address: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1:11111111111111111111111111111111' }),
    '11111111111111111111111111111111'
  )
})
