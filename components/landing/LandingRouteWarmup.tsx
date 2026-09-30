'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Keep the marketing routes ready before the first navigation in local development.
// Next's normal Link prefetch handles this in production.
export function LandingRouteWarmup() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname !== '/' && pathname !== '/pricing') return

    const routes = pathname === '/' ? ['/create', '/pricing'] : ['/', '/create']

    if (process.env.NODE_ENV !== 'development') {
      routes.forEach((route) => router.prefetch(route))
      return
    }

    // A document request makes the dev server compile the route while the
    // visitor is still reading, rather than blocking their first click.
    const timeout = window.setTimeout(() => {
      routes.forEach((route) => {
        void fetch(route, { credentials: 'same-origin', cache: 'no-store' }).catch(() => undefined)
      })
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [pathname, router])

  return null
}
