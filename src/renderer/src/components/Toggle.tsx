interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Toggle({ checked, onChange, label }: ToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[16px] w-[28px] shrink-0 rounded-full border border-hairline transition-colors duration-150 ${
        checked ? 'bg-ink/70' : 'bg-well'
      }`}
    >
      <span
        className={`absolute top-[1.5px] h-[11px] w-[11px] rounded-full bg-knob shadow-sm transition-all duration-150 ${
          checked ? 'left-[14px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}
