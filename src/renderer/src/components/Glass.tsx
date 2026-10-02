interface GlassProps {
  /** 0..1 progress towards the next glass. */
  fill: number
  className?: string
}

const INNER_TOP = 12
const INNER_BOTTOM = 116
const INNER_HEIGHT = INNER_BOTTOM - INNER_TOP

// A tumbler: slightly tapered walls, rounded base, open top.
const OUTER_PATH = 'M23 7 H77 L70.5 113 Q70 120 63 120 H37 Q30 120 29.5 113 Z'
const INNER_PATH = 'M26.6 11 H73.4 L67.2 112 Q66.9 116.6 61.6 116.6 H38.4 Q33.1 116.6 32.8 112 Z'

/**
 * Hand-drawn glass. The water is one translucent grey body that slides up as tokens
 * accumulate, clipped to the inside of the glass, with a slow drifting surface wave.
 */
export function Glass({ fill, className }: GlassProps): React.JSX.Element {
  const clamped = Number.isFinite(fill) ? Math.min(1, Math.max(0, fill)) : 0
  const surfaceY = INNER_TOP + (1 - clamped) * INNER_HEIGHT

  return (
    <svg
      viewBox="0 0 100 128"
      className={className}
      role="img"
      aria-label={`Glass ${Math.round(clamped * 100)} percent full`}
    >
      <defs>
        <clipPath id="glass-inside">
          <path d={INNER_PATH} />
        </clipPath>
      </defs>

      <g clipPath="url(#glass-inside)">
        <g
          style={{
            transform: `translateY(${surfaceY}px)`,
            transition: 'transform 900ms cubic-bezier(0.22, 0.61, 0.36, 1)'
          }}
        >
          <g className="water-surface">
            <path
              d="M-20 2 Q-10 -2 0 2 T20 2 T40 2 T60 2 T80 2 T100 2 T120 2 V140 H-20 Z"
              fill="var(--water)"
            />
          </g>
          <rect x="-20" y="3" width="160" height="140" fill="var(--water)" />
        </g>
      </g>

      {/* Glass body: hairline walls, a slightly heavier rim, no fill of its own. */}
      <path d={OUTER_PATH} fill="none" stroke="var(--glass-edge)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M23 7 H77" stroke="var(--glass-edge)" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M34 24 L31.4 96"
        stroke="var(--glass-edge)"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  )
}
