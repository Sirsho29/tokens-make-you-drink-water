interface CounterProps {
  glassesOwed: number
  glassesDrunk: number
}

export function Counter({ glassesOwed, glassesDrunk }: CounterProps): React.JSX.Element {
  return (
    <div className="text-center">
      <div className="text-[54px] font-light leading-none tracking-[-0.03em] tabular-nums text-ink">
        {glassesOwed}
      </div>
      <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">
        {glassesOwed === 1 ? 'glass owed' : 'glasses owed'}
      </div>
      {glassesDrunk > 0 ? (
        <div className="mt-1 text-[10px] tracking-wide text-ink-faint">
          {glassesDrunk} drunk today
        </div>
      ) : null}
    </div>
  )
}
