import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeDasAssets, summarizeTokenAccounts } from '../lib/wallet-legacy.ts'

test('DAS: NFTs are grouped by collection and loose NFTs count as their own', () => {
  const s = summarizeDasAssets(
    [
      { id: 'a', interface: 'V1_NFT', grouping: [{ group_key: 'collection', group_value: 'MadLads' }] },
      { id: 'b', interface: 'ProgrammableNFT', grouping: [{ group_key: 'collection', group_value: 'MadLads' }] },
      { id: 'c', interface: 'V1_NFT', grouping: [] },
      { id: 'd', interface: 'MplCoreAsset', grouping: [{ group_key: 'collection', group_value: 'Core' }] },
    ],
    12_803_000_000
  )
  assert.deepEqual(s, { lamports: 12_803_000_000, nfts: 4, collections: 3, tokens: 0, source: 'das' })
})

test('DAS: only fungible tokens with a balance count, burnt assets are ignored', () => {
  const s = summarizeDasAssets(
    [
      { id: 't1', interface: 'FungibleToken', token_info: { balance: 5 } },
      { id: 't2', interface: 'FungibleToken', token_info: { balance: 0 } },
      { id: 't3', interface: 'FungibleAsset', token_info: { balance: '42' } },
      { id: 'x', interface: 'V1_NFT', burnt: true },
    ],
    0
  )
  assert.equal(s.tokens, 2)
  assert.equal(s.nfts, 0)
  assert.equal(s.collections, 0)
})

test('RPC fallback: 1-of-0-decimals is an NFT, empty accounts are skipped, collections unknown', () => {
  const s = summarizeTokenAccounts(
    [
      { amount: '1', decimals: 0 },
      { amount: '1000000', decimals: 6 },
      { amount: '0', decimals: 6 },
      { amount: '3', decimals: 0 },
    ],
    1_000
  )
  assert.deepEqual(s, { lamports: 1_000, nfts: 1, collections: null, tokens: 2, source: 'rpc' })
})
