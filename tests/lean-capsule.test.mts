import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import anchor, { BorshAccountsCoder } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { decodeBeneficiarySet, decodeIntentCapsule } from '../lib/lean-capsule.ts'

// The decoder underpins resumable capsule creation (W4): when a create is retried past the seal, the
// original salt is gone from the client, so arm_capsule must be re-driven with the commitment
// recomputed from the salt the program stored at reserved[1..33]. Guard that exact byte window here.
const idl = JSON.parse(
  readFileSync(new URL('../idl/heres_program.json', import.meta.url), 'utf8')
)
const coder = new BorshAccountsCoder(idl)
const { BN } = anchor

function buildBeneficiarySet(opts: { sealed: boolean; salt?: number[] }) {
  const reserved = new Array(64).fill(0)
  if (opts.sealed) {
    reserved[0] = 1
    const salt = opts.salt ?? Array.from({ length: 32 }, (_, i) => (i + 1) & 0xff)
    for (let i = 0; i < 32; i++) reserved[1 + i] = salt[i]
  }
  return {
    owner: PublicKey.default,
    bump: 1,
    version: 3,
    beneficiaries: [
      {
        pubkey: new PublicKey('SysvarC1ock11111111111111111111111111111111'),
        share_bps: 10_000,
        reserved: new Array(14).fill(0),
      },
    ],
    nft_assignments: [],
    reserved,
  }
}

test('decodeBeneficiarySet exposes the sealed salt stored at reserved[1..33]', async () => {
  const salt = Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff)
  const bytes = await coder.encode('BeneficiarySet', buildBeneficiarySet({ sealed: true, salt }))

  const decoded = decodeBeneficiarySet(bytes)

  assert.equal(decoded.isSealed, true)
  assert.deepEqual(decoded.configSalt, salt)
})

test('decodeBeneficiarySet returns a null salt when the set is not sealed', async () => {
  const bytes = await coder.encode('BeneficiarySet', buildBeneficiarySet({ sealed: false }))

  const decoded = decodeBeneficiarySet(bytes)

  assert.equal(decoded.isSealed, false)
  assert.equal(decoded.configSalt, null)
})

test('decodeIntentCapsule reads the v3 payout completion marker for retry and finalization', async () => {
  const reserved = new Array(55).fill(0)
  const account = {
    owner: PublicKey.default,
    inactivity_period: new BN(60),
    last_activity: new BN(100),
    is_active: false,
    executed_at: new BN(200),
    bump: 1,
    vault_bump: 2,
    beneficiaries_bump: 3,
    heartbeat_authority: PublicKey.default,
    version: 3,
    target_date: null,
    reserved,
  }
  const pending = await coder.encode('IntentCapsule', account)
  assert.equal(decodeIntentCapsule(pending).payoutComplete, false)

  reserved[32] = 1
  const settled = await coder.encode('IntentCapsule', { ...account, reserved })
  assert.equal(decodeIntentCapsule(settled).payoutComplete, true)
})
