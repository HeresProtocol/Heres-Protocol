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
const BAND_LEAD = 900 // the band layer's window starts this far left of the artwork, for the lead-out

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
    left: `${left - BAND_LEAD * s}px`,
    top: `${top}px`,
    width: `${(1795 + BAND_LEAD) * s}px`,
    height: `${(759 - HERO_SPLIT) * s}px`,
  })
  band.style.height = `${top + (759 - HERO_SPLIT) * s + 12}px` // same formula as the CSS fallback
  photo.dataset.placed = ''
  bandLayer.dataset.placed = ''
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
    const timers: number[] = []
    let raf = 0

    // Each drawn line, with the lead-in / lead-out that continue it past the screen edge. Progress
    // runs -a..0 for the lead-in, 0..1 for the line itself and 1..1+b for the lead-out, where a and b
    // are the extensions' lengths relative to the line, so the tip moves at one speed throughout.
    type Line = { path: SVGPathElement; lead?: SVGPathElement; tail?: SVGPathElement; a: number; b: number }
    const lines = (mode: string): Line[] =>
      Array.from(document.querySelectorAll<SVGPathElement>(`path[data-draw="${mode}"][data-line]`)).map((path) => {
        const svg = path.ownerSVGElement!
        const ext = (side: string) =>
          svg.querySelector<SVGPathElement>(`path[data-ext="${side}"][data-of="${path.dataset.line}"]`) ?? undefined
        const lead = ext('start')
        const tail = ext('end')
        const len = path.getTotalLength() || 1
        return { path, lead, tail, a: lead ? lead.getTotalLength() / len : 0, b: tail ? tail.getTotalLength() / len : 0 }
      })
    const loadLines = lines('load')
    const scrollLines = lines('scroll')

    const layout = () => {
      placeHero()
      setLineWeights()
    }

    const show = (path: SVGPathElement | undefined, progress: number) => {
      if (!path) return
      const p = Math.min(1, Math.max(0, progress))
      path.style.strokeDashoffset = String(1 - p)
      path.style.opacity = p > 0.002 ? '1' : '0' // hide the round cap's dot before the line starts
    }
    const showLine = (l: Line, r: number) => {
      show(l.lead, l.a ? (r + l.a) / l.a : 1)
      show(l.path, r)
      show(l.tail, l.b ? (r - 1) / l.b : 0)
    }

    const drawOnScroll = () => {
      raf = 0
      const vh = window.innerHeight
      const scrollLeft = Math.max(0, document.documentElement.scrollHeight - vh - window.scrollY)
      for (const l of scrollLines) {
        const rect = l.path.getBoundingClientRect()
        const pace = Number(l.path.dataset.pace) || 0.4
        const span = rect.height + vh * pace
        // Near the end of the page there may not be enough scroll left to finish the line, so the
        // pace is stretched to make it complete exactly at the bottom of the page.
        const atEnd = (vh - (rect.top - scrollLeft)) / span
        showLine(l, ((vh - rect.top) / span) / Math.min(1, Math.max(atEnd, 0.01)))
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(drawOnScroll) }
    const onResize = () => { layout(); onScroll() }

    layout()
    if (reduce) {
      ;[...loadLines, ...scrollLines].forEach((l) => [l.lead, l.path, l.tail].forEach((p) => show(p, 1)))
    } else {
      // Hero: the sweep draws first, then the line leaving to the left (timings from the prototype);
      // its lead-out carries on past the screen edge once the line itself has finished.
      loadLines.forEach((l) => showLine(l, 0))
      const play = (p: SVGPathElement | undefined, at: number, ms: number, ease: string) => {
        if (!p) return
        timers.push(window.setTimeout(() => {
          p.style.transition = `stroke-dashoffset ${ms}ms ${ease}`
          show(p, 1)
        }, at))
      }
      for (const l of loadLines) {
        const start = LOAD_DELAY + (Number(l.path.dataset.order) - 1) * LOAD_STEP
        play(l.path, start, LOAD_STEP, LOAD_EASE)
        play(l.tail, start + LOAD_STEP * 0.9, LOAD_STEP * l.b, 'cubic-bezier(0.3, 0.6, 0.4, 1)')
      }
      drawOnScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
    }

    const img = document.querySelector<HTMLImageElement>('.hr-hero-bg-img')
    img?.addEventListener('load', layout)
    window.addEventListener('resize', onResize, { passive: true })
    const ro = new ResizeObserver(() => onResize())
    document.querySelectorAll('.hr-hero, .hr-hero-transition').forEach((el) => ro.observe(el))
    // Floating loops only animate while on screen, so off-screen artwork costs nothing while scrolling.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('hr-art-idle', !e.isIntersecting)
    })
    document.querySelectorAll('svg.hr-art').forEach((svg) => {
      if (svg.querySelector('.hr-art-float')) io.observe(svg)
    })

    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      img?.removeEventListener('load', layout)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return null
}
