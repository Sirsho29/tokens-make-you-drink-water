import type { MarkProps } from './types'

/** Simplified radial burst standing in for Claude Code. Drawn here, not a brand asset. */
export function ClaudeMark({ size = 14, className }: MarkProps): React.JSX.Element {
  const rays = [
    { angle: -90, length: 7.4 },
    { angle: -54, length: 6.2 },
    { angle: -18, length: 7.1 },
    { angle: 18, length: 6.1 },
    { angle: 54, length: 7.3 },
    { angle: 90, length: 6.3 },
    { angle: 126, length: 7.2 },
    { angle: 162, length: 6.2 },
    { angle: 198, length: 7.1 },
    { angle: 234, length: 6.3 },
    { angle: 270, length: 7.4 }
  ]

  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        {rays.map(({ angle, length }) => {
          const radians = (angle * Math.PI) / 180
          return (
            <line
              key={angle}
              x1={8 + Math.cos(radians) * 1.4}
              y1={8 + Math.sin(radians) * 1.4}
              x2={8 + Math.cos(radians) * length}
              y2={8 + Math.sin(radians) * length}
            />
          )
        })}
      </g>
    </svg>
  )
}
