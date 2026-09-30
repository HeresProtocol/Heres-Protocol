import type { IntentCapsule } from '@/types'

/** Same inactivity OR fixed-date rule as the protocol. */
export function dashboardStatus(capsule: Pick<IntentCapsule, 'lastActivity' | 'inactivityPeriod' | 'targetDate' | 'isActive' | 'executedAt'>, now = Math.floor(Date.now() / 1000)) {
  const inactivityDue = capsule.lastActivity + capsule.inactivityPeriod
  const due = capsule.targetDate != null ? Math.min(inactivityDue, capsule.targetDate) : inactivityDue
  const remaining = Math.max(0, due - now)
  const state = capsule.executedAt ? 'Executed' : !capsule.isActive ? 'Draft' : remaining === 0 ? 'Ready to execute' : 'Active'
  return { state, due, remaining, urgent: capsule.isActive && !capsule.executedAt && remaining <= 14 * 86400 }
}
