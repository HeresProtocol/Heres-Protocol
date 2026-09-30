'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

export interface StepItem {
  num: string
  title: string
  description: string
}

interface HorizontalStepsProps {
  steps: StepItem[]
}

export function HorizontalSteps({ steps }: HorizontalStepsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [cardWidth, setCardWidth] = useState<number>(460)
  const [leftPadding, setLeftPadding] = useState<number>(80)
  const [isDesktop, setIsDesktop] = useState<boolean>(true)

  useEffect(() => {
    const updateDimensions = () => {
      const vw = window.innerWidth
      const desktop = vw >= 768
      setIsDesktop(desktop)

      if (!desktop) return

      // Match the shared landing-page content rail instead of duplicating its dimensions here.
      const sharedContainer = document.querySelector<HTMLElement>('.hr-header-inner')
      const shellLeft = sharedContainer?.getBoundingClientRect().left
        ?? Math.max(20, (vw - Math.min(vw - 40, 1356)) / 2)
      setLeftPadding(shellLeft)

      // Calculate card width so:
      // Card 1 + Gap + Card 2 + Gap + Card 3 (quarter: 0.25) = vw - shellLeft
      // 2.25 * cardWidth + 2 * gap = vw - shellLeft
      const gap = 16
      const available = vw - shellLeft
      const calculated = (available - 2 * gap) / 2.25
      const clamped = Math.max(320, Math.min(500, calculated))
      setCardWidth(clamped)
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions, { passive: true })
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {
    if (!isDesktop) return

    let rafId: number
    const handleScroll = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const totalScroll = rect.height - window.innerHeight
      if (totalScroll <= 0) return

      const progress = Math.min(1, Math.max(0, -rect.top / totalScroll))
      setScrollProgress(progress)
    }

    const onScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(handleScroll)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [isDesktop])

  // Support horizontal trackpad swipe / shift+wheel to smoothly advance pinned scroll
  useEffect(() => {
    if (!isDesktop || !containerRef.current) return

    const el = containerRef.current
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 4) {
        window.scrollBy({ top: e.deltaX })
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [isDesktop])

  // Total horizontal distance to scroll so Card 4 is fully shown and flush on the right
  const gap = 16
  const totalTrackWidth = steps.length * cardWidth + (steps.length - 1) * gap
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
  const maxScroll = Math.max(0, totalTrackWidth - (viewportWidth - leftPadding) + 24)
  const translateX = isDesktop ? scrollProgress * maxScroll : 0

  return (
    <div
      ref={containerRef}
      className="hr-steps-pinned-wrap"
      id="how"
      aria-labelledby="hr-how-title"
    >
      <div className="hr-steps-sticky">
        <div className="hr-steps-header">
          <span className="hr-eyebrow">SIMPLE STEPS</span>
          <h2 id="hr-how-title">How it works</h2>
        </div>

        <div
          className="hr-steps-track-viewport"
          style={isDesktop ? { paddingLeft: `${leftPadding}px` } : undefined}
        >
          <div
            ref={trackRef}
            className="hr-steps-track"
            style={
              isDesktop
                ? {
                    transform: `translate3d(-${translateX}px, 0, 0)`,
                    gap: `${gap}px`,
                  }
                : undefined
            }
          >
            {steps.map((step, idx) => {
              // Card 1 & 2 are initially active. Card 3 activates when scrolling into view, Card 4 when scrolling further
              const isActive =
                idx < 2 ||
                (idx === 2 && scrollProgress > 0.28) ||
                (idx === 3 && scrollProgress > 0.65)

              return (
                <article
                  key={step.num}
                  className={`hr-step-card ${
                    isActive ? 'hr-step-card-active' : 'hr-step-card-sage'
                  }`}
                  style={isDesktop ? { width: `${cardWidth}px`, flex: `0 0 ${cardWidth}px` } : undefined}
                >
                  <div className="hr-step-card-top">
                    {isActive ? (
                      <span className="hr-step-badge">{step.num}</span>
                    ) : (
                      <span className="hr-step-num">{step.num}</span>
                    )}
                    <Image
                      src="/figma/fingerprint-white.png"
                      alt=""
                      width={36}
                      height={40}
                      className="hr-step-icon"
                      unoptimized
                    />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
