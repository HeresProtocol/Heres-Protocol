/**
 * Devnet proof for a TBILLx-shaped Token-2022 mint. The owner must already hold at least 10 raw
 * tokens and supply its keypair path through TBILLX_TEST_OWNER_KEYPAIR. Run only after upgrading
 * the Devnet program: TBILLX_TEST_OWNER_KEYPAIR=/path/to/owner.json node scripts/magicblock/tbillx-synthetic-check.mjs
 */
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import anchor from '@coral-xyz/anchor'
import {
  ComputeBudgetProgram, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY, SystemProgram, Transaction, sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAccount,
  getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token'

const { AnchorProvider, BN, Program, Wallet } = anchor
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const ownerPath = process.env.TBILLX_TEST_OWNER_KEYPAIR
if (!ownerPath) throw new Error('TBILLX_TEST_OWNER_KEYPAIR must point to a funded test owner keypair')
const payerPath = process.env.SOLANA_FEE_PAYER_KEYPAIR ?? join(homedir(), '.config/solana/id.json')
const idl = JSON.parse(readFileSync(join(root, 'heres_program/target/idl/heres_program.json'), 'utf8'))
const programId = new PublicKey(idl.address)
const mint = new PublicKey(process.env.TBILLX_TEST_MINT ?? 'A8oer7he9MszquJEyWvdAiFwJUKWTACmdbbBTsksHGQi')
const owner = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(ownerPath, 'utf8'))))
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(payerPath, 'utf8'))))
const connection = new Connection(process.env.BASE_RPC ?? 'https://api.devnet.solana.com', 'confirmed')
const provider = new AnchorProvider(connection, new Wallet(owner), { commitment: 'confirmed' })
const program = new Program(idl, provider)
const pda = (seed) => PublicKey.findProgramAddressSync([Buffer.from(seed), owner.publicKey.toBuffer()], programId)[0]
const capsule = pda('intent_capsule')
const beneficiarySet = pda('beneficiary_set')
const vault = pda('capsule_vault')
const feeConfig = PublicKey.findProgramAddressSync([Buffer.from('fee_config')], programId)[0]
const ownerAta = getAssociatedTokenAddressSync(mint, owner.publicKey, false, TOKEN_2022_PROGRAM_ID)
const vaultAta = getAssociatedTokenAddressSync(mint, vault, true, TOKEN_2022_PROGRAM_ID)
const depositAmount = 10n * 10n ** 8n
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function commitment(salt) {
  const one = Buffer.alloc(4)
  one.writeUInt32LE(1)
  const zero = Buffer.alloc(4)
  const fullShare = Buffer.alloc(2)
  fullShare.writeUInt16LE(10_000)
  return Array.from(createHash('sha256').update(Buffer.concat([
    Buffer.from('heres:inheritance-config:v1'), owner.publicKey.toBuffer(), one,
    payer.publicKey.toBuffer(), fullShare, zero, salt,
  ])).digest())
}

async function send(instructions, signer) {
  const tx = new Transaction().add(...instructions)
  return sendAndConfirmTransaction(connection, tx, [signer], { commitment: 'confirmed' })
}

