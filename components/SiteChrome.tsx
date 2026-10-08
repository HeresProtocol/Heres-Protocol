'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Renders the legacy app chrome (Navbar + Footer) only around the internal admin
 * console. All public routes own their header/footer treatment.
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
  // Only the internal admin console still uses the legacy app shell. Every public page (including
  // "page not found") ships its own current chrome, so nothing from the old frontend leaks through.
  const usesLegacyShell = pathname === '/admin' || pathname?.startsWith('/admin/')

  if (!usesLegacyShell) {
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
