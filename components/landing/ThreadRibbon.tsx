import { RIBBONS, type RibbonName } from './ribbonPaths'

type Props = {
  name: RibbonName
  className?: string
}

/**
 * One landing-page ribbon as crisp vector art. It keeps the exact footprint of the
 * image it replaces (same viewBox, stretched like `object-fit: fill`), with the
 * shared ribbon colour and thickness.
 */
export function ThreadRibbon({ name, className }: Props) {
  const art = RIBBONS[name]
  return (
    <svg
      className={['hr-ribbon-svg', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${art.width} ${art.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {art.paths.map((d, i) => (
        <path key={i} d={d} strokeWidth={art.stroke} />
      ))}
    </svg>
  )
}
