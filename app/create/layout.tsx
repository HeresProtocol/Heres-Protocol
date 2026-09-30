import type { ReactNode } from 'react'
import { Roboto } from 'next/font/google'
import './create-flow.css'

// The capsule builder is set in Roboto (per the design); the rest of the site keeps its own fonts.
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-roboto',
  display: 'swap',
})

export default function CreateLayout({ children }: { children: ReactNode }) {
  return <div className={roboto.variable}>{children}</div>
}
