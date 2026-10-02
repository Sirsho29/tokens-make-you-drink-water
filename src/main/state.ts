import { DEFAULT_SETTINGS, SOURCE_ORDER } from '@shared/constants'
import { localDayKey } from '@shared/date'
import { computeWater } from '@shared/water'
import type { DayState, Settings, SourceId, UsageSnapshot, WidgetState } from '@shared/types'
import { createCollectorSet, emptySnapshot } from './collectors'
import type { AppStore } from './store'

type Listener = (state: WidgetState) => void

/**
 * Single source of truth for the widget: owns the day state, the settings, the latest
 * usage snapshot, and the derived water maths. Everything the UI shows comes from here.
 */
export function createStateService(store: AppStore) {
  const collectAll = createCollectorSet()
  const listeners = new Set<Listener>()
  let usage: UsageSnapshot = emptySnapshot()
  let syncing = false

  function settings(): Settings {
    const stored = store.get('settings')
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      enabledSources: { ...DEFAULT_SETTINGS.enabledSources, ...stored?.enabledSources }
    }
  }

  function day(): DayState {
    const stored = store.get('day')
    const today = localDayKey()
    if (!stored || stored.date !== today) {
      const fresh: DayState = { date: today, glassesDrunk: 0, manualTokens: 0 }
      store.set('day', fresh)
      return fresh
    }
    return stored
  }

  function snapshot(): WidgetState {
    const currentSettings = settings()
    const currentDay = day()
    const currentUsage = usage.date === currentDay.date ? usage : emptySnapshot()
    return {
      usage: currentUsage,
      day: currentDay,
      settings: currentSettings,
      water: computeWater(currentUsage.totalTokens, currentDay.glassesDrunk, currentSettings),
      activeSources: activeSources(currentUsage),
      platform: process.platform
    }
  }

  function emit(): WidgetState {
    const next = snapshot()
    for (const listener of listeners) listener(next)
    return next
  }

  async function sync(options: { forceCursor?: boolean } = {}): Promise<WidgetState> {
    if (syncing) return snapshot()
    syncing = true
    try {
      const currentDay = day()
      usage = await collectAll({
        settings: settings(),
        manualTokens: currentDay.manualTokens,
        ...(options.forceCursor ? { forceCursor: true } : {})
      })
    } catch {
      // Collectors already swallow their own failures; this is the final backstop.
    } finally {
      syncing = false
    }
    return emit()
  }

  return {
    snapshot,
    sync,
    subscribe(listener: Listener): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    drinkGlass(): WidgetState {
      const current = day()
      const water = computeWater(usage.totalTokens, current.glassesDrunk, settings())
      // Never let the drunk count run past what the tokens actually earned, otherwise
      // the next glass you owe would be silently pre-paid.
      if (water.glassesOwed > 0) {
        store.set('day', { ...current, glassesDrunk: current.glassesDrunk + 1 })
      }
      return emit()
    },
    undoDrink(): WidgetState {
      const current = day()
      store.set('day', { ...current, glassesDrunk: Math.max(0, current.glassesDrunk - 1) })
      return emit()
    },
    updateSettings(patch: Partial<Settings>): WidgetState {
      const next: Settings = {
        ...settings(),
        ...patch,
        enabledSources: { ...settings().enabledSources, ...(patch.enabledSources ?? {}) }
      }
      store.set('settings', next)
      return emit()
    },
    setManualTokens(tokens: number): WidgetState {
      const value = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0
      store.set('day', { ...day(), manualTokens: value })
      return emit()
    },
    /** Called at local midnight: clear the day and re-read from scratch. */
    async rollOverDay(): Promise<WidgetState> {
      store.set('day', { date: localDayKey(), glassesDrunk: 0, manualTokens: 0 })
      usage = emptySnapshot()
      return sync({ forceCursor: true })
    }
  }
}

export type StateService = ReturnType<typeof createStateService>

export function activeSources(usage: UsageSnapshot): SourceId[] {
  const withUsage = new Set(usage.readings.filter((r) => r.status === 'ok' && r.tokens > 0).map((r) => r.source))
  return SOURCE_ORDER.filter((source) => withUsage.has(source))
}
