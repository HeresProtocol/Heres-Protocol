'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Retain the layout entry point without animating or hiding artwork.
export function ScrollRibbonMotion() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/') return

    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (!window.location.hash || navigation?.type === 'reload') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }

    const followSectionLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return
      const link = event.target.closest<HTMLAnchorElement>('.hr-site a[href^="#"]')
      const hash = link?.getAttribute('href')
      if (!hash || hash === '#') return
      const section = document.getElementById(hash.slice(1))
      if (!section) return

      event.preventDefault()
      history.pushState(null, '', hash)
      section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }
    document.addEventListener('click', followSectionLink)

    return () => {
      document.removeEventListener('click', followSectionLink)
      history.scrollRestoration = previousRestoration
    }
  }, [pathname])

  return null
}
