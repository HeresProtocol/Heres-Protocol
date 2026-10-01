'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useHeresWallet } from '@/hooks/useHeresWallet'
import { CreateShell } from '@/components/create/CreateShell'
import { CREATE_RIBBONS } from '@/components/create/ribbons'
import { DeleteCapsuleDialog, CapsuleDeleted } from '@/components/dashboard/DeleteCapsuleDialog'
import { HdIcon } from '@/components/dashboard/icons'
import {
  agoWords,
  capsuleCode,
  capsuleTitle,
  forgetCapsuleLabels,
  formatPeriod,
  formatRemaining,
  joinNames,
  longDate,
  readCapsuleLabels,
  triggerShort,
  type CapsuleLabels,
} from '@/components/dashboard/meta'
import {
  executeIntent,
  distributeAssets,
  finalizeCapsule,
  undelegateCapsule,
  cancelCapsule,
  recoverVault,
  updateActivity,
  registerCapsuleOwnerForAutomation,
  getCapsuleAccountLocations,
} from '@/lib/solana'
import { getOrMintTeeToken } from '@/lib/tee'
import { getProgramId, getSolanaConnection } from '@/config/solana'
import { PER_TEE, getExplorerUrl, getNetworkDisplayLabel } from '@/constants'
import { buildIntentSignedMessage } from '@/utils/intentAuth'
import { bytesToBase64 } from '@/utils/intentClient'
import { inferAssetConfig } from '@/lib/assets'
import { ConfirmDialog, useToast } from '@/components/ui'
import { maskAddress } from '@/lib/format'
import { normalizeTxError } from '@/lib/errors'
import { useCapsuleDetail } from '@/hooks/queries/useCapsuleDetail'
import { WithdrawFundsDialog } from '@/components/capsule/WithdrawFundsDialog'
import { AddFundsDialog } from '@/components/capsule/AddFundsDialog'
import { EditBeneficiariesDialog } from '@/components/capsule/EditBeneficiariesDialog'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { isAdminWallet } from '@/lib/admin'
import { PrivyLoginButton } from '@/components/PrivyLoginButton'
import { getCapsuleVaultPDA } from '@/lib/program'
import { getVaultTokenAccounts } from '@/lib/spl'
import { formatBaseUnits, planMultiMintCancellation, type WalletFungibleAsset } from '@/lib/fungible-assets'
import { useAssetCatalog, isDevnet, RECIPIENT_COLORS } from '@/components/create/useAssetCatalog'
import { fmtAmount, fmtUsd, maskAddr } from '@/components/create/ui'
import {
  areCapsuleAccountsOnBase,
  capsuleSettlementGuidance,
  hasDelegatedCapsuleAccounts,
  isCapsulePreFire,
} from '@/lib/capsule-lifecycle'

type IntentDeliveryConfig = {
  enabled?: boolean
  secretRef?: string
  secretHash?: string
  recipientEmailHash?: string
  recipientEmail?: string
  deliveryChannel?: 'email' | 'sms'
}
type IntentParsed = {
  type: 'token' | 'nft'
  intent?: string
  assetSymbol?: string
  assetMint?: string | null
  cre?: IntentDeliveryConfig
  // Legacy payload key support
  premium?: IntentDeliveryConfig
}

