'use client'

import { useEffect } from 'react'

export function RibbonMotion() {
  useEffect(() => {
    const threads = document.querySelectorAll<SVGElement>('[data-thread]')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      threads.forEach((thread) => thread.classList.add('is-drawn'))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-drawn')
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.1 })
    threads.forEach((thread) => observer.observe(thread))
    return () => observer.disconnect()
  }, [])
  return null
}
