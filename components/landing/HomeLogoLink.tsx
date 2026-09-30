'use client'

import type { MouseEvent, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function HomeLogoLink({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname()

  const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== '/' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }

  return <Link href="/" className={className} aria-label="Back to home" onClick={goHome}>{children}</Link>
}
