import type { MarkProps } from './types'

/** Pencil, for tokens typed in by hand. */
export function ManualMark({ size = 14, className }: MarkProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M10.6 1.9 L14.1 5.4 L5.8 13.7 L2 14.6 L2.9 10.8 Z" />
        <path d="M9 3.5 L12.5 7" />
      </g>
    </svg>
  )
}