export default function CapsuleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const wallet = useHeresWallet()
  // Detail pages are scoped to the capsule owner; admins may view any capsule.
  // This is a UI scope only -- the underlying account is public on-chain, while
  // the private beneficiary set stays TEE-gated to the owner regardless.
  const isAdmin = isAdminWallet(wallet.publicKey ?? null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const address = typeof params?.address === 'string' ? params.address : null

  // UI-only state
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error' | 'progress'; message: string } | null>(null)
  const [intentDispatchLoading, setIntentDispatchLoading] = useState(false)
  const [intentDispatchResult, setIntentDispatchResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)

  // Destructive-action dialogs
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelledReceipt, setCancelledReceipt] = useState<string | null>(null)
  const [deletedTitle, setDeletedTitle] = useState('Your capsule')
  const [confirmUndelegate, setConfirmUndelegate] = useState(false)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  // Asset-management dialogs
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showAddFunds, setShowAddFunds] = useState(false)
  const [showEditBeneficiaries, setShowEditBeneficiaries] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const {
    capsule,
    capsuleLoading,
    capsuleError,
    meta,
    isOwner,
    isIntentEnabled,
    accountLocations,
    accountLocationsLoading,
    accountLocationsError,
    vaultAssets,
    vaultAssetsLoading,
    vaultAssetsError,
    distributionComplete,
    distributionLoading,
    distributionError,
    intentDeliveryStatus,
    intentDeliveryLoading,
    intentDeliveryError,
    invalidateCapsule,
    retryCapsule,
    invalidateDistribution,
    invalidateVaultAssets,
  } = useCapsuleDetail({ address })

  const intentParsed = meta as IntentParsed | null
  const isNft = meta?.type === 'nft' || (capsule?.nftAssignments?.length ?? 0) > 0
  const isToken = !isNft
  const assetConfig = inferAssetConfig(meta ?? undefined)
  const intentConfig = intentParsed?.cre ?? intentParsed?.premium

  // Names typed at creation (this browser only), used for the title and recipient rows.
  const [labels, setLabels] = useState<CapsuleLabels | null>(null)
  useEffect(() => setLabels(readCapsuleLabels(capsule?.capsuleAddress)), [capsule?.capsuleAddress])

  // Vault assets, named and priced the same way as the capsule builder.
  const held = useMemo<WalletFungibleAsset[]>(
    () => [
      ...(vaultAssets.withdrawableSol > 0
        ? [{ key: 'sol', mint: null, decimals: 9, symbol: 'SOL', balanceUi: vaultAssets.withdrawableSol / 1e9, balanceBaseUnits: BigInt(vaultAssets.withdrawableSol), tokenProgram: null }]
        : []),
      ...vaultAssets.tokens.map((t) => ({
        key: t.mint.toBase58(),
        mint: t.mint.toBase58(),
        decimals: t.decimals,
        symbol: maskAddr(t.mint.toBase58(), 4, 4),
        balanceUi: Number(formatBaseUnits(t.amount, t.decimals)),
        balanceBaseUnits: t.amount,
        tokenProgram: t.tokenProgram.toBase58(),
      })),
    ],
    [vaultAssets]
  )
  const { catalog } = useAssetCatalog(held)

  // Opened from the dashboard's "Delete capsule" menu item.
  const wantsDelete = search?.get('delete') === '1'
  useEffect(() => {
    if (wantsDelete && capsule && isOwner && isCapsulePreFire(capsule.executedAt)) setDeleteOpen(true)
  }, [wantsDelete, capsule, isOwner])

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1400)
    } catch {
      /* clipboard blocked */
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation handlers (bodies unchanged; invalidate instead of setCapsule)
  // ---------------------------------------------------------------------------

  const handleExecuteIntent = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('execute')
    setActionResult(null)
    try {
      // Lean execute_intent is state-only and permissionless; beneficiaries live on-chain and are read
      // by distribute_assets, so nothing extra is passed here.
      const tx = await executeIntent(wallet as any, capsule.owner)
      setActionResult({ type: 'success', message: `Execute Intent TX: ${tx}` })
      toast({ message: 'Execute Intent submitted successfully.', variant: 'success' })
      await invalidateCapsule()
    } catch (err: any) {
      console.error('[Execute Intent] Error:', err)
      const msg = normalizeTxError(err)
      setActionResult({ type: 'error', message: msg })
      toast({ message: msg, variant: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDistributeAssets = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('distribute')
    setActionResult(null)
    let completedLegs = 0
    try {
      const liveLocations = await getCapsuleAccountLocations(capsule.owner)
      if (!areCapsuleAccountsOnBase(liveLocations)) {
        throw new Error(capsuleSettlementGuidance(liveLocations))
      }
      if (!capsule.beneficiaries.length) throw new Error('Capsule has no beneficiaries set')
      // Beneficiaries + shares are read from the on-chain capsule; distribute splits every vault asset
      // by share_bps (SPL legs first, then the SOL leg).
      const tx = await distributeAssets(
        wallet as any,
        capsule.owner,
        capsule.beneficiaries,
        capsule.nftAssignments ?? [],
        (progress) => {
          completedLegs = progress.completed
          setActionResult({
            type: 'progress',
            message: `Distributed ${progress.completed} asset leg${progress.completed === 1 ? '' : 's'}...`,
          })
        }
      )
      setActionResult({ type: 'success', message: `Distribute Assets TX: ${tx}` })
      toast({ message: 'Assets distributed to beneficiaries.', variant: 'success' })
    } catch (err: any) {
      console.error('[Distribute Assets] Error:', err)
      const msg = normalizeTxError(err)
      const partialNote = completedLegs > 0
        ? ` ${completedLegs} asset leg${completedLegs === 1 ? ' was' : 's were'} already distributed. Refresh and retry to process only the remaining vault assets.`
        : ''
      setActionResult({ type: 'error', message: `${msg}${partialNote}` })
      toast({ message: `${msg}${partialNote}`, variant: 'error' })
    } finally {
      await Promise.allSettled([
        invalidateDistribution(),
        invalidateVaultAssets(),
        invalidateCapsule(),
      ])
      setActionLoading(null)
    }
  }

  const handleFinalizeCapsule = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('finalize')
    setActionResult(null)
    try {
      const tx = await finalizeCapsule(wallet as any, capsule.owner)
      toast({ message: 'Capsule finalized and on-chain accounts closed.', variant: 'success' })
      setActionResult({ type: 'success', message: `Finalize Capsule TX: ${tx}` })
      await queryClient.invalidateQueries({ queryKey: queryKeys.capsule.all })
      router.push('/dashboard')
    } catch (err: any) {
      console.error('[Finalize Capsule] Error:', err)
      const msg = normalizeTxError(err)
      setActionResult({ type: 'error', message: err.message || 'Finalization failed' })
      toast({ message: msg, variant: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleUndelegate = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('undelegate')
    setActionResult(null)
    try {
      const liveLocations = await getCapsuleAccountLocations(capsule.owner)
      if (!hasDelegatedCapsuleAccounts(liveLocations)) {
        throw new Error('The capsule and beneficiary data are already settled on Solana. Refresh My Capsule to continue.')
      }
      // The two-step undelegate reveals the private BeneficiarySet from the TEE, which needs the
      // owner's auth token; reuse the session token (minted once) so there's no extra signMessage.
      const token = liveLocations.beneficiarySet === 'delegated'
        ? await getOrMintTeeToken(wallet as any)
        : undefined
      const tx = await undelegateCapsule(wallet as any, capsule.owner, token)
      // Token is now cached; invalidating the capsule query re-reads with the cached token.
      await invalidateCapsule()
      setActionResult({ type: 'success', message: `Undelegate TX: ${tx}` })
      toast({ message: 'Capsule undelegated from Ephemeral Rollup.', variant: 'success' })
    } catch (err: any) {
      console.error('[Undelegate] Error:', err)
      const msg = normalizeTxError(err)
      setActionResult({ type: 'error', message: msg })
      toast({ message: msg, variant: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  // Refresh on-chain state after a deposit/withdraw (vault balances + capsule). Used as the dialogs'
  // onWithdrawn / onDeposited callback so the balance-gated buttons re-evaluate immediately.
  const refreshVault = async () => {
    await Promise.all([invalidateVaultAssets(), invalidateCapsule()])
  }

  // Proof-of-life: bump last_activity so the inactivity deadline slides forward while active.
  const handleUpdateActivity = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('checkin')
    setActionResult(null)
    try {
      const tx = await updateActivity(wallet as any, capsule.owner)
      await invalidateCapsule()
      setActionResult({
        type: 'success',
        message: `Liveness updated. TX: ${tx}`,
      })
      toast({ message: 'Liveness updated - timer reset.', variant: 'success' })
    } catch (err: any) {
      console.error('[Update Activity] Error:', err)
      const msg = normalizeTxError(err)
      setActionResult({ type: 'error', message: msg })
      toast({ message: msg, variant: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  // Owner teardown: refund all funds + reclaim account rent, then permanently close the capsule.
  // Needs the Switch + BeneficiarySet undelegated to base first (Anchor's owner-check rejects a
  // still-delegated account), so the button is gated on !isDelegated - undelegate from ER first.
  const handleCancelCapsule = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('cancel')
    setActionResult(null)
    let recoveredMintCount = 0
    try {
      const liveLocations = await getCapsuleAccountLocations(capsule.owner)
      if (!areCapsuleAccountsOnBase(liveLocations)) {
        throw new Error(capsuleSettlementGuidance(liveLocations))
      }
      // Read every vault ATA at action time, including zero-balance accounts. recover_vault closes
      // each ATA and refunds its rent; cancel_capsule closes the final ATA plus the capsule PDAs.
      const [vaultPDA] = getCapsuleVaultPDA(capsule.owner)
      const tokenAccounts = await getVaultTokenAccounts(getSolanaConnection(), vaultPDA)
      const { recoverFirst, cancelWith } = planMultiMintCancellation(
        tokenAccounts.map((account) => account.mint)
      )
      for (const [index, mint] of recoverFirst.entries()) {
        setActionResult({
          type: 'progress',
          message: `Recovering vault token ${index + 1} of ${recoverFirst.length} before cancellation...`,
        })
        await recoverVault(wallet as any, capsule.owner, mint)
        recoveredMintCount += 1
      }
      setActionResult({ type: 'progress', message: 'Closing the capsule and reclaiming remaining assets...' })
      const tx = await cancelCapsule(wallet as any, cancelWith ?? undefined)
      setActionResult({ type: 'success', message: `Capsule cancelled and assets reclaimed. TX: ${tx}` })
      toast({ message: 'Capsule cancelled and assets reclaimed.', variant: 'success' })
      // The accounts are now closed; send the owner back to the list.
      setCancelledReceipt(capsule.capsuleAddress)
      forgetCapsuleLabels(capsule.capsuleAddress)
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: any) {
      console.error('[Cancel Capsule] Error:', err)
      const msg = normalizeTxError(err)
      const recoveryNote = recoveredMintCount > 0
        ? ` ${recoveredMintCount} token account${recoveredMintCount === 1 ? ' was' : 's were'} already recovered. Refresh the vault and retry cancellation.`
        : ''
      setActionResult({ type: 'error', message: `${msg}${recoveryNote}` })
      toast({ message: msg, variant: 'error' })
    } finally {
      await Promise.allSettled([invalidateVaultAssets(), invalidateCapsule()])
      setActionLoading(null)
    }
  }

  const handleRefreshAutomation = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('automation')
    setActionResult(null)
    try {
      await registerCapsuleOwnerForAutomation(capsule.owner.toBase58())
      setActionResult({
        type: 'success',
        message: 'Automation registry refreshed. The next external cron run should be able to discover this capsule.',
      })
      toast({ message: 'Automation registry refreshed.', variant: 'success' })
    } catch (err: any) {
      console.error('[Automation Refresh] Error:', err)
      const msg = normalizeTxError(err)
      setActionResult({
        type: 'error',
        message: msg,
      })
      toast({ message: msg, variant: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleIntentDispatch = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule || !wallet.signMessage) return
    setIntentDispatchLoading(true)
    setIntentDispatchResult(null)
    try {
      const owner = wallet.publicKey.toBase58()
      const timestamp = Date.now()
      const message = buildIntentSignedMessage({
        action: 'dispatch',
        owner,
        capsuleAddress: capsule.capsuleAddress,
        timestamp,
      })
      const signature = bytesToBase64(await wallet.signMessage(new TextEncoder().encode(message)))
      const res = await fetch('/api/intent-delivery/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-intent-signature': signature },
        body: JSON.stringify({ capsule: capsule.capsuleAddress, owner, timestamp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'CRE dispatch failed')
      setIntentDispatchResult({ type: 'success', message: `Intent Statement delivery ${data.status || 'completed'}` })
      toast({ message: 'Intent Statement delivery completed.', variant: 'success' })
      if (address) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.capsule.intentDelivery(address) })
      }
    } catch (err: any) {
      const msg = normalizeTxError(err)
      setIntentDispatchResult({ type: 'error', message: msg })
      toast({ message: msg, variant: 'error' })
    } finally {
      setIntentDispatchLoading(false)
    }
  }

  // Mint (or reuse) a TEE auth token and re-read the live private state from the TEE node.
  const handleReveal = async () => {
    if (!capsule || !wallet.publicKey) return
    setRevealing(true)
    setRevealError(null)
    try {
      // Mint the token (caches it in module-level map); then invalidate the capsule query
      // so the queryFn re-runs and reads the now-cached token at call time.
      await getOrMintTeeToken(wallet as any)
      if (address) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.capsule.byAddress(address) })
      }
    } catch (e: any) {
      setRevealError(normalizeTxError(e))
    } finally {
      setRevealing(false)
    }
  }


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (cancelledReceipt) {
    return (
      <CreateShell ribbons={CREATE_RIBBONS} success>
        <CapsuleDeleted title={deletedTitle} code={capsuleCode(cancelledReceipt)} />
      </CreateShell>
    )
  }

  const back = (
    <Link href="/dashboard" className="hd-back">
      <HdIcon.ArrowLeft /> Back to dashboard
    </Link>
  )

  if (capsuleLoading) {
    return (
      <CreateShell ribbons={CREATE_RIBBONS}>
        <div className="cf-card hd-card hd-card--detail">
          {back}
          <div className="hd-skeleton" role="status" aria-label="Loading capsule">
            <div className="hd-sk hd-sk--title" />
            <div className="hd-sk hd-sk--banner" />
            <div className="hd-sk hd-sk--panel" />
            <div className="hd-sk hd-sk--panel" />
          </div>
        </div>
      </CreateShell>
    )
  }

  if (capsuleError || !capsule) {
    return (
      <CreateShell ribbons={CREATE_RIBBONS}>
        <div className="cf-card hd-card hd-card--detail">
          {back}
          <section className="hd-empty" role="alert">
            <span className="hd-empty__icon hd-empty__icon--warn"><HdIcon.Alert /></span>
            <h2>{capsuleError === 'Failed to load capsule' ? 'We couldn’t load this capsule' : 'Capsule not found'}</h2>
            <p>{capsuleError === 'Failed to load capsule' ? 'The network didn’t respond. Your capsule is unaffected — try again in a moment.' : 'This capsule doesn’t exist anymore, or the link is incomplete.'}</p>
            <div className="hd-empty__actions">
              {capsuleError === 'Failed to load capsule' && (
                <button type="button" className="cf-btn cf-btn--light" onClick={() => void retryCapsule()}>Try again</button>
              )}
              <Link href="/dashboard" className="cf-btn cf-btn--ghost">Go to dashboard</Link>
            </div>
          </section>
        </div>
      </CreateShell>
    )
  }

  // Scope the detail view to the owner (or an admin). A non-owner sees a prompt to
  // connect or to open their own capsule instead of another wallet's.
  if (!isOwner && !isAdmin) {
    return (
      <CreateShell ribbons={CREATE_RIBBONS}>
        <div className="cf-card hd-card hd-card--detail">
          {back}
          <section className="hd-empty">
            <span className="hd-empty__icon"><HdIcon.Lock /></span>
            <h2>{wallet.connected ? 'This isn’t your capsule' : 'Sign in to see this capsule'}</h2>
            <p>
              {wallet.connected
                ? 'It belongs to another wallet. Capsule details are private to their owner.'
                : 'Capsule details are private to their owner. Connect the wallet that created it.'}
            </p>
            <div className="hd-empty__actions">
              {!wallet.connected && <PrivyLoginButton />}
              <Link href="/dashboard" className="cf-btn cf-btn--ghost">Go to dashboard</Link>
            </div>
          </section>
        </div>
      </CreateShell>
    )
  }

  /* ---------------- derived state (same rules as before) ---------------- */
  // Effective due time = the earlier of the inactivity deadline and the optional fixed target date.
  // The inactivity deadline slides forward on each heartbeat, so once it passes the fixed date the
  // date becomes the binding trigger - mirrors the on-chain `inactivity_due || date_due` condition.
  const inactivityDueTs = capsule.lastActivity + capsule.inactivityPeriod
  const effectiveDueTs = capsule.targetDate != null ? Math.min(inactivityDueTs, capsule.targetDate) : inactivityDueTs
  const nowSec = Math.floor(Date.now() / 1000)
  const status = capsule.executedAt
    ? 'Executed'
    : !capsule.isActive
      ? 'Draft'
      : effectiveDueTs < nowSec
        ? 'Expired'
        : 'Active'
  const isDelegated = hasDelegatedCapsuleAccounts(accountLocations)
  const accountsOnBase = areCapsuleAccountsOnBase(accountLocations)
  const beneficiarySetDelegated = accountLocations?.beneficiarySet === 'delegated'
  // While delegated, the private beneficiary list is readable only by the owner via a TEE auth token.
  const privateStateHidden = beneficiarySetDelegated && isOwner && capsule.beneficiaries.length === 0
  const dateOnly = capsule.targetDate != null && capsule.inactivityPeriod >= 90 * 365 * 86400

  const isExecuted = status === 'Executed' || Boolean(!capsule.isActive && capsule.executedAt)
  const isExpired = status === 'Expired'
  const isActive = status === 'Active'
  const preFire = isCapsulePreFire(capsule.executedAt)
  const isIntentDelivered = intentDeliveryStatus?.status === 'delivered' || intentDeliveryStatus?.status === 'dispatched'
  const isDistributed = Boolean(isExecuted && distributionComplete)
  const canExecute = Boolean(isOwner && isExpired && !isExecuted)
  const canUndelegate = Boolean(isDelegated && !accountLocationsLoading && !accountLocationsError)
  const canDistribute = Boolean(
    isOwner && isExecuted && accountsOnBase && !isDistributed && !accountLocationsLoading && !accountLocationsError && !distributionLoading && !distributionError
  )
  const canDispatchCre = Boolean(isOwner && isExecuted && isDistributed && isIntentEnabled && !isIntentDelivered)
  const settlementReady = Boolean(isExecuted && isDistributed && (!isIntentEnabled || isIntentDelivered))
  const canFinalize = Boolean(isOwner && settlementReady && !isDelegated)
  const canRefreshAutomation = Boolean(isOwner && (isExpired || isActive) && !isExecuted)
  // Proof-of-life is available only before the capsule fires.
  const canCheckIn = Boolean(isOwner && capsule.isActive && !dateOnly)
  // Owner early-exit (pre-fire only). Withdraw requires the vault to actually hold something.
  const canRecover = Boolean(isOwner && preFire && vaultAssets.hasWithdrawable && !vaultAssetsLoading && !vaultAssetsError)
  // Deletion needs the Switch + BeneficiarySet on base; when still delegated the dialog offers that step first.
  const canDelete = Boolean(isOwner && preFire && !accountLocationsLoading && !accountLocationsError && !vaultAssetsLoading && !vaultAssetsError)
  const deleteNeedsPrepare = Boolean(isOwner && preFire && isDelegated && !accountsOnBase)
  // Deposit works regardless of delegation state (the program reads the capsule as a raw AccountInfo).
  const canAddFunds = Boolean(isOwner && preFire && isToken)
  // Legacy capsules remain editable. New lifecycles seal the TEE configuration before arming.
  const canEditBeneficiaries = Boolean(isToken && isOwner && !capsule.inheritanceSealed && !capsule.executedAt && capsule.beneficiaries.length > 0)

  /* ---------------- display values ---------------- */
  const recipientAddrs = capsule.beneficiaries.map((b) => b.pubkey.toBase58())
  const title = capsuleTitle(labels, recipientAddrs)
  const code = capsuleCode(capsule.capsuleAddress)
  const funded = catalog.filter((a) => (a.balanceBaseUnits ?? 0n) > 0n)
  const totalUsd = funded.length && funded.every((a) => a.usdPrice != null) ? funded.reduce((s, a) => s + (a.balanceUi ?? 0) * (a.usdPrice ?? 0), 0) : null
  const valueText = vaultAssetsLoading
    ? 'Loading…'
    : totalUsd != null
      ? fmtUsd(totalUsd)
      : funded.length === 1
        ? `${fmtAmount(funded[0].balanceUi)} ${funded[0].displaySymbol}`
        : funded.length
          ? `${funded.length} assets`
          : 'Empty'
  const nameOf = (addr: string) => labels?.names[addr] || ''
  const labelNames = Object.values(labels?.names ?? {})
  const recipientsText = recipientAddrs.length
    ? joinNames(recipientAddrs.map((a) => nameOf(a) || maskAddr(a, 4, 4)))
    : labelNames.length
      ? joinNames(labelNames)
      : privateStateHidden
        ? 'Private'
        : '—'
  const recipientsWho = recipientAddrs.length
    ? joinNames(recipientAddrs.map((a) => nameOf(a) || maskAddr(a, 4, 4)))
    : labelNames.length
      ? joinNames(labelNames)
      : 'Your recipients'
  const remaining = Math.max(0, effectiveDueTs - nowSec)
  const elapsed = Math.min(1, Math.max(0, (nowSec - capsule.lastActivity) / Math.max(1, capsule.inactivityPeriod)))
  const soon = isActive && remaining <= 14 * 86400
  const statusChip = isExecuted
    ? { tone: 'done', text: 'Executed' }
    : status === 'Draft'
      ? { tone: 'warn', text: 'Setup incomplete' }
      : isExpired
        ? { tone: 'warn', text: 'Trigger reached' }
        : soon
          ? { tone: 'warn', text: `${formatRemaining(remaining)} left` }
          : { tone: 'ok', text: 'Active' }
  // The note is registered off-chain against the owner, so the capsule metadata often doesn't carry it;
  // fall back to what this browser recorded at creation.
  const hasNote = Boolean(intentConfig?.enabled || isIntentEnabled || labels?.note)

  // handleCancelCapsule sets cancelledReceipt only once the closing transaction confirms.
  const runDelete = async () => {
    setDeletedTitle(title)
    await handleCancelCapsule()
  }

  /* ---------------- settlement steps (post-trigger) ---------------- */
  type StepState = 'done' | 'current' | 'todo'
  const steps: { key: string; title: string; text: string; state: StepState; action?: { label: string; run: () => void; busy: boolean; enabled: boolean } }[] = []
  if (isExecuted || isExpired) {
    steps.push({
      key: 'execute',
      title: 'Execute the capsule',
      text: 'Marks the trigger as met and stops the capsule. Anyone can run this once the condition is reached.',
      state: isExecuted ? 'done' : 'current',
      action: canExecute ? { label: 'Execute now', run: handleExecuteIntent, busy: actionLoading === 'execute', enabled: !actionLoading } : undefined,
    })
    if (isDelegated || isExecuted) {
      steps.push({
        key: 'settle',
        title: 'Move to Solana for settlement',
        text: 'Brings the capsule and its recipient list back from the private rollup so assets can be paid out. Recipient addresses become public.',
        state: !isExecuted ? 'todo' : isDelegated ? 'current' : 'done',
        action: isExecuted && canUndelegate && isOwner ? { label: 'Move to Solana', run: () => setConfirmUndelegate(true), busy: actionLoading === 'undelegate', enabled: !actionLoading } : undefined,
      })
    }
    steps.push({
      key: 'distribute',
      title: 'Transfer assets to recipients',
      text: 'Pays every asset in the vault out by each recipient’s share.',
      state: isDistributed ? 'done' : isExecuted && accountsOnBase ? 'current' : 'todo',
      action: canDistribute ? { label: 'Transfer assets', run: handleDistributeAssets, busy: actionLoading === 'distribute', enabled: !actionLoading } : undefined,
    })
    if (isIntentEnabled) {
      steps.push({
        key: 'deliver',
        title: 'Deliver your note',
        text: 'Sends the encrypted note to your representative.',
        state: isIntentDelivered ? 'done' : isDistributed ? 'current' : 'todo',
        action: canDispatchCre && wallet.signMessage ? { label: 'Deliver note', run: handleIntentDispatch, busy: intentDispatchLoading, enabled: !intentDispatchLoading } : undefined,
      })
    }
    steps.push({
      key: 'finalize',
      title: 'Close the capsule',
      text: 'Closes the settled accounts so this wallet can create a new capsule. Reclaimed rent goes to the Heres protocol fee account.',
      state: settlementReady && !isDelegated ? 'current' : 'todo',
      action: canFinalize ? { label: 'Close capsule', run: () => setConfirmFinalize(true), busy: actionLoading === 'finalize', enabled: !actionLoading } : undefined,
    })
  }

  const explorer = (value: string) => getExplorerUrl('address', value)
  // Plain render helper (not a component), so React doesn't remount it on every render.
  const renderAddr = (value: string) => (
    <span className="hd-addr">
      <code title={value}>{maskAddr(value, 6, 6)}</code>
      <button type="button" onClick={() => copy(value)} aria-label="Copy address">{copied === value ? <HdIcon.Check /> : <HdIcon.Copy />}</button>
      <a href={explorer(value)} target="_blank" rel="noopener noreferrer" aria-label="Open in explorer"><HdIcon.External /></a>
    </span>
  )

  return (
    <CreateShell ribbons={CREATE_RIBBONS}>
      {/* Asset-management dialogs. key remounts each on open so internal form state starts fresh. */}
      <WithdrawFundsDialog
        key={showWithdraw ? 'withdraw-open' : 'withdraw-closed'}
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        owner={capsule.owner}
        wallet={wallet}
        assets={vaultAssets}
        assetSymbol={assetConfig.symbol}
        assetMint={intentParsed?.assetMint ?? null}
        onWithdrawn={refreshVault}
      />
      <AddFundsDialog
        key={showAddFunds ? 'addfunds-open' : 'addfunds-closed'}
        open={showAddFunds}
        onClose={() => setShowAddFunds(false)}
        owner={capsule.owner}
        wallet={wallet}
        onDeposited={refreshVault}
      />
      <EditBeneficiariesDialog
        key={showEditBeneficiaries ? 'editben-open' : 'editben-closed'}
        open={showEditBeneficiaries}
        onClose={() => setShowEditBeneficiaries(false)}
        owner={capsule.owner}
        wallet={wallet}
        current={capsule.beneficiaries}
        onUpdated={invalidateCapsule}
      />
      <DeleteCapsuleDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
          if (wantsDelete) router.replace(`/capsules/${capsule.capsuleAddress}`)
        }}
        title={title}
        code={code}
        valueText={valueText}
        recipientsText={recipientsText}
        recipientsWho={recipientsWho}
        trigger={triggerShort(capsule.inactivityPeriod, capsule.targetDate)}
        hasNote={hasNote}
        needsPrepare={deleteNeedsPrepare}
        checking={!canDelete}
        preparing={actionLoading === 'undelegate'}
        onPrepare={handleUndelegate}
        tokenAccounts={vaultAssets.tokens.length}
        deleting={actionLoading === 'cancel'}
        progress={actionResult?.type === 'progress' ? actionResult.message : null}
        error={actionResult?.type === 'error' ? actionResult.message : null}
        onConfirm={runDelete}
      />
      <ConfirmDialog
        open={confirmUndelegate}
        onClose={() => setConfirmUndelegate(false)}
        onConfirm={() => { setConfirmUndelegate(false); handleUndelegate() }}
        title="Move this capsule to Solana"
        description={
          <span>
            This commits the private recipient list from the TEE to the <strong>public Solana base layer</strong>. After this, recipient addresses are visible on-chain and <strong>no longer private</strong>. It’s required before assets can be transferred.
          </span>
        }
        confirmLabel="Move to Solana"
        variant="danger"
        typedConfirm="undelegate"
        loading={actionLoading === 'undelegate'}
      />
      <ConfirmDialog
        open={confirmFinalize}
        onClose={() => setConfirmFinalize(false)}
        onConfirm={() => { setConfirmFinalize(false); handleFinalizeCapsule() }}
        title="Close this capsule"
        description="This permanently closes the settled capsule, recipient and vault accounts. Their reclaimed rent is sent to the Heres protocol fee account. You can create a fresh capsule afterward with the same wallet."
        confirmLabel="Close capsule"
        variant="danger"
        typedConfirm="finalize"
        loading={actionLoading === 'finalize'}
      />

      <div className="cf-card hd-card hd-card--detail">
        {back}
        <header className="hd-dhead">
          <div className="hd-dhead__title">
            <h1>{title}</h1>
            <span className="hd-code" title={capsule.capsuleAddress}>#{code}</span>
            <span className={`hd-chip hd-chip--${statusChip.tone}`}>
              {statusChip.tone === 'warn' ? <HdIcon.Alert /> : <i />}
              {statusChip.text}
            </span>
          </div>
          {isOwner && preFire && (
            <button type="button" className="hd-delete-link" onClick={() => setDeleteOpen(true)} disabled={!canDelete || Boolean(actionLoading)} title={!canDelete ? 'Checking the capsule’s current state…' : undefined}>
              <HdIcon.Trash /> Delete this capsule
            </button>
          )}
        </header>

        {actionResult && actionResult.type !== 'progress' && !deleteOpen && (
          <div className={`hd-toast hd-toast--${actionResult.type}`} role={actionResult.type === 'error' ? 'alert' : 'status'}>
            {actionResult.type === 'success' ? <HdIcon.Check /> : <HdIcon.Alert />}
            <p>{actionResult.message}</p>
            <button type="button" onClick={() => setActionResult(null)} aria-label="Dismiss"><HdIcon.X /></button>
          </div>
        )}
        {actionResult?.type === 'progress' && !deleteOpen && (
          <div className="hd-toast hd-toast--progress" role="status"><HdIcon.Spinner /><p>{actionResult.message}</p></div>
        )}

        {/* ---- where things stand ---- */}
        {isActive && (
          <section className={`hd-timer${soon ? ' hd-timer--warn' : ''}`} aria-labelledby="hd-timer-h">
            <div className="hd-timer__top">
              <div>
                <p className="hd-kicker">{dateOnly ? 'Scheduled transfer' : 'Transfers if you stay inactive for ' + formatPeriod(capsule.inactivityPeriod)}</p>
                <h2 id="hd-timer-h">
                  {dateOnly ? `Transfers on ${longDate(capsule.targetDate!)}` : `Transfers in ${formatRemaining(remaining)}`}
                </h2>
                <p className="hd-timer__meta">
                  {dateOnly
                    ? `${formatRemaining(remaining)} from now. Wallet activity doesn’t change a fixed date.`
                    : <>Last active {agoWords(capsule.lastActivity)}. Using your wallet resets the clock automatically{capsule.targetDate != null ? `, or it transfers on ${longDate(capsule.targetDate)} — whichever comes first` : ''}.</>}
                </p>
              </div>
              {canCheckIn && (
                <button type="button" className="cf-btn cf-btn--light hd-timer__cta" onClick={handleUpdateActivity} disabled={Boolean(actionLoading)}>
                  {actionLoading === 'checkin' ? <><HdIcon.Spinner /> Checking in…</> : <><HdIcon.Pulse /> Check in now</>}
                </button>
              )}
            </div>
            {!dateOnly && (
              <div className="hd-meter" role="img" aria-label={`${Math.round(elapsed * 100)}% of the inactivity period has passed`}>
                <i style={{ width: `${Math.max(2, elapsed * 100)}%` }} />
              </div>
            )}
          </section>
        )}

        {status === 'Draft' && (
          <section className="hd-info hd-info--warn">
            <h2>This capsule’s setup didn’t finish</h2>
            <p>It can’t execute in this state and your assets are safe. Delete it to get everything back in your wallet, then create it again.</p>
          </section>
        )}

        {capsule.inheritanceSealed && isActive && (
          <section className="hd-info">
            <h2>Capsules can’t be edited once created</h2>
            <p>Recipients, shares and the trigger are locked for security. To change them, delete this capsule and create a new one. Your assets stay protected under these exact terms until you do.</p>
          </section>
        )}

        {steps.length > 0 && (
          <section className="hd-panel" aria-labelledby="hd-settle-h">
            <div className="hd-panel__h">
              <h2 id="hd-settle-h">{isExecuted ? 'Settlement' : 'The trigger has been reached'}</h2>
              {canRefreshAutomation && (
                <button type="button" className="hd-textbtn" onClick={handleRefreshAutomation} disabled={Boolean(actionLoading)}>
                  {actionLoading === 'automation' ? <HdIcon.Spinner /> : <HdIcon.Refresh />} Nudge automation
                </button>
              )}
            </div>
            {isExpired && !isExecuted && (
              <p className="hd-panel__lead">Execution normally runs on its own. If it hasn’t started, you can run each step yourself.</p>
            )}
            {isExecuted && isDelegated && <p className="hd-panel__lead">{capsuleSettlementGuidance(accountLocations)}</p>}
            <ol className="hd-steps">
              {steps.map((s, i) => (
                <li key={s.key} className={`hd-steps__item is-${s.state}`}>
                  <span className="hd-steps__dot">{s.state === 'done' ? <HdIcon.Check /> : i + 1}</span>
                  <div className="hd-steps__body">
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                  {s.action && s.state === 'current' && (
                    <button type="button" className="cf-btn cf-btn--light hd-steps__btn" onClick={s.action.run} disabled={!s.action.enabled || s.action.busy}>
                      {s.action.busy ? <><HdIcon.Spinner /> Working…</> : s.action.label}
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {distributionError && <p className="hd-panel__error">{distributionError}</p>}
            {intentDispatchResult && <p className={intentDispatchResult.type === 'error' ? 'hd-panel__error' : 'hd-panel__ok'}>{intentDispatchResult.message}</p>}
          </section>
        )}

        {/* ---- assets ---- */}
        <section className="hd-panel" aria-labelledby="hd-assets-h">
          <div className="hd-panel__h">
            <h2 id="hd-assets-h">Assets</h2>
            <div className="hd-panel__tools">
              {canAddFunds && <button type="button" className="hd-textbtn" onClick={() => setShowAddFunds(true)} disabled={Boolean(actionLoading)}><HdIcon.Plus /> Add funds</button>}
              {canRecover && <button type="button" className="hd-textbtn" onClick={() => setShowWithdraw(true)} disabled={Boolean(actionLoading)}>Withdraw</button>}
            </div>
          </div>
          {vaultAssetsLoading ? (
            <div className="hd-rows"><div className="hd-sk hd-sk--line" /><div className="hd-sk hd-sk--line" /></div>
          ) : vaultAssetsError ? (
            <div className="hd-inline-alert" role="alert">
              <p>{vaultAssetsError}</p>
              <button type="button" className="hd-textbtn" onClick={refreshVault}><HdIcon.Refresh /> Try again</button>
            </div>
          ) : funded.length === 0 ? (
            <p className="hd-panel__empty">
              {isExecuted ? 'The vault is empty — its assets have been transferred.' : 'There’s nothing in this capsule’s vault yet.'}
            </p>
          ) : (
            <>
              <ul className="hd-rows">
                {funded.map((a) => (
                  <li key={a.key} className="hd-asset">
                    <i style={{ background: a.color }} aria-hidden />
                    <span className="hd-asset__name">
                      <strong>{a.displaySymbol}</strong>
                      <small title={a.mint ?? undefined}>{a.mint ? (a.name === 'Unknown token' ? maskAddr(a.mint, 4, 4) : a.name) : 'Solana'}</small>
                    </span>
                    <span className="hd-asset__amt">
                      <strong>{fmtAmount(a.balanceUi)} {a.displaySymbol.length <= 8 ? a.displaySymbol : ''}</strong>
                      <small>{a.usdPrice != null && a.balanceUi != null ? `≈ ${fmtUsd(a.balanceUi * a.usdPrice)}` : '—'}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="hd-total">
                <span>Total value{isDevnet && totalUsd != null && <span className="cf-tag" title="Devnet balances priced at mainnet rates, for reference only">Indicative</span>}</span>
                <strong>{totalUsd != null ? fmtUsd(totalUsd) : '—'}</strong>
              </div>
            </>
          )}
        </section>

        {/* ---- recipients ---- */}
        <section className="hd-panel" aria-labelledby="hd-people-h">
          <div className="hd-panel__h">
            <h2 id="hd-people-h">
              {isNft ? 'NFT recipients' : 'Beneficiaries'}
              {!isNft && <span className="hd-panel__aside"> — same split across all assets</span>}
            </h2>
            {canEditBeneficiaries && (
              <button type="button" className="hd-textbtn" onClick={() => setShowEditBeneficiaries(true)}><HdIcon.Pencil /> Edit</button>
            )}
          </div>
          {privateStateHidden ? (
            <div className="hd-private">
              <span className="hd-private__icon"><HdIcon.Lock /></span>
              <div>
                <h3>Recipients are kept private</h3>
                <p>They’re sealed inside a secure enclave until the capsule executes. You can view them by signing a message with your wallet — nothing is sent on-chain.</p>
                {revealError && <p className="hd-panel__error">{revealError}</p>}
              </div>
              <button type="button" className="cf-btn cf-btn--pill" onClick={handleReveal} disabled={revealing}>
                {revealing ? <><HdIcon.Spinner /> Waiting for wallet…</> : <><HdIcon.Eye /> View recipients</>}
              </button>
            </div>
          ) : isNft && (capsule.nftAssignments?.length ?? 0) > 0 ? (
            <ul className="hd-rows">
              {capsule.nftAssignments!.map((a, i) => {
                const r = a.recipient.toBase58()
                return (
                  <li key={`${a.mint.toBase58()}-${i}`} className="hd-person">
                    <span className="cf-avatar" style={{ background: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }} aria-hidden>{(nameOf(r)[0] || 'N').toUpperCase()}</span>
                    <span className="hd-person__name">
                      <strong>{nameOf(r) || 'Recipient'}</strong>
                      {renderAddr(r)}
                    </span>
                    <span className="hd-person__share" title={a.mint.toBase58()}>NFT {maskAddr(a.mint.toBase58(), 4, 4)}</span>
                  </li>
                )
              })}
            </ul>
          ) : capsule.beneficiaries.length > 0 ? (
            <ul className="hd-rows">
              {capsule.beneficiaries.map((b, i) => {
                const addr = b.pubkey.toBase58()
                return (
                  <li key={`${addr}-${i}`} className="hd-person">
                    <span className="cf-avatar" style={{ background: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }} aria-hidden>{(nameOf(addr)[0] || 'N').toUpperCase()}</span>
                    <span className="hd-person__name">
                      <strong>{nameOf(addr) || `Recipient ${i + 1}`}</strong>
                      {renderAddr(addr)}
                    </span>
                    <span className="hd-person__share">
                      {funded.length === 1 && (
                        <span className="hd-person__amount">{fmtAmount((funded[0].balanceUi ?? 0) * b.shareBps / 10000)} {funded[0].displaySymbol} · </span>
                      )}
                      {(b.shareBps / 100).toFixed(b.shareBps % 100 === 0 ? 0 : 2)}%
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="hd-panel__empty">No recipients are set on-chain for this capsule.</p>
          )}
        </section>

        {/* ---- trigger & note ---- */}
        <section className="hd-panel" aria-labelledby="hd-trigger-h">
          <div className="hd-panel__h"><h2 id="hd-trigger-h">Trigger &amp; note</h2></div>
          <dl className="hd-kv">
            <div>
              <dt>Trigger</dt>
              <dd>
                {dateOnly
                  ? `On ${longDate(capsule.targetDate!)}`
                  : `After ${formatPeriod(capsule.inactivityPeriod)} of wallet inactivity${capsule.targetDate != null ? `, or on ${longDate(capsule.targetDate)}` : ''}`}
              </dd>
            </div>
            {!isActive && <div><dt>Last active</dt><dd>{agoWords(capsule.lastActivity)}</dd></div>}
            <div>
              <dt>Note</dt>
              <dd>{hasNote ? `Sealed — delivered to ${labels?.representative ? `your representative (${labels.representative})` : 'your representative'} after execution` : 'None attached'}</dd>
            </div>
            {hasNote && isExecuted && (
              <div>
                <dt>Delivery</dt>
                <dd>
                  {intentDeliveryLoading ? 'Checking…' : !isOwner ? 'Owner only' : intentDeliveryStatus?.status ? intentDeliveryStatus.status[0].toUpperCase() + intentDeliveryStatus.status.slice(1) : 'Pending'}
                </dd>
              </div>
            )}
          </dl>
          {intentParsed?.intent && <p className="hd-quote">{intentParsed.intent}</p>}
          {intentDeliveryStatus?.lastError && <p className="hd-panel__error">{normalizeTxError(intentDeliveryStatus.lastError)}</p>}
          {intentDeliveryError && <p className="hd-panel__error">{intentDeliveryError}</p>}
        </section>

        {/* ---- technical ---- */}
        <details className="hd-tech">
          <summary><HdIcon.Chevron /> Technical details</summary>
          <dl className="hd-kv">
            <div><dt>Network</dt><dd>{getNetworkDisplayLabel()}</dd></div>
            <div><dt>Capsule</dt><dd>{renderAddr(capsule.capsuleAddress)}</dd></div>
            <div><dt>Owner</dt><dd>{renderAddr(capsule.owner.toBase58())}</dd></div>
            <div><dt>Program</dt><dd>{renderAddr(getProgramId().toBase58())}</dd></div>
            <div><dt>Privacy</dt><dd>Private Ephemeral Rollup (TEE){isDelegated ? ' · running privately' : ' · settled on Solana'}</dd></div>
            <div><dt>Settlement</dt><dd>{capsule.inheritanceSealed ? 'Sealed' : 'Editable (legacy)'}</dd></div>
            <div><dt>TEE docs</dt><dd><a className="hd-link" href={PER_TEE.DOCS_URL} target="_blank" rel="noopener noreferrer">How private monitoring works <HdIcon.External /></a></dd></div>
          </dl>
        </details>
      </div>
    </CreateShell>
  )
}
