import { redirect } from 'next/navigation'

// "My capsule" lives on the dashboard; keep old /capsules links working.
export default function CapsulesIndex() {
  redirect('/dashboard')
}
