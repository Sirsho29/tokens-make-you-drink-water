import { useCallback, useEffect, useState } from 'react'
import { SETTINGS_HEIGHT, WIDGET_HEIGHT } from '@shared/constants'
import type { Settings } from '@shared/types'
import { Counter } from './components/Counter'
import { DrinkButton } from './components/DrinkButton'
import { Glass } from './components/Glass'
import { SettingsPanel } from './components/SettingsPanel'
import { SourceMarks } from './components/SourceMarks'
import { Totals } from './components/Totals'
import { bridge, isElectron } from './lib/bridge'
import { useWidgetState } from './lib/useWidgetState'

export function App(): React.JSX.Element {
  const { state, error, retry } = useWidgetState()
  const [showSettings, setShowSettings] = useState(false)
  const [drinking, setDrinking] = useState(false)
  const api = bridge()

  useEffect(() => {
    const height = showSettings ? SETTINGS_HEIGHT : WIDGET_HEIGHT
    void api.setWindowHeight(height)
    // In the browser preview there is no window to resize, so grow the mount instead.
    if (!isElectron) {
      const root = document.getElementById('root')
      if (root) root.style.height = `${height}px`
    }
  }, [api, showSettings])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setShowSettings(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const drink = useCallback(async () => {
    setDrinking(true)
    try {
      await api.drinkGlass()
    } finally {
      setDrinking(false)
    }
  }, [api])

  const updateSettings = useCallback((patch: Partial<Settings>) => void api.updateSettings(patch), [api])

  return (
    <Shell onContextMenu={() => setShowSettings((open) => !open)}>
      {error ? (
        <Fallback
          title="Widget service unreachable"
          body="The background process stopped responding."
          actionLabel="Try again"
          onAction={retry}
        />
      ) : !state ? (
        <Fallback title="Reading today's usage" body="Checking local Claude Code, Codex and Cursor logs." />
      ) : showSettings ? (
        <SettingsPanel
          state={state}
          onClose={() => setShowSettings(false)}
          onUpdateSettings={updateSettings}
          onSetManualTokens={(tokens) => void api.setManualTokens(tokens)}
          onRefresh={() => void api.refresh()}
          onUndoDrink={() => void api.undoDrink()}
        />
      ) : (
        <div className="drag-region flex h-full flex-col px-4 pb-4 pt-3.5">
          <div className="flex items-start justify-between">
            <span className="text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">today</span>
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setShowSettings(true)}
              className="-mr-1 -mt-0.5 rounded-md px-1.5 py-0.5 text-[13px] leading-none text-ink-faint hover:bg-well hover:text-ink"
            >
              •••
            </button>
          </div>

          <div className="mt-1.5">
            <Counter glassesOwed={state.water.glassesOwed} glassesDrunk={state.day.glassesDrunk} />
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center py-2">
            <Glass fill={state.water.fillFraction} className="h-[132px] w-[104px]" />
          </div>

          <div className="space-y-2.5">
            <Totals
              totalTokens={state.water.totalTokens}
              totalMl={state.water.totalMl}
              units={state.settings.units}
            />
            <SourceMarks sources={state.activeSources} />
            <DrinkButton disabled={state.water.glassesOwed === 0} busy={drinking} onDrink={() => void drink()} />
          </div>
        </div>
      )}
    </Shell>
  )
}

/** The frosted pane itself: hairline border, soft shadow, rounded like a macOS widget. */
function Shell({
  children,
  onContextMenu
}: {
  children: React.ReactNode
  onContextMenu: () => void
}): React.JSX.Element {
  return (
    <div
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu()
      }}
      className="h-full w-full overflow-hidden rounded-[20px] border border-hairline bg-pane shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-2xl backdrop-saturate-150"
    >
      {children}
    </div>
  )
}

function Fallback({
  title,
  body,
  actionLabel,
  onAction
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}): React.JSX.Element {
  return (
    <div className="drag-region flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <Glass fill={0} className="h-[64px] w-[52px] opacity-50" />
      <p className="text-[12px] font-medium text-ink">{title}</p>
      <p className="text-[10.5px] leading-snug text-ink-muted">{body}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 rounded-[8px] border border-hairline px-2.5 py-1 text-[10.5px] text-ink-muted hover:bg-well hover:text-ink"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
