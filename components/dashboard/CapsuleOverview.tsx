'use client'

import Link from 'next/link'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import type { IntentCapsule } from '@/types'
import type { VaultTokenAccount } from '@/lib/spl'
import { formatBaseUnits } from '@/lib/fungible-assets'
import { formatDuration } from '@/utils/intent'
import { maskAddress } from '@/lib/format'

export function CapsuleOverview({ capsule, sol, tokens, hidden, loading, error, noteEnabled, canCancel, onCancel }: {
  capsule: IntentCapsule & { capsuleAddress: string }; sol: number; tokens: VaultTokenAccount[];
  hidden: boolean; loading: boolean; error: boolean; noteEnabled: boolean; canCancel: boolean; onCancel: () => void;
}) {
  return <section className="hd-overview">
    <header>
      <Link href="/dashboard" className="hd-back"><ArrowLeft size={16} />Back to dashboard</Link>
      <div className="hd-header"><div><h1>Your capsule</h1><p title={capsule.capsuleAddress}>{maskAddress(capsule.capsuleAddress)}</p></div>
        {canCancel && <button type="button" className="cf-btn cf-btn--ghost" onClick={onCancel}>Cancel this capsule</button>}
      </div>
    </header>
    <div className="hd-panel"><h2>Your capsule’s conditions</h2><p>{capsule.inheritanceSealed ? 'The inheritance configuration is sealed for this lifecycle. To change sealed recipients or conditions, cancel before execution and create a new capsule.' : 'This capsule’s configuration is not sealed yet. Review the available management actions below.'} Your assets remain in the capsule vault until distribution or a confirmed withdrawal or cancellation.</p></div>
    <div className="hd-panel"><h2>Assets in the vault</h2>
      {loading ? <p role="status">Loading current balances…</p> : error ? <p role="alert">Balances could not be loaded. Retry from the management section below.</p> : <>
        {sol > 0 && <div className="hd-asset"><span>SOL · Solana</span><strong>{(sol / 1e9).toLocaleString('en-US', { maximumFractionDigits: 9 })} SOL</strong></div>}
        {tokens.filter(t => t.amount > 0n).map(t => <div key={t.ata.toBase58()} className="hd-asset"><span title={t.mint.toBase58()}>{maskAddress(t.mint.toBase58())}</span><strong>{formatBaseUnits(t.amount, t.decimals)} tokens</strong></div>)}
        {!sol && !tokens.some(t => t.amount > 0n) && <p>No transferable assets remain in this vault.</p>}
        <p className="hd-footnote">Amounts exclude reserved account rent. Token addresses identify assets when their names are unavailable.</p>
      </>}
    </div>
    <div className="hd-panel"><h2>Beneficiaries · same split across fungible assets</h2>
      {hidden ? <p><LockKeyhole size={16} className="inline mr-2" />Your beneficiaries are sealed. Use “Reveal private state” below to read them with your owner wallet.</p> : <>
        {capsule.beneficiaries.map(b => <div key={b.pubkey.toBase58()} className="hd-asset"><span title={b.pubkey.toBase58()}>{maskAddress(b.pubkey.toBase58())}</span><strong>{b.shareBps / 100}%</strong></div>)}
        {capsule.nftAssignments?.map(a => <div key={a.mint.toBase58()} className="hd-asset"><span title={a.mint.toBase58()}>NFT {maskAddress(a.mint.toBase58())}</span><strong title={a.recipient.toBase58()}>{maskAddress(a.recipient.toBase58())}</strong></div>)}
        {!capsule.beneficiaries.length && !capsule.nftAssignments?.length && <p>No beneficiary details are available in this read.</p>}
      </>}
    </div>
    <div className="hd-panel"><h2>Trigger</h2><p>After {formatDuration(capsule.inactivityPeriod)} of capsule inactivity{capsule.targetDate != null ? ` or on ${new Date(capsule.targetDate * 1000).toLocaleDateString()}, whichever comes first` : ''}. A confirmed check-in resets the inactivity timer, not a fixed date.</p></div>
    <div className="hd-panel"><h2>Intent statement</h2><p>{noteEnabled ? 'An encrypted intent statement is attached. Its private content is delivered through the configured channel after execution; it is not exposed on this dashboard.' : 'No enabled intent-delivery configuration was found for this capsule.'}</p></div>
  </section>
}
