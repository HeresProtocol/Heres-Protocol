import test from 'node:test'
import assert from 'node:assert/strict'
import { rpcFetchWithAuthFallback } from '../lib/rpc-fetch.ts'
import { normalizeTxError } from '../lib/errors.ts'

test('RPC authentication rejection retries the same payload on fallback', async () => {
  const calls: unknown[][] = []
  const fetcher = async (url: unknown, init: unknown) => {
    calls.push([url, init])
    return new Response('{}', { status: calls.length === 1 ? 401 : 200 })
  }
  const init = { method: 'POST', body: '{"method":"getLatestBlockhash"}' }
  const response = await rpcFetchWithAuthFallback('https://fallback.example', fetcher as typeof fetch)('https://primary.example', init)
  assert.equal(response.status, 200)
  assert.deepEqual(calls, [['https://primary.example', init], ['https://fallback.example', init]])
})

test('RPC fallback does not retry ambiguous failures or its own rejection', async () => {
  for (const status of [200, 429, 500]) {
    let calls = 0
    await rpcFetchWithAuthFallback('https://fallback.example', (async () => { calls++; return new Response('{}', { status }) }) as typeof fetch)('https://primary.example')
    assert.equal(calls, 1)
  }
  let calls = 0
  await rpcFetchWithAuthFallback('https://fallback.example', (async () => { calls++; return new Response('{}', { status: 401 }) }) as typeof fetch)('https://fallback.example')
  assert.equal(calls, 1)
})

test('HTTP authorization failure is distinct from program authorization failure', () => {
  assert.match(normalizeTxError(new Error('failed to get recent blockhash: 401 : Unauthorized')), /RPC service/)
  assert.match(normalizeTxError(new Error('AnchorError Unauthorized. Error Number: 6000')), /wallet is not authorized/)
})
