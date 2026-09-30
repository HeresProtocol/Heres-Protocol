'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Renders the global app chrome (Navbar + Footer) around app content, except on
 * routes that ship their own full-bleed chrome. The landing page and capsule
 * creation wizard both own their header/footer treatment and must not inherit
 * the legacy app shell.
 */
export function SiteChrome({
  nav,
  footer,
  children,
}: {
  nav: ReactNode
  footer: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  const isSelfContained = pathname === '/' || pathname === '/create' || pathname === '/pricing' || pathname === '/dashboard' || pathname === '/capsules' || pathname?.startsWith('/capsules/')

  if (isSelfContained) {
    // These pages provide their own main surface and navigation.
    return <>{children}</>
  }

  return (
    <>
      {nav}
      <main className="min-h-screen">{children}</main>
      {footer}
    </>
  )
}
