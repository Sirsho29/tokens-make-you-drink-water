import type { MarkProps } from './types'

/** Simplified faceted cursor wedge standing in for Cursor. Drawn here, not a brand asset. */
export function CursorMark({ size = 14, className }: MarkProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M8 1.4 L14 5 V11 L8 14.6 L2 11 V5 Z" />
        <path d="M2 5 L8 8.4 L14 5" />
        <path d="M8 8.4 V14.6" />
      </g>
    </svg>
  )
}
