'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'
import { useCreateCapsuleForm, type InactivityUnit } from '@/hooks/useCreateCapsuleForm'
import { useSolBalance } from '@/hooks/queries/useSolBalance'
import { PLATFORM_FEE } from '@/constants'
import { MAX_BENEFICIARIES, MAX_INACTIVITY_DAYS, MAX_NFT_ASSIGNMENTS } from '@/lib/schemas'
import { formatBaseUnits, parseDecimalToBaseUnits } from '@/lib/fungible-assets'
import { isValidEmail } from '@/utils/validation'
import { isValidSolanaAddress } from '@/config/solana'
import { CreateShell, Stepper } from '@/components/create/CreateShell'
import { CREATE_RIBBONS } from '@/components/create/ribbons'
import { StepConnect } from '@/components/create/StepConnect'
import { StepAssets, type AssetTab } from '@/components/create/StepAssets'
import { StepBeneficiaries, StepNftRecipients, pctOf, recipientIssues, tooSmallShares, totalScaled, type ShareUnit } from '@/components/create/StepBeneficiaries'
import { FULL_PCT, displayPct, pctToScaled, relativeShareBps, scaledToNumber, scaledToPct, unitsForPct } from '@/lib/recipient-amount'
import { StepTrigger, PRESETS, longDate, periodLabel, type TriggerMode, type TriggerPreset } from '@/components/create/StepTrigger'
import { StepReview, type ReviewLine, type ReviewRecipient } from '@/components/create/StepReview'
import { CreateSuccess, type CreateSuccessDetails } from '@/components/create/CreateSuccess'
import { maskEmail, saveCapsuleLabels } from '@/components/dashboard/meta'
import { useAssetCatalog, useStakedSol, isDevnet, ASSET_COLORS } from '@/components/create/useAssetCatalog'
import { IconInfo, IconSpinner, IconShield, fmtAmount, fmtUsd, maskAddr } from '@/components/create/ui'

type Step = 0 | 1 | 2 | 3

const DAYS_PER_UNIT: Record<InactivityUnit, number> = { minutes: 1 / 1440, days: 1, months: 30, years: 365 }
const SHORT_UNIT: Record<InactivityUnit, [string, string]> = { minutes: ['min', 'min'], days: ['day', 'days'], months: ['mo', 'mos'], years: ['yr', 'yrs'] }
/** Date-only capsules still need an inactivity window on-chain; this one is long enough to never come first. */
const DATE_ONLY_INACTIVITY_YEARS = '99'

