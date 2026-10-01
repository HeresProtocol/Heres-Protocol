import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FULL_PCT,
  amountToPct,
  displayPct,
  pctToScaled,
  relativeShareBps,
  sumPct,
  unitsForPct,
  valueToPct,
} from '../lib/recipient-amount.ts'

const units = (amount: string, decimals: number) => {
  const [i, f = ''] = amount.split('.')
  return BigInt(`${i}${f.padEnd(decimals, '0')}`)
}

test('10 tokens out of a 14.97M balance is kept (no reset to 0) and deposits exactly 10', () => {
  const total = '14970000.123456'
  const pct = amountToPct('10', total, 6)
  assert.notEqual(pct, '0')
  assert.ok(Number(pct) > 0 && Number(pct) < 0.001)
  assert.equal(unitsForPct(units(total, 6), pctToScaled(pct)), units('10', 6))
})

test('awkward amounts round-trip exactly at 9 decimals', () => {
  const total = '987654321.123456789'
  for (const amount of ['0.000000001', '1', '3.333333333', '123456.789', '987654321.123456788']) {
    const pct = amountToPct(amount, total, 9)
    assert.equal(unitsForPct(units(total, 9), pctToScaled(pct)), units(amount, 9), amount)
  }
})

test('amount at or above the protected total is 100%', () => {
  assert.equal(amountToPct('20', '10', 6), '100')
  assert.equal(amountToPct('10', '10', 6), '100')
  assert.equal(unitsForPct(units('10', 6), FULL_PCT), units('10', 6))
})

test('blank, zero and invalid input are 0%', () => {
  assert.equal(amountToPct('', '10', 6), '0')
  assert.equal(amountToPct('0', '10', 6), '0')
  assert.equal(amountToPct('abc', '10', 6), '0')
  assert.equal(pctToScaled('not a number'), 0n)
})

test('two recipients given 10 and 5 tokens: deposit is 15 and the split is 2:1', () => {
  const total = '14970000'
  const a = amountToPct('10', total, 6)
  const b = amountToPct('5', total, 6)
  const alloc = sumPct([a, b])
  assert.equal(unitsForPct(units(total, 6), alloc), units('15', 6))
  assert.deepEqual(relativeShareBps([pctToScaled(a), pctToScaled(b)]), [6666, 3334])
})

test('one recipient taking a tiny amount gets 100% of the deposit on-chain', () => {
  const pct = amountToPct('10', '14970000', 6)
  assert.deepEqual(relativeShareBps([pctToScaled(pct)]), [10000])
})

test('the same share applies proportionally to every other selected asset', () => {
  const pct = amountToPct('10', '14970000', 6) // tiny share of token A
  const solLamports = 5_095_800_000n // 5.0958 SOL protected
  const dep = unitsForPct(solLamports, pctToScaled(pct))
  // 10/14.97M of 5.0958 SOL is about 3404 lamports
  assert.ok(dep > 3400n && dep < 3410n)
})

test('relative shares always total 10000 bps', () => {
  const shares = relativeShareBps([pctToScaled('33.33'), pctToScaled('33.33'), pctToScaled('33.34')])
  assert.equal(shares.reduce((s, n) => s + n, 0), 10000)
})

test('USD values convert to a percentage and cap at 100', () => {
  assert.equal(valueToPct(50, 200), '25')
  assert.equal(valueToPct(500, 200), '100')
  assert.equal(valueToPct(0, 200), '0')
})

test('tiny percentages never display as 0', () => {
  assert.equal(displayPct(25), '25')
  assert.equal(displayPct(33.333), '33.33')
  assert.notEqual(displayPct(0.0000668), '0')
  assert.equal(displayPct(0), '0')
})
