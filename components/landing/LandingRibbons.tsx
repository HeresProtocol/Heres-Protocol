'use client'

import { useEffect } from 'react'

/*
 * Motion + placement for the landing ribbons rendered by <RibbonArt />.
 *
 * Placement notes (all artwork is drawn on the page's 1512px design frame, verified by fitting):
 * - header (1795x759): sits at (-302, 421) on the 1512x976 hero photo at 1:1. Its two floating
 *   loops match the ribbon printed in the original photo exactly; the sweep leaves the photo's
 *   bottom edge at x~1410 and reaches the figure 45-205px below it. Split into a photo layer
 *   (y 0-555 of the artwork) and a band layer (y 555-759) so it follows the photo's real crop.
 * - how (1536x1014): steps band coordinates + (24, 82); placed in CSS.
 * - people (1589x1770): couple at the privacy figures' position on the centred >=1200px grid; CSS.
 * - because (551x417): the ribbon printed on the beach photo, at (0, 170) of its 552x725; CSS.
 * - decide (1107x1124): figure = the dog-walker image, artwork offset (0, -624); CSS.
 */

const HERO_W = 1512
const HERO_SPLIT = 555 // artwork y where the hero photo ends (976 - 421)
const HERO_X = -302
const HERO_Y = 421
const FIGURE_X = 666 // centre of the figure holding the ribbon, artwork x

const LOAD_DELAY = 1200
const LOAD_STEP = 2600
const LOAD_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

function lineWeight() {
  return document.documentElement.clientWidth < 600 ? 3 : 4
}

/** The rendered box of the hero photo, honouring object-fit / object-position. */
function photoBox(img: HTMLImageElement, wrap: HTMLElement) {
  const r = wrap.getBoundingClientRect()
  const cs = getComputedStyle(img)
  if (cs.objectFit === 'cover') {
    const s = Math.max(r.width / HERO_W, r.height / 976)
    const [px, py] = cs.objectPosition.split(' ').map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5))
    return { left: r.left + (r.width - HERO_W * s) * px, top: r.top + (r.height - 976 * s) * py, s, bottom: r.top + (r.height - 976 * s) * py + 976 * s }
  }
  const s = r.width / HERO_W
  return { left: r.left, top: r.top, s, bottom: r.bottom }
}

function placeHero() {
  const img = document.querySelector<HTMLImageElement>('.hr-hero-bg-img')
  const wrap = document.querySelector<HTMLElement>('.hr-hero-bg-wrap')
  const photo = document.querySelector<SVGSVGElement>('[data-art-layer="hero-photo"]')
  const bandLayer = document.querySelector<SVGSVGElement>('[data-art-layer="hero-band"]')
  const band = bandLayer?.parentElement
  if (!img || !wrap || !photo || !bandLayer || !band) return

  const box = photoBox(img, wrap)
  const w = wrap.getBoundingClientRect()
  const s = box.s
  Object.assign(photo.style, {
    left: `${box.left - w.left + HERO_X * s}px`,
    top: `${box.top - w.top + HERO_Y * s}px`,
    width: `${1795 * s}px`,
    height: `${HERO_SPLIT * s}px`,
  })

  // Band below the photo: continue the same mapping when the figure is on screen (desktop, tablet);
  // when the photo crop pushes it off screen (phones), frame the figure ~30% across instead.
  const b = band.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  const figureX = box.left + (FIGURE_X + HERO_X) * s
  const continuous = figureX > vw * 0.08 && figureX < vw * 0.92
  const left = continuous ? box.left - b.left + HERO_X * s : b.width * 0.3 - FIGURE_X * s
  const top = continuous ? Math.max(0, box.bottom - b.top) : 0
  Object.assign(bandLayer.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${1795 * s}px`,
    height: `${(759 - HERO_SPLIT) * s}px`,
  })
  band.style.height = `${Math.ceil(top + (759 - HERO_SPLIT) * s + 12)}px`
}

function setLineWeights() {
  const target = lineWeight()
  document.querySelectorAll<SVGSVGElement>('svg.hr-art').forEach((svg) => {
    const vb = svg.viewBox.baseVal
    const width = svg.getBoundingClientRect().width
    if (!vb || !vb.width || !width) return
    svg.style.setProperty('--art-sw', String(target / (width / vb.width)))
  })
}

export function LandingRibbons() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const loadLines = Array.from(document.querySelectorAll<SVGPathElement>('path[data-draw="load"]'))
    const scrollLines = Array.from(document.querySelectorAll<SVGPathElement>('path[data-draw="scroll"]'))
    const timers: number[] = []
    let raf = 0

    const layout = () => {
      placeHero()
      setLineWeights()
    }

    const show = (path: SVGPathElement, progress: number) => {
      path.style.strokeDashoffset = String(1 - progress)
      path.style.opacity = progress > 0.002 ? '1' : '0' // hide the round cap's dot before the line starts
    }

    const drawOnScroll = () => {
      raf = 0
      const vh = window.innerHeight
      const scrollLeft = Math.max(0, document.documentElement.scrollHeight - vh - window.scrollY)
      for (const path of scrollLines) {
        const rect = path.getBoundingClientRect()
        const pace = Number(path.dataset.pace) || 0.4
        const span = rect.height + vh * pace
        // Near the end of the page there may not be enough scroll left to finish the line, so the
        // pace is stretched to make it complete exactly at the bottom of the page.
        const atEnd = (vh - (rect.top - scrollLeft)) / span
        const progress = ((vh - rect.top) / span) / Math.min(1, Math.max(atEnd, 0.01))
        show(path, Math.min(1, Math.max(0, progress)))
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(drawOnScroll) }
    const onResize = () => { layout(); onScroll() }

    layout()
    if (reduce) {
      ;[...loadLines, ...scrollLines].forEach((p) => show(p, 1))
    } else {
      // Hero: the sweep draws first, then the line leaving to the left (timings from the prototype).
      loadLines.forEach((p) => show(p, 0))
      for (const order of [1, 2]) {
        timers.push(window.setTimeout(() => {
          loadLines.filter((p) => p.dataset.order === String(order)).forEach((p) => {
            p.style.transition = `stroke-dashoffset ${LOAD_STEP}ms ${LOAD_EASE}`
            show(p, 1)
          })
        }, LOAD_DELAY + (order - 1) * LOAD_STEP))
      }
      drawOnScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
    }

    const img = document.querySelector<HTMLImageElement>('.hr-hero-bg-img')
    img?.addEventListener('load', layout)
    window.addEventListener('resize', onResize, { passive: true })
    const ro = new ResizeObserver(() => onResize())
    document.querySelectorAll('.hr-hero, .hr-hero-transition').forEach((el) => ro.observe(el))

    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      img?.removeEventListener('load', layout)
      ro.disconnect()
    }
  }, [])

  return null
}
