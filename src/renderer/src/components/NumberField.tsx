import { useEffect, useState } from 'react'

interface NumberFieldProps {
  value: number
  onCommit: (value: number) => void
  step?: number
  min?: number
  suffix?: string
  label: string
}

/**
 * Commits on blur or Enter rather than per keystroke, so typing `2` on the way to `250`
 * does not briefly recalculate the whole day.
 */
export function NumberField({
  value,
  onCommit,
  step = 1,
  min = 0,
  suffix,
  label
}: NumberFieldProps): React.JSX.Element {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => setDraft(String(value)), [value])

  const commit = (): void => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed < min) {
      setDraft(String(value))
      return
    }
    onCommit(parsed)
  }

  return (
    <label className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={draft}
        step={step}
        min={min}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
        className="w-[64px] rounded-[7px] border border-hairline bg-well px-1.5 py-1 text-right text-[11px] tabular-nums text-ink outline-none focus:border-ink/40"
      />
      {suffix ? <span className="text-[10px] text-ink-faint">{suffix}</span> : null}
    </label>
  )
}
