'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { formatDuration } from '@/utils/intent'
import { maskAddress } from '@/lib/format'

export function CancelCapsuleDialog({ open, onClose, onConfirm, address, recipients, inactivity, tokenAccounts, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; address: string; recipients: number;
  inactivity: number; tokenAccounts: number; loading: boolean;
}) {
  const [confirmation, setConfirmation] = useState('')
  const required = `CANCEL ${address.slice(-6)}`
  return <Modal open={open} onClose={onClose} title="Cancel this capsule?" className="hd-dialog">
    <p>This stops your capsule. Once confirmed, you would need to create a new capsule to protect these assets again.</p>
    <dl><div><dt>Capsule</dt><dd title={address}>{maskAddress(address)}</dd></div><div><dt>Recipients in this read</dt><dd>{recipients}</dd></div><div><dt>Trigger</dt><dd>{formatDuration(inactivity)} inactivity</dd></div></dl>
    <p>Funds and refundable account rent return to your wallet only after the transactions are confirmed. Your beneficiaries will no longer receive assets from this capsule. Its on-chain transaction history remains.</p>
    {tokenAccounts > 1 && <p>Your wallet may request multiple approvals to safely recover all token accounts. If recovery is interrupted, you can retry the remaining steps.</p>}
    <label htmlFor="capsule-cancel-confirm">Type <strong>{required}</strong> to confirm.</label>
    <input id="capsule-cancel-confirm" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} disabled={loading} />
    <div className="hd-dialog-actions"><button className="hd-keep" type="button" onClick={onClose} disabled={loading}>Keep capsule</button><button className="hd-cancel" type="button" onClick={onConfirm} disabled={loading || confirmation !== required}>{loading ? 'Cancelling…' : 'Cancel capsule'}</button></div>
  </Modal>
}
