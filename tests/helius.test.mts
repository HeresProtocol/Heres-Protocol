import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activityFromTransactions,
  fetchHeliusJson,
  getDefaultHeliusApiBaseUrl,
  getDefaultHeliusRpcUrl,
  getDefaultSolanaRpcUrl,
  HeliusHttpError,
  isValidHeliusApiKey,
  parseRetryAfterMs,
} from '../lib/helius-client.ts'
import { getConfiguredHeliusApiKey, getConfiguredSolanaRpcUrl } from '../constants/index.ts'

test('Helius endpoints use the supported REST and network RPC hosts', () => {
  assert.equal(getDefaultHeliusApiBaseUrl(), 'https://api.helius.xyz/v0')
  assert.equal(
    getDefaultHeliusRpcUrl('devnet', 'real-key'),
    'https://devnet.helius-rpc.com/?api-key=real-key'
  )
  assert.equal(
    getDefaultHeliusRpcUrl('mainnet-beta', 'real-key'),
    'https://mainnet.helius-rpc.com/?api-key=real-key'
  )
  assert.equal(getDefaultSolanaRpcUrl('devnet'), 'https://api.devnet.solana.com')
})

test('placeholder Helius keys are not treated as configured', () => {
  assert.equal(isValidHeliusApiKey(''), false)
  assert.equal(isValidHeliusApiKey('your_helius_api_key'), false)
  assert.equal(isValidHeliusApiKey('replace-me'), false)
  assert.equal(isValidHeliusApiKey('real-key'), true)
})

test('Helius requests honor Retry-After after a 429 and then succeed', async () => {
  let calls = 0
  const delays: number[] = []
  const result = await fetchHeliusJson<{ ok: boolean }>('https://api.helius.xyz/v0/test', {}, {
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) {
        return new Response('', { status: 429, headers: { 'retry-after': '2' } })
      }
      return Response.json({ ok: true })
    },
    sleep: async (delayMs) => { delays.push(delayMs) },
  })

  assert.deepEqual(result, { ok: true })
  assert.equal(calls, 2)
  assert.deepEqual(delays, [2_000])
})

test('non-retryable Helius failures stop immediately', async () => {
  let calls = 0
  await assert.rejects(
    fetchHeliusJson('https://api.helius.xyz/v0/test', {}, {
      fetchImpl: async () => {
        calls += 1
        return new Response('', { status: 401 })
      },
      sleep: async () => undefined,
    }),
    (error: unknown) => error instanceof HeliusHttpError && error.status === 401
  )
  assert.equal(calls, 1)
})

test('activity normalization selects the newest real transaction', () => {
  const activity = activityFromTransactions('wallet', [
    { signature: 'older', timestamp: 1_700_000_000 },
    { signature: 'newer', timestamp: 1_800_000_000 },
  ])
  assert.deepEqual(activity, {
    wallet: 'wallet',
    lastSignature: 'newer',
    lastActivityTimestamp: 1_800_000_000_000,
    transactionCount: 2,
  })
  assert.equal(parseRetryAfterMs('1.5'), 1_500)
})

test('configured RPC prefers Helius over public devnet whenever a valid key is present', () => {
  const priorKey = process.env.HELIUS_API_KEY
  const priorPublicKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  const priorRpc = process.env.SOLANA_RPC_URL
  const priorFallback = process.env.SOLANA_FALLBACK_RPC_URL

  process.env.HELIUS_API_KEY = 'real-key'
  delete process.env.NEXT_PUBLIC_HELIUS_API_KEY
  delete process.env.SOLANA_RPC_URL
  delete process.env.SOLANA_FALLBACK_RPC_URL

  try {
    assert.equal(getConfiguredHeliusApiKey(), 'real-key')
    assert.equal(getConfiguredSolanaRpcUrl('devnet'), 'https://devnet.helius-rpc.com/?api-key=real-key')
  } finally {
    if (priorKey === undefined) delete process.env.HELIUS_API_KEY
    else process.env.HELIUS_API_KEY = priorKey

    if (priorPublicKey === undefined) delete process.env.NEXT_PUBLIC_HELIUS_API_KEY
    else process.env.NEXT_PUBLIC_HELIUS_API_KEY = priorPublicKey

    if (priorRpc === undefined) delete process.env.SOLANA_RPC_URL
    else process.env.SOLANA_RPC_URL = priorRpc

    if (priorFallback === undefined) delete process.env.SOLANA_FALLBACK_RPC_URL
    else process.env.SOLANA_FALLBACK_RPC_URL = priorFallback
  }
})