export default function CreatePage() {
  const form = useCreateCapsuleForm()
  const router = useRouter()
  const { authenticated, logout } = usePrivy()
  const external = useSolanaWallet()
  const address = form.publicKey?.toBase58() ?? ''

  const [step, setStepRaw] = useState<Step>(0)
  // Direction of the last move, so the step content slides the right way.
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  const setStep = (next: Step | ((s: Step) => Step)) => {
    const value = typeof next === 'function' ? next(step) : next
    setDir(value < step ? 'back' : 'fwd')
    setStepRaw(value)
  }
  const [tab, setTab] = useState<AssetTab>('sol')
  const [unit, setUnit] = useState<ShareUnit>('all')
  const [names, setNames] = useState<Record<string, string>>({})
  const [nftNames, setNftNames] = useState<string[]>([])
  const [mode, setMode] = useState<TriggerMode>('inactivity')
  const [preset, setPreset] = useState<TriggerPreset>('2y')
  const [inact, setInact] = useState<{ value: string; unit: InactivityUnit }>({ value: '2', unit: 'years' })
  const [date, setDate] = useState('')
  const [attempted, setAttempted] = useState<Partial<Record<Step, boolean>>>({})
  const [ack, setAck] = useState(false)
  const [started, setStarted] = useState(false)
  // A remembered wallet reconnects a moment after load. Hold a quiet loading state for that
  // moment so the Connect screen doesn't flash up and the content only slides in once.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 700)
    return () => clearTimeout(t)
  }, [])
  const [creationReceipt, setCreationReceipt] = useState<Omit<CreateSuccessDetails, 'capsuleId' | 'capsuleAddress'> | null>(null)

  /* ---------- one-time setup: token capsule, nothing preselected ---------- */
  useEffect(() => {
    if (started) return
    setStarted(true)
    form.setCapsuleType('token')
    if (form.selectedAssetKeys.length === 1 && !form.assetAmounts[form.selectedAssetKeys[0]]) {
      form.toggleAssetSelection(form.selectedAssetKeys[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  /* ---------- keep the hook's trigger fields in sync with the chosen trigger ---------- */
  const { setInactivityDays, setInactivityUnit, setTargetDate } = form
  useEffect(() => {
    if (mode === 'date') {
      setInactivityUnit('years')
      setInactivityDays(DATE_ONLY_INACTIVITY_YEARS)
      setTargetDate(date)
    } else {
      setInactivityUnit(inact.unit)
      setInactivityDays(inact.value)
      setTargetDate('')
    }
    // The hook's setters are recreated every render; the values are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, inact.value, inact.unit, date])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.scrollY > 40) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  /* ---------- wallet data ---------- */
  const { catalog, solPrice } = useAssetCatalog(form.walletAssets)
  const solBalance = useSolBalance(form.publicKey)
  const solTotal = solBalance.lamports == null ? null : solBalance.lamports / 1e9
  const staked = useStakedSol(form.publicKey)
  const stakedSol = staked.data ?? (staked.isError ? null : staked.isLoading ? null : 0)

  // undefined = still loading, null = no prices available for anything held
  const portfolioUsd = useMemo((): number | null | undefined => {
    if (solTotal == null) return undefined
    let sum = 0
    let priced = false
    if (solPrice != null && solTotal != null) {
      sum += (solTotal + (stakedSol ?? 0)) * solPrice
      priced = true
    }
    for (const a of catalog) {
      if (!a.mint || a.usdPrice == null || a.balanceUi == null) continue
      sum += a.balanceUi * a.usdPrice
      priced = true
    }
    return priced ? sum : null
  }, [catalog, solPrice, solTotal, stakedSol])

  const isNft = form.capsuleType === 'nft'
  const selectedAssets = useMemo(
    () =>
      form.selectedAssets
        .map((s) => {
          const c = catalog.find((a) => a.key === s.key)
          return c ? { ...c, amountStr: s.amount, amount: Number(s.amount || 0) } : null
        })
        .filter((a): a is NonNullable<typeof a> => a !== null),
    [form.selectedAssets, catalog]
  )

  /* ---------- step 1: assets ---------- */
  const toggleAsset = (key: string) => {
    const asset = catalog.find((a) => a.key === key)
    if (!asset) return
    const on = form.selectedAssetKeys.includes(key)
    form.toggleAssetSelection(key)
    // New selections lock the full available balance (for SOL: what's left after the fee reserve).
    if (!on && asset.balanceBaseUnits && asset.balanceBaseUnits > 0n) {
      form.setAssetAmount(key, formatBaseUnits(asset.balanceBaseUnits, asset.decimals))
    }
  }
  const onTab = (t: AssetTab) => {
    setTab(t)
    form.setCapsuleType(t === 'nfts' ? 'nft' : 'token')
  }
  const assetsOk = isNft
    ? form.selectedNftMints.length > 0
    : selectedAssets.length > 0 && selectedAssets.every((a) => {
      const units = parseDecimalToBaseUnits(a.amountStr, a.decimals)
      return units != null && units > 0n && a.balanceBaseUnits != null && units <= a.balanceBaseUnits
    })

  /* ---------- step 2: beneficiaries ---------- */
  const rows = form.beneficiaries
  const totalUsd = selectedAssets.length && selectedAssets.every((a) => a.usdPrice != null)
    ? selectedAssets.reduce((s, a) => s + a.amount * (a.usdPrice ?? 0), 0)
    : null
  const effectiveUnit: ShareUnit =
    unit === 'all' && totalUsd != null ? 'all' : selectedAssets.some((a) => a.key === unit) ? unit : totalUsd != null ? 'all' : selectedAssets[0]?.key ?? 'all'
  const pcts = rows.map((r) => pctOf(r.amount))
  const rowIssues = recipientIssues(rows.map((r, i) => ({ address: r.address, pct: pcts[i] })), address)
  // Exact allocated share (scaled; FULL_PCT = 100%). Not rounded, so small token amounts survive.
  const allocScaled = totalScaled(rows)
  const activeIdx = rows.map((r, i) => (r.address.trim() && pctToScaled(r.amount) > 0n ? i : -1)).filter((i) => i >= 0)
  const tinyShares = tooSmallShares(rows.map((r) => r.amount), activeIdx)
  const tokenPeopleOk = allocScaled > 0n && allocScaled <= FULL_PCT && tinyShares.size === 0 && rowIssues.every((x) => !x) && activeIdx.length > 0 && activeIdx.length <= MAX_BENEFICIARIES

  const nftIssues = recipientIssues(form.nftRecipients.map((r) => ({ address: r.address, pct: 1 })), address)
  const nftPeopleOk =
    form.selectedNftMints.length > 0 &&
    form.selectedNftMints.every((m) => {
      const r = form.nftRecipients[form.nftAssignments[m] ?? 0]
      return r && isValidSolanaAddress(r.address.trim())
    }) &&
    nftIssues.every((x, i) => !x || !form.nftRecipients[i].address.trim())
  const peopleOk = isNft ? nftPeopleOk : tokenPeopleOk

  const remainderToLast = () => {
    const last = rows.length - 1
    const others = rows.reduce((s, r, i) => (i === last ? s : s + pctToScaled(r.amount)), 0n)
    const rest = others >= FULL_PCT ? 0n : FULL_PCT - others
    form.setBeneficiaryShares(rows.map((r, i) => (i === last ? scaledToPct(rest) : r.amount)))
  }

  /* ---------- step 3: trigger & note ---------- */
  const inactDays = parseInt(inact.value, 10) * DAYS_PER_UNIT[inact.unit]
  const triggerOk =
    mode === 'date'
      ? Boolean(date) && date >= form.minTargetDate
      : Number.isFinite(inactDays) && inactDays > 0 && inactDays <= MAX_INACTIVITY_DAYS && form.inactivityUnitOptions.includes(inact.unit)
  const noteOk = Boolean(form.intent.trim()) && isValidEmail(form.intentEmail)
  const triggerStepOk = triggerOk && noteOk

  const onPreset = (p: TriggerPreset) => {
    setPreset(p)
    const found = PRESETS.find((x) => x.key === p)
    if (found) setInact({ value: found.value, unit: found.unit })
  }
  const periodShort = (() => {
    const n = parseInt(inact.value, 10)
    return Number.isFinite(n) ? `${n} ${SHORT_UNIT[inact.unit][n === 1 ? 0 : 1]}` : ''
  })()
  const shortDate = date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const triggerShort = mode === 'date' ? `Date · ${shortDate}` : `Inactivity · ${periodShort}`
  const triggerLong = mode === 'date' ? `On ${longDate(date)}` : `After ${periodLabel(inact.value, inact.unit)} of wallet inactivity`

  /* ---------- step 4: what actually goes into the capsule ---------- */
  const plan = useMemo(() => {
    if (isNft) return null
    // Each asset deposits exactly (protected amount x allocated %), in base units.
    const deposits = selectedAssets.map((a) => {
      const units = parseDecimalToBaseUnits(a.amountStr, a.decimals) ?? 0n
      const dep = unitsForPct(units, allocScaled)
      return { asset: a, dep, str: formatBaseUnits(dep, a.decimals) }
    })
    // Recipients' split of that deposit (on-chain share_bps), summing to exactly 10000.
    const bps = relativeShareBps(activeIdx.map((i) => pctToScaled(rows[i].amount)))
    const shares = activeIdx.map((i, k) => ({ i, shareBps: bps[k] }))
    return { deposits, shares }
  }, [isNft, allocScaled, selectedAssets, activeIdx, rows])

  const lines: ReviewLine[] = isNft
    ? form.selectedNftMints.map((mint, i) => {
        const nft = form.nftList.find((n) => n.mint === mint)
        return { key: mint, color: ASSET_COLORS[i % ASSET_COLORS.length], symbol: nft?.name || 'NFT', name: maskAddr(mint, 4, 4), amount: 1, usd: null }
      })
    : (plan?.deposits ?? []).map(({ asset, str }) => {
        const amount = Number(str)
        return { key: asset.key, color: asset.color, symbol: asset.displaySymbol, name: asset.name, amount, usd: asset.usdPrice == null ? null : amount * asset.usdPrice }
      })
  const reviewUsd = !isNft && lines.length && lines.every((l) => l.usd != null) ? lines.reduce((s, l) => s + (l.usd ?? 0), 0) : null

  const recipients: ReviewRecipient[] = isNft
    ? form.nftRecipients
        .map((r, i) => ({ r, i, count: form.selectedNftMints.filter((m) => (form.nftAssignments[m] ?? 0) === i).length }))
        .filter((x) => x.count > 0)
        .map(({ r, i, count }) => ({ name: nftNames[i] ?? '', address: r.address, detail: `${count} NFT${count === 1 ? '' : 's'}` }))
    // Each person's part of what goes into the capsule (the on-chain split), e.g. "100%" for one recipient.
    : activeIdx.map((i, k) => ({ name: names[rows[i].id] ?? '', address: rows[i].address, detail: `${displayPct((plan?.shares[k]?.shareBps ?? 0) / 100)}%` }))

  const blocker = (() => {
    if (!form.wallet.signMessage) return 'This wallet can’t sign messages, which is needed to seal your note. Try another wallet.'
    const tooSmall = plan?.deposits.find((d) => d.dep <= 0n)
    if (tooSmall) return `Your ${tooSmall.asset.displaySymbol} share is too small to lock. Increase the allocation or remove it.`
    return null
  })()

  const create = () => {
    if (!ack || blocker) return
    // Names stay in this browser so the dashboard can say "For Jake & Maria" (never sent anywhere).
    pendingLabels.current = Object.fromEntries(
      recipients.map((r) => [r.address.trim(), r.name.trim()] as const).filter(([addr, name]) => addr && name)
    )
    const single = lines.length === 1 ? lines[0] : null
    setCreationReceipt({
      recipientNames: recipients.map((r) => r.name.trim() || maskAddr(r.address, 4, 4)),
      totalLocked: isNft ? `${lines.length} NFT${lines.length === 1 ? '' : 's'}` : reviewUsd != null ? fmtUsd(reviewUsd) : single ? `${fmtAmount(single.amount)} ${single.symbol}` : `${lines.length} assets`,
      recipients: recipients.length,
      trigger: mode === 'date' ? shortDate : periodLabel(inact.value, inact.unit),
      triggerLabel: mode === 'date' ? 'Execution date' : 'Inactivity trigger',
    })
    if (isNft || !plan) {
      void form.handleCreate()
      return
    }
    void form.handleCreate({
      assetAmounts: Object.fromEntries(plan.deposits.map((d) => [d.asset.key, d.str])),
      beneficiaries: plan.shares.map((s) => ({ address: rows[s.i].address.trim(), share: String(s.shareBps / 100) })),
    })
  }

  const pendingLabels = useRef<Record<string, string> | null>(null)
  useEffect(() => {
    if (form.createdCapsuleAddress && pendingLabels.current) {
      saveCapsuleLabels(form.createdCapsuleAddress, pendingLabels.current, {
        note: Boolean(form.intent.trim()),
        representative: maskEmail(form.intentEmail),
      })
      pendingLabels.current = null
    }
  }, [form.createdCapsuleAddress])

  /* ---------- navigation ---------- */
  const gates: Record<Step, boolean> = { 0: assetsOk, 1: peopleOk, 2: triggerStepOk, 3: true }
  const next = () => {
    if (!gates[step]) {
      setAttempted((a) => ({ ...a, [step]: true }))
      return
    }
    setStep((s) => Math.min(3, s + 1) as Step)
  }
  const back = () => (step === 0 ? router.push('/') : setStep((s) => (s - 1) as Step))
  const disconnect = async () => {
    if (external.connected) await external.disconnect()
    if (authenticated) await logout()
    setStep(0)
  }

  /* ---------- render ---------- */
  if (form.createdCapsuleAddress) {
    const single = lines.length === 1 ? lines[0] : null
    const totalLocked = isNft
      ? `${lines.length} NFT${lines.length === 1 ? '' : 's'}`
      : reviewUsd != null
        ? fmtUsd(reviewUsd)
        : single
          ? `${fmtAmount(single.amount)} ${single.symbol}`
          : `${lines.length} assets`
    return (
      <CreateShell ribbons={CREATE_RIBBONS} success spinLogo>
        <CreateSuccess
          capsuleId={`#HR-${form.createdCapsuleAddress.slice(-4).toUpperCase()}`}
          capsuleAddress={form.createdCapsuleAddress}
          recipientNames={creationReceipt?.recipientNames ?? recipients.map((r) => r.name.trim() || maskAddr(r.address, 4, 4))}
          totalLocked={creationReceipt?.totalLocked ?? totalLocked}
          recipients={creationReceipt?.recipients ?? recipients.length}
          trigger={creationReceipt?.trigger ?? (mode === 'date' ? shortDate : periodLabel(inact.value, inact.unit))}
          triggerLabel={creationReceipt?.triggerLabel ?? (mode === 'date' ? 'Execution date' : 'Inactivity trigger')}
        />
      </CreateShell>
    )
  }

  const booting = !form.connected && (!settled || external.connecting)
  const status = (() => {
    if (booting) {
      return (
        <div className="cf-status">
          <div className="cf-status__inner">
            <span className="cf-status__icon"><IconSpinner /></span>
            <h1>Loading your wallet</h1>
            <p>One moment while we reconnect.</p>
          </div>
        </div>
      )
    }
    if (!form.connected) return null
    if (form.existingCapsuleCheck === 'idle' || form.existingCapsuleCheck === 'loading') {
      return (
        <div className="cf-status">
          <div className="cf-status__inner">
            <span className="cf-status__icon"><IconSpinner /></span>
            <h1>Checking your wallet</h1>
            <p>Making sure this wallet doesn&rsquo;t already have an active capsule.</p>
          </div>
        </div>
      )
    }
    if (form.existingCapsule) {
      return (
        <div className="cf-status">
          <div className="cf-status__inner">
            <span className="cf-status__icon"><IconShield /></span>
            <h1>You already have a capsule</h1>
            <p>Each wallet has one active capsule. Open it to review, update, or cancel it.</p>
            <div className="cf-foot__actions" style={{ marginLeft: 0, marginTop: 'calc(8 * var(--u))' }}>
              <button type="button" className="cf-btn cf-btn--ghost" onClick={disconnect}>Switch wallet</button>
              <Link href="/dashboard" className="cf-btn cf-btn--light">Go to My Capsule</Link>
            </div>
          </div>
        </div>
      )
    }
    if (form.existingCapsuleCheck === 'error') {
      return (
        <div className="cf-status">
          <div className="cf-status__inner">
            <span className="cf-status__icon"><IconInfo /></span>
            <h1>We couldn&rsquo;t check this wallet</h1>
            <p>{form.existingCapsuleCheckError}</p>
            <button type="button" className="cf-btn cf-btn--light" onClick={form.retryExistingCapsuleCheck}>Try again</button>
          </div>
        </div>
      )
    }
    return null
  })()

  return (
    <CreateShell ribbons={CREATE_RIBBONS} spinLogo={step >= 2}>
      <div className={`cf-card cf-card--step${step}`}>
        <Stepper current={form.connected ? step : 0} />
        <div className={`cf-swap cf-swap--${dir}`} key={status ? 'status' : !form.connected ? 'connect' : `step-${step}`}>
        {status ? (
          status
        ) : !form.connected ? (
          <StepConnect onBack={() => router.push('/')} />
        ) : step === 0 ? (
          <StepAssets
            address={address}
            onDisconnect={disconnect}
            portfolioUsd={portfolioUsd}
            pricesIndicative={isDevnet}
            tab={tab}
            onTab={onTab}
            catalog={catalog}
            solTotal={solTotal}
            stakedSol={stakedSol}
            solPrice={solPrice}
            selectedKeys={form.selectedAssetKeys}
            selectedAmounts={form.assetAmounts}
            onAmount={form.setAssetAmount}
            onToggleAsset={toggleAsset}
            tokensLoading={form.tokensLoading}
            tokensError={form.tokensError}
            onRetryTokens={form.retryTokens}
            nftList={form.nftList}
            nftLoading={form.nftListLoading}
            nftError={form.nftListError}
            onRetryNfts={form.retryNfts}
            selectedNftMints={form.selectedNftMints}
            onToggleNft={form.toggleNftSelection}
            isNftMode={isNft}
            error={form.error}
            canContinue={assetsOk}
            onBack={back}
            onContinue={next}
          />
        ) : step === 1 ? (
          isNft ? (
            <StepNftRecipients
              owner={address}
              recipients={form.nftRecipients}
              names={nftNames}
              onName={(i, v) => setNftNames((n) => { const c = [...n]; c[i] = v; return c })}
              onAddress={form.setNftRecipientAddress}
              onAdd={form.addNftRecipient}
              onRemove={(i) => { form.removeNftRecipient(i); setNftNames((n) => n.filter((_, k) => k !== i)) }}
              nfts={form.nftList}
              selectedMints={form.selectedNftMints}
              assignments={form.nftAssignments}
              onAssign={form.setNftAssignment}
              maxRecipients={MAX_NFT_ASSIGNMENTS}
              attempted={Boolean(attempted[1])}
              canContinue={peopleOk}
              onBack={back}
              onContinue={next}
            />
          ) : (
            <StepBeneficiaries
              owner={address}
              assets={selectedAssets}
              unit={effectiveUnit}
              onUnit={setUnit}
              rows={rows}
              names={names}
              onName={(id, v) => setNames((n) => ({ ...n, [id]: v }))}
              onAddress={(i, v) => form.updateBeneficiary(i, 'address', v)}
              onShare={(i, v) => form.updateBeneficiary(i, 'amount', v)}
              onAdd={() => form.addBeneficiary({ keepShares: true })}
              onRemove={(i) => form.removeBeneficiary(i, { keepShares: true })}
              onSplitEvenly={form.splitEvenly}
              onRemainderToLast={remainderToLast}
              maxRecipients={MAX_BENEFICIARIES}
              attempted={Boolean(attempted[1])}
              canContinue={peopleOk}
              onBack={back}
              onContinue={next}
            />
          )
        ) : step === 2 ? (
          <StepTrigger
            mode={mode}
            onMode={setMode}
            preset={preset}
            onPreset={onPreset}
            value={inact.value}
            unit={inact.unit}
            unitOptions={form.inactivityUnitOptions}
            onValue={(value) => setInact((x) => ({ ...x, value }))}
            onUnit={(u) => setInact((x) => ({ ...x, unit: u }))}
            date={date}
            minDate={form.minTargetDate}
            onDate={setDate}
            intent={form.intent}
            onIntent={form.setIntent}
            email={form.intentEmail}
            onEmail={form.setIntentEmail}
            reminder={form.intentReminderEnabled}
            onReminder={form.setIntentReminderEnabled}
            attempted={Boolean(attempted[2])}
            canContinue={triggerStepOk}
            onBack={back}
            onContinue={next}
          />
        ) : (
          <StepReview
            lines={lines}
            totalUsd={reviewUsd}
            recipients={recipients}
            unallocatedPct={isNft ? 0 : Math.max(0, 100 - scaledToNumber(allocScaled))}
            triggerShort={triggerShort}
            triggerLong={triggerLong}
            intent={form.intent}
            email={form.intentEmail}
            reminder={form.intentReminderEnabled}
            feeSol={PLATFORM_FEE.CREATION_FEE_SOL}
            isNft={isNft}
            multiSign={!form.wallet.isEmbedded}
            ack={ack}
            onAck={setAck}
            pending={form.isPending}
            progress={form.currentStep}
            error={form.error}
            blocker={blocker}
            onEdit={(s) => setStep(s)}
            onBack={back}
            onCreate={create}
          />
        )}
        </div>
      </div>
    </CreateShell>
  )
}
