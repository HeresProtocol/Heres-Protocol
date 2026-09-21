import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isPrivyEmbeddedWallet,
  selectHeresSolanaWallet,
} from '../lib/privy-wallet.ts'

const wallet = (name: string, address: string) => ({
  address,
  standardWallet: { name },
})

test('email login uses the Privy embedded Solana wallet', () => {
  const embedded = wallet('Privy', 'embedded-address')
  assert.equal(selectHeresSolanaWallet([embedded]), embedded)
  assert.equal(isPrivyEmbeddedWallet(embedded), true)
})

test('external Solana wallet is preferred when Privy also creates an embedded wallet', () => {
  const embedded = wallet('Privy', 'embedded-address')
  const phantom = wallet('Phantom', 'phantom-address')
  assert.equal(selectHeresSolanaWallet([embedded, phantom]), phantom)
  assert.equal(isPrivyEmbeddedWallet(phantom), false)
})

test('most recently ordered external wallet remains the selected signer', () => {
  const backpack = wallet('Backpack', 'backpack-address')
  const solflare = wallet('Solflare', 'solflare-address')
  const embedded = wallet('Privy', 'embedded-address')
  assert.equal(selectHeresSolanaWallet([backpack, solflare, embedded]), backpack)
})

test('no connected wallet returns undefined', () => {
  assert.equal(selectHeresSolanaWallet([]), undefined)
})
