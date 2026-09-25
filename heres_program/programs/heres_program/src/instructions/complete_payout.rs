//! Final instruction in an atomic asset payout. For v3 capsules every asset distribution must
//! share this transaction, so a failure in any leg rolls back all beneficiary transfers.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};
use anchor_lang::Discriminator;

use crate::error::ErrorCode;
use crate::state::{BeneficiarySet, CapsuleVault, IntentCapsule};

#[derive(Accounts)]
pub struct CompletePayout<'info> {
    #[account(mut, seeds = [b"intent_capsule", capsule.owner.as_ref()], bump = capsule.bump)]
    pub capsule: Box<Account<'info, IntentCapsule>>,
    #[account(
        seeds = [b"beneficiary_set", capsule.owner.as_ref()],
        bump = capsule.beneficiaries_bump,
        constraint = beneficiary_set.owner == capsule.owner @ ErrorCode::Unauthorized,
    )]
    pub beneficiary_set: Box<Account<'info, BeneficiarySet>>,
    #[account(seeds = [b"capsule_vault", capsule.owner.as_ref()], bump = capsule.vault_bump)]
    pub vault: Box<Account<'info, CapsuleVault>>,
}

/// Distribution instructions call this guard before moving an asset. The transaction must contain
/// a later completion instruction for the SAME capsule and vault. That instruction fails unless
/// every registered asset and the available SOL have been drained, rolling back the whole batch.
pub fn require_completion_in_transaction<'info>(
    capsule: &IntentCapsule,
    capsule_key: Pubkey,
    vault_key: Pubkey,
    remaining_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    if !capsule.requires_atomic_payout() {
        return Ok(());
    }
    require!(!capsule.payout_complete(), ErrorCode::PayoutAlreadyCompleted);
    let sysvar_info = remaining_accounts
        .iter()
        .find(|account| account.key() == anchor_lang::solana_program::sysvar::instructions::ID)
        .ok_or(ErrorCode::AtomicPayoutRequired)?;
    let current = load_current_index_checked(sysvar_info)
        .map_err(|_| error!(ErrorCode::AtomicPayoutRequired))? as usize;
    for index in (current + 1)..(current + 65) {
        let Ok(instruction) = load_instruction_at_checked(index, sysvar_info) else {
            break;
        };
        if instruction.program_id != crate::ID
            || !instruction
                .data
                .starts_with(crate::instruction::CompletePayout::DISCRIMINATOR)
        {
            continue;
        }
        if instruction.accounts.first().map(|meta| meta.pubkey) == Some(capsule_key)
            && instruction.accounts.get(2).map(|meta| meta.pubkey) == Some(vault_key)
        {
            return Ok(());
        }
    }
    err!(ErrorCode::AtomicPayoutRequired)
}

pub fn handler(ctx: Context<CompletePayout>) -> Result<()> {
    let capsule = &mut ctx.accounts.capsule;
    require!(capsule.requires_atomic_payout(), ErrorCode::AtomicPayoutRequired);
    require!(!capsule.payout_complete(), ErrorCode::PayoutAlreadyCompleted);
    require!(!capsule.is_active, ErrorCode::CapsuleActive);
    require!(capsule.executed_at.is_some(), ErrorCode::CapsuleNotExecuted);
    require!(
        ctx.accounts.beneficiary_set.requires_seal()
            && ctx.accounts.beneficiary_set.is_sealed(),
        ErrorCode::InheritanceNotSealed
    );
    require!(
        capsule.config_commitment() == ctx.accounts.beneficiary_set.config_commitment(),
        ErrorCode::InvalidConfigurationCommitment
    );
    require!(ctx.accounts.vault.asset_count() == 0, ErrorCode::VaultNotEmpty);
    let vault_ai = ctx.accounts.vault.to_account_info();
    let rent_floor = Rent::get()?.minimum_balance(vault_ai.data_len());
    require!(vault_ai.lamports() <= rent_floor, ErrorCode::VaultNotEmpty);
    capsule.mark_payout_complete();
    Ok(())
}
