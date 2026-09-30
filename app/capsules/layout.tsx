import type { ReactNode } from 'react'
import CreateLayout from '../create/layout'
import '@/components/dashboard/dashboard.css'
export default function CapsulesLayout({ children }: { children: ReactNode }) { return <CreateLayout>{children}</CreateLayout> }
