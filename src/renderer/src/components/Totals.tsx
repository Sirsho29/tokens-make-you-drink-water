import { formatTokens, formatVolume } from '@shared/format'
import type { Units } from '@shared/types'

interface TotalsProps {
  totalTokens: number
  totalMl: number
  units: Units
}

export function Totals({ totalTokens, totalMl, units }: TotalsProps): React.JSX.Element {
  return (
    <p className="text-center text-[11px] tabular-nums text-ink-muted">
      {formatTokens(totalTokens)} tokens
      <span className="mx-1.5 text-ink-faint">·</span>
      {formatVolume(totalMl, units)}
    </p>
  )
}
