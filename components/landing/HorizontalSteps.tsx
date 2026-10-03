'use client'

import { useEffect, useRef } from 'react'

export interface StepItem {
  num: string
  title: string
  description: string
}

const GAP = 16

/**
 * "How it works": the section pins while vertical scrolling slides the cards sideways.
 *
 * - The scroll runway is exactly the distance the cards travel (no dead scroll / gap below).
 * - Motion is written straight to the DOM inside requestAnimationFrame (no React re-render per frame).
 * - Cards still peeking in from the right are sage; each turns dark once fully in view.
 * - Before hydration, without JS, or with reduced motion it is a plain swipeable row.
 */
export function HorizontalSteps({ steps }: { steps: StepItem[] }) {
  const wrapRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const sticky = stickyRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!wrap || !sticky || !viewport || !track) return

    const cards = Array.from(track.children) as HTMLElement[]
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let travel = 0
    let pinned = false
    let raf = 0

    const setActive = () => {
      // A card turns dark once it is fully on screen; cards still peeking in from the right stay sage.
      const limit = document.documentElement.clientWidth + 1
      for (const card of cards) {
        const reached = !pinned || card.getBoundingClientRect().right <= limit
        card.classList.toggle('hr-step-card-active', reached)
        card.classList.toggle('hr-step-card-sage', !reached)
      }
    }

    const render = () => {
      raf = 0
      if (!pinned) return setActive()
      const runway = wrap.offsetHeight - sticky.offsetHeight
      const stickTop = parseFloat(sticky.style.top) || 0
      const progress = runway > 0 ? Math.min(1, Math.max(0, (stickTop - wrap.getBoundingClientRect().top) / runway)) : 0
      track.style.transform = `translate3d(${-progress * travel}px, 0, 0)`
      setActive()
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(render) }

    const measure = () => {
      const vw = document.documentElement.clientWidth
      // Align with the landing content rail (same left/right edges as the header).
      const rail = document.querySelector<HTMLElement>('.hr-header-inner')?.getBoundingClientRect()
      const left = rail ? rail.left : 20
      const right = rail ? vw - rail.right : 20
      const mobile = vw < 768
      const cardWidth = mobile
        ? Math.min(vw * 0.82, 380)
        : Math.max(300, Math.min(520, (vw - left - 2 * GAP) / 2.25))
      cards.forEach((c) => { c.style.width = `${cardWidth}px`; c.style.flex = `0 0 ${cardWidth}px` })
      track.style.gap = `${GAP}px`
      viewport.style.paddingLeft = `${left}px`
      viewport.style.paddingRight = `${right}px`

      const trackWidth = cards.length * cardWidth + (cards.length - 1) * GAP
      travel = Math.max(0, trackWidth - (vw - left - right))
      // Only pin when the whole section fits on screen below the fixed 96px site header
      // (e.g. not on a phone held sideways); otherwise it stays a swipeable row.
      const header = sticky.firstElementChild as HTMLElement | null
      const contentHeight = (header?.offsetHeight ?? 0) + 48 + viewport.offsetHeight
      // ...and only when the screen isn't far taller than the section (e.g. a phone in "desktop site"
      // mode, ~980x1800): there pinning would just expose a long empty runway, so it stays a row.
      pinned = travel > 0 && !reduceMotion.matches &&
        contentHeight + 96 <= window.innerHeight && window.innerHeight <= contentHeight * 2.2
      wrap.classList.toggle('is-pinned', pinned)
      // The pinned frame is only as tall as its content and is centred in the screen (but never under
      // the 96px header), so very tall screens (e.g. "desktop site" on a phone) get no empty bands.
      const free = window.innerHeight - contentHeight
      sticky.style.top = pinned ? `${free >= 192 ? Math.round(free / 2) : 96}px` : ''
      // Runway = pinned frame + exactly the horizontal travel, so scrolling ends the moment card 4 lands.
      wrap.style.height = pinned ? `${sticky.offsetHeight + travel}px` : ''
      if (!pinned) track.style.transform = ''
      render()
    }

    // Horizontal trackpad swipes / shift+wheel advance the pinned scroll too.
    const onWheel = (e: WheelEvent) => {
      if (pinned && Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 4) window.scrollBy({ top: e.deltaX })
    }

    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(sticky)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    reduceMotion.addEventListener('change', measure)
    wrap.addEventListener('wheel', onWheel, { passive: true })
    viewport.addEventListener('scroll', schedule, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', measure)
      reduceMotion.removeEventListener('change', measure)
      wrap.removeEventListener('wheel', onWheel)
      viewport.removeEventListener('scroll', schedule)
    }
  }, [])

  return (
    <section ref={wrapRef} className="hr-steps-pinned-wrap" id="how" aria-labelledby="hr-how-title">
      <div ref={stickyRef} className="hr-steps-sticky">
        <div className="hr-steps-header">
          <span className="hr-eyebrow">SIMPLE STEPS</span>
          <h2 id="hr-how-title">How it works</h2>
        </div>
        <div ref={viewportRef} className="hr-steps-track-viewport">
          <div ref={trackRef} className="hr-steps-track">
            {steps.map((step) => (
              <article key={step.num} className="hr-step-card hr-step-card-active">
                <div className="hr-step-card-top">
                  <span className="hr-step-badge">{step.num}</span>
                  {/* Fingerprint drawn as a CSS mask so its colour can change (white, red on hover). */}
                  <span className="hr-step-icon" aria-hidden="true" />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
