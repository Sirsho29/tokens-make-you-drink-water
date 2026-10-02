import type { MarkProps } from './types'

/** Simplified six-petal rosette standing in for Codex. Drawn here, not a brand asset. */
export function CodexMark({ size = 14, className }: MarkProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        {[0, 60, 120].map((angle) => (
          <ellipse key={angle} cx="8" cy="8" rx="3.1" ry="6.6" transform={`rotate(${angle} 8 8)`} />
        ))}
      </g>
    </svg>
  )
}
