interface DrinkButtonProps {
  disabled: boolean
  busy: boolean
  onDrink: () => void
}

export function DrinkButton({ disabled, busy, onDrink }: DrinkButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onDrink}
      disabled={disabled || busy}
      className="w-full rounded-[11px] border border-hairline bg-well px-3 py-2 text-[12px] font-medium text-ink transition-opacity duration-150 hover:bg-ink/10 active:bg-ink/15 disabled:cursor-default disabled:opacity-35"
    >
      I had a glass of water
    </button>
  )
}
