import { SOURCE_LABELS } from '@shared/constants'
import type { SourceId } from '@shared/types'
import { SOURCE_MARKS } from './logos'

interface SourceMarksProps {
  /** Only sources that actually produced tokens today. */
  sources: SourceId[]
}

/** Marks only, no names — the names live in tooltips and in settings. */
export function SourceMarks({ sources }: SourceMarksProps): React.JSX.Element {
  if (sources.length === 0) {
    return <p className="text-center text-[10.5px] tracking-wide text-ink-faint">no usage found yet today</p>
  }

  return (
    <div className="flex items-center justify-center gap-3.5 text-ink-muted">
      {sources.map((source) => {
        const Mark = SOURCE_MARKS[source]
        return (
          <span key={source} title={SOURCE_LABELS[source]} className="flex items-center">
            <Mark size={15} />
          </span>
        )
      })}
    </div>
  )
}
