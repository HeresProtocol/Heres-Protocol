import { ART } from './ribbonArtwork'

type ArtName = keyof typeof ART

type Props = {
  art: ArtName
  className?: string
  /** Crop window in the artwork's own coordinates (x, y, width, height); defaults to the whole artwork. */
  window?: [number, number, number, number]
  /** How the ribbon lines appear: drawn on page load (hero), drawn while scrolling, or always shown. */
  draw?: 'load' | 'scroll' | 'none'
  /** Scroll-draw pacing from the prototypes: higher = the line finishes later. */
  pace?: number
  /** Marks a layer for LandingRibbons to position (hero photo / hero band). */
  layer?: string
}

/**
 * One piece of ribbon artwork from the Heres animation prototypes, rendered server-side as crisp
 * vector. Motion (drawing, line weight, hero placement) is applied by <LandingRibbons />; without
 * JavaScript or with reduced motion the artwork is simply shown complete.
 */
export function RibbonArt({ art, className, window: win, draw = 'none', pace = 0.4, layer }: Props) {
  const { width, height, paths } = ART[art]
  const [x, y, w, h] = win ?? [0, 0, width, height]
  return (
    <svg
      className={['hr-art', className].filter(Boolean).join(' ')}
      viewBox={`${x} ${y} ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-art={art}
      data-art-layer={layer}
    >
      {paths.map((p, i) => {
        if (p.role === 'draw') {
          // The header's two lines play in sequence: the sweep first, then the line leaving to the left.
          const order = p.id === 'headerRibbonLayer6' ? 2 : 1
          return (
            <path
              key={i}
              className="hr-art-line"
              d={p.d}
              pathLength={1}
              data-draw={draw === 'none' ? undefined : draw}
              data-order={draw === 'load' ? order : undefined}
              data-pace={draw === 'scroll' ? pace : undefined}
            />
          )
        }
        if (p.role === 'float') {
          return <path key={i} className={`hr-art-line hr-art-float hr-art-float-${art}-${p.float}`} d={p.d} />
        }
        return <path key={i} d={p.d} fill={p.fill} stroke={p.stroke ?? undefined} />
      })}
    </svg>
  )
}
