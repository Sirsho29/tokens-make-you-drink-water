interface CounterProps {
  glassesOwed: number
  glassesDrunk: number
}

export function Counter({ glassesOwed, glassesDrunk }: CounterProps): React.JSX.Element {
  const noun = glassesOwed === 1 ? 'glass' : 'glasses'
  return (
    <div
      className="text-center"
      role="status"
      aria-live="polite"
      aria-label={`${glassesOwed} ${noun} of water owed today`}
    >
      <div className="text-[54px] font-light leading-none tracking-[-0.03em] tabular-nums text-ink">
        {glassesOwed}
      </div>
      <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">
        {noun} owed
      </div>
      {glassesDrunk > 0 ? (
        <div className="mt-1 text-[10px] tracking-wide text-ink-faint">
          {glassesDrunk} drunk today
        </div>
      ) : null}
    </div>
  )
}