async function main() {
  if (await connection.getAccountInfo(capsule)) {
    throw new Error(`Test owner already has a capsule at ${capsule.toBase58()}; inspect it before retrying`)
  }
  const config = await program.account.feeConfig.fetch(feeConfig)
  const feeRecipient = new PublicKey(config.feeRecipient ?? config.fee_recipient)
  const initialOwnerTokens = (await getAccount(connection, ownerAta, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount
  if (initialOwnerTokens < depositAmount) throw new Error('Synthetic test owner lacks 10 raw tokens')

  await send([SystemProgram.transfer({
    fromPubkey: payer.publicKey, toPubkey: owner.publicKey, lamports: 0.6 * LAMPORTS_PER_SOL,
  })], payer)
  console.log('owner funded:', owner.publicKey.toBase58())

  await program.methods.createCapsule(new BN(20), payer.publicKey, null)
    .accountsPartial({ capsule, beneficiarySet, vault, owner: owner.publicKey, feeConfig,
      platformFeeRecipient: feeRecipient, systemProgram: SystemProgram.programId })
    .rpc()
  console.log('capsule created:', capsule.toBase58())

  await program.methods.deposit(new BN(depositAmount.toString()))
    .accountsPartial({ capsule, vault, owner: owner.publicKey, systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      mint, sourceTokenAccount: ownerAta, vaultTokenAccount: vaultAta })
    .rpc()
  const funded = await getAccount(connection, vaultAta, 'confirmed', TOKEN_2022_PROGRAM_ID)
  if (funded.amount !== depositAmount || !funded.closeAuthority?.equals(vault)) {
    throw new Error('Synthetic deposit did not register the expected vault balance')
  }
  const parsedAccounts = await connection.getParsedTokenAccountsByOwner(
    vault, { programId: TOKEN_2022_PROGRAM_ID }, 'confirmed'
  )
  const parsedVault = parsedAccounts.value.find(({ pubkey }) => pubkey.equals(vaultAta))
  if (parsedVault?.account.data?.parsed?.info?.closeAuthority !== vault.toBase58()) {
    throw new Error('RPC parsed token scan did not expose the registered close-authority marker')
  }
  console.log('synthetic Token-2022 deposit and vault marker: PASS')

  const beneficiary = [{ pubkey: payer.publicKey, shareBps: 10_000, reserved: Array(14).fill(0) }]
  await program.methods.updateIntent(beneficiary)
    .accountsPartial({ beneficiarySet, owner: owner.publicKey }).rpc()
  const salt = randomBytes(32)
  const hash = commitment(salt)
  await program.methods.sealInheritance(Array.from(salt), hash)
    .accountsPartial({ beneficiarySet, owner: owner.publicKey }).rpc()
  await program.methods.armCapsule(hash).accountsPartial({ capsule, owner: owner.publicKey }).rpc()

  await sleep(22_000)
  await program.methods.executeIntent().accountsPartial({ capsule }).rpc()

  const recipientAta = (await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, payer.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID
  )).address
  const recipientBefore = (await getAccount(connection, recipientAta, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount
  const splIx = await program.methods.distributeAssets()
    .accountsPartial({ capsule, beneficiarySet, vault, systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID, mint, vaultTokenAccount: vaultAta })
    .remainingAccounts([
      { pubkey: recipientAta, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ]).instruction()

  let standaloneRejected = false
  try { await send([splIx], payer) } catch { standaloneRejected = true }
  if (!standaloneRejected || (await getAccount(connection, vaultAta, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount !== depositAmount) {
    throw new Error('Standalone payout was not atomically rejected')
  }
  console.log('standalone partial payout rejected without moving funds: PASS')

  const solIx = await program.methods.distributeAssets()
    .accountsPartial({ capsule, beneficiarySet, vault, systemProgram: SystemProgram.programId,
      tokenProgram: null, mint: null, vaultTokenAccount: null })
    .remainingAccounts([
      { pubkey: payer.publicKey, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ]).instruction()
  const completeIx = await program.methods.completePayout()
    .accountsPartial({ capsule, beneficiarySet, vault }).instruction()
  const payoutSig = await send([
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), splIx, solIx, completeIx,
  ], payer)
  const recipientAfter = (await getAccount(connection, recipientAta, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount
  if (recipientAfter - recipientBefore !== depositAmount || await connection.getAccountInfo(vaultAta)) {
    throw new Error('Atomic payout did not deliver the full synthetic token amount and close its vault ATA')
  }
  console.log('atomic Token-2022 payout:', payoutSig)

  const finalizeSig = await program.methods.finalizeCapsule()
    .accountsPartial({ capsule, beneficiarySet, vault, authority: owner.publicKey, feeConfig, feeRecipient })
    .rpc()
  const remnants = await connection.getMultipleAccountsInfo([capsule, beneficiarySet, vault])
  if (remnants.some(Boolean)) throw new Error('Finalization left a capsule account open')
  console.log('capsule finalized:', finalizeSig)
  console.log('TBILLx-shaped synthetic mint check: PASS')
}

main().catch((error) => {
  console.error('TBILLx-shaped synthetic mint check failed:', error.message)
  if (error.logs) for (const line of error.logs.slice(-12)) console.error(line)
  console.error('capsule:', capsule.toBase58(), 'vault:', vault.toBase58())
  process.exitCode = 1
})
