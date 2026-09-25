import type { Program } from '@coral-xyz/anchor'
import {
  Connection,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js'

import { getBeneficiarySetPDA, getCapsulePDA, getCapsuleVaultPDA } from './program'
import { ataFor, buildCreateAtaIx, getVaultTokenAccounts, validateMintForTransparentDeposit } from './spl'

export type PayoutBeneficiary = { pubkey: PublicKey; shareBps: number }
export type PayoutNftAssignment = { mint: PublicKey; recipient: PublicKey }
export type PayoutAsset = {
  mint: PublicKey
  tokenProgram: PublicKey
}

export type AtomicVaultSnapshot = {
  assets: PayoutAsset[]
  includeSol: boolean
}

const instructionsSysvarMeta = {
  pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
  isSigner: false,
  isWritable: false,
}

/** Read the program-registered vault legs; unregistered direct transfers cannot block payout. */
export async function readAtomicVaultSnapshot(
  connection: Connection,
  vault: PublicKey,
  programId: PublicKey
): Promise<AtomicVaultSnapshot> {
  const vaultInfo = await connection.getAccountInfo(vault, 'confirmed')
  if (!vaultInfo || !vaultInfo.owner.equals(programId) || vaultInfo.data.length < 9) {
    throw new Error('Capsule vault is missing or invalid')
  }
  const flags = vaultInfo.data[8]
  if ((flags & 0xa0) !== 0xa0) {
    throw new Error('This vault predates registered asset tracking')
  }
  const expectedTokenCount = flags & 0x1f
  const tokens = await getVaultTokenAccounts(connection, vault)
  const registered = tokens.filter((token) => token.registered)
  if (registered.length !== expectedTokenCount) {
    throw new Error('Registered vault assets do not match the on-chain asset count')
  }
  const empty = registered.find((token) => token.amount === 0n)
  if (empty) {
    throw new Error(`Registered asset ${empty.mint.toBase58()} has no tokens left to distribute`)
  }
  await Promise.all(registered.map(async ({ mint }) => {
    try {
      await validateMintForTransparentDeposit(connection, mint)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Payout pending for token ${mint.toBase58()}: ${reason} No vault assets were sent.`)
    }
  }))
  const rentFloor = await connection.getMinimumBalanceForRentExemption(vaultInfo.data.length)
  const hasNative = (flags & 0x40) !== 0
  const includeSol = hasNative || registered.length > 0 || vaultInfo.lamports > rentFloor
  return {
    assets: registered.map(({ mint, tokenProgram }) => ({ mint, tokenProgram })),
    includeSol,
  }
}

/** Creating recipient ATAs is preparatory only; no vault assets move until the atomic payout. */
export async function findMissingRecipientAtas(
  connection: Connection,
  payer: PublicKey,
  beneficiaries: readonly PayoutBeneficiary[],
  nftAssignments: readonly PayoutNftAssignment[],
  assets: readonly PayoutAsset[]
): Promise<TransactionInstruction[]> {
  const targets = new Map<string, { ata: PublicKey; owner: PublicKey; asset: PayoutAsset }>()
  for (const asset of assets) {
    const assigned = nftAssignments.find(({ mint }) => mint.equals(asset.mint))
    const recipients = assigned ? [assigned.recipient] : beneficiaries.map(({ pubkey }) => pubkey)
    for (const owner of recipients) {
      const ata = ataFor(asset.mint, owner, asset.tokenProgram)
      targets.set(ata.toBase58(), { ata, owner, asset })
    }
  }
  const entries = [...targets.values()]
  const result: TransactionInstruction[] = []
  for (let start = 0; start < entries.length; start += 100) {
    const batch = entries.slice(start, start + 100)
    const infos = await connection.getMultipleAccountsInfo(batch.map(({ ata }) => ata), 'confirmed')
    for (let index = 0; index < batch.length; index++) {
      if (infos[index]) continue
      const { ata, owner, asset } = batch[index]
      result.push(buildCreateAtaIx(payer, ata, owner, asset.mint, asset.tokenProgram))
    }
  }
  return result
}

/**
 * Build the complete v3 payout. Each asset instruction verifies that the matching completion
 * instruction appears later in this same transaction; completion checks that the vault is empty.
 * Solana rolls every transfer back if any leg or completion fails.
 */
export async function buildAtomicPayoutInstructions(
  program: Program,
  owner: PublicKey,
  beneficiaries: readonly PayoutBeneficiary[],
  nftAssignments: readonly PayoutNftAssignment[],
  assets: readonly PayoutAsset[],
  includeSol: boolean
): Promise<TransactionInstruction[]> {
  if (beneficiaries.length === 0) throw new Error('Capsule has no beneficiaries')
  if (assets.length === 0 && !includeSol) throw new Error('Capsule has no assets to distribute')

  const [capsule] = getCapsulePDA(owner)
  const [beneficiarySet] = getBeneficiarySetPDA(owner)
  const [vault] = getCapsuleVaultPDA(owner)
  const instructions: TransactionInstruction[] = []

  for (const { mint, tokenProgram } of assets) {
    const vaultTokenAccount = ataFor(mint, vault, tokenProgram)
    const assignment = nftAssignments.find((item) => item.mint.equals(mint))
    if (assignment) {
      instructions.push(
        await (program.methods as any)
          .distributeNft(assignment.recipient)
          .accountsPartial({
            capsule,
            beneficiarySet,
            vault,
            tokenProgram,
            mint,
            vaultTokenAccount,
            recipientTokenAccount: ataFor(mint, assignment.recipient, tokenProgram),
          })
          .remainingAccounts([instructionsSysvarMeta])
          .instruction()
      )
      continue
    }

    instructions.push(
      await (program.methods as any)
        .distributeAssets()
        .accountsPartial({
          capsule,
          beneficiarySet,
          vault,
          systemProgram: SystemProgram.programId,
          tokenProgram,
          mint,
          vaultTokenAccount,
        })
        .remainingAccounts([
          ...beneficiaries.map((beneficiary) => ({
            pubkey: ataFor(mint, beneficiary.pubkey, tokenProgram),
            isSigner: false,
            isWritable: true,
          })),
          instructionsSysvarMeta,
        ])
        .instruction()
    )
  }

  if (includeSol) {
    instructions.push(
      await (program.methods as any)
        .distributeAssets()
        .accountsPartial({
          capsule,
          beneficiarySet,
          vault,
          systemProgram: SystemProgram.programId,
          tokenProgram: null,
          mint: null,
          vaultTokenAccount: null,
        })
        .remainingAccounts([
          ...beneficiaries.map((beneficiary) => ({
            pubkey: beneficiary.pubkey,
            isSigner: false,
            isWritable: true,
          })),
          instructionsSysvarMeta,
        ])
        .instruction()
    )
  }

  instructions.push(
    await (program.methods as any)
      .completePayout()
      .accountsPartial({ capsule, beneficiarySet, vault })
      .instruction()
  )
  return instructions
}

/** A legacy transaction has one fee-payer signature (65 serialized bytes). */
export function assertAtomicPayoutFits(
  payer: PublicKey,
  instructions: readonly TransactionInstruction[],
  maxBytes = 1232
): number {
  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: PublicKey.default.toBase58(),
  })
  for (const instruction of instructions) tx.add(instruction)
  let bytes: number
  try {
    bytes = tx.serializeMessage().length + 65
  } catch {
    throw new Error('This capsule has too many assets and beneficiaries for one atomic payout transaction. Reduce the selection before creating it.')
  }
  if (bytes > maxBytes) {
    throw new Error(
      `This capsule requires ${bytes} transaction bytes, above the ${maxBytes}-byte atomic payout limit. Reduce its assets or beneficiaries before creating it.`
    )
  }
  return bytes
}
