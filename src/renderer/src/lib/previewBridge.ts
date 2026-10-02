import { DEFAULT_SETTINGS, SOURCE_ORDER } from '@shared/constants'
import { localDayKey } from '@shared/date'
import type { Settings, SourceId, SourceReading, WidgetState } from '@shared/types'
import { computeWater } from '@shared/water'
import type { TokenWaterApi } from '../../../preload/index.d'

/**
 * Stand-in for the Electron bridge so the widget can be opened in a normal browser
 * (`npm run dev:web`) for design review and UI tests. It mirrors the real main-process
 * behaviour — same water maths, same drink rules — over seeded local usage that keeps
 * accruing, so the glass visibly fills. It never touches the filesystem or network.
 */
export function createPreviewBridge(): TokenWaterApi {
  const seeded: Record<SourceId, SourceReading> = {
    'claude-code': reading('claude-code', 'ok', 61_400),
    codex: reading('codex', 'ok', 24_800),
    cursor: reading('cursor', 'ok', 9_200),
    manual: reading('manual', 'empty', 0)
  }

  let settings: Settings = { ...DEFAULT_SETTINGS }
  let glassesDrunk = 0
  let manualTokens = 0
  const listeners = new Set<(state: WidgetState) => void>()

  function readings(): SourceReading[] {
    return SOURCE_ORDER.map((source) => {
      if (!settings.enabledSources[source]) return reading(source, 'disabled', 0)
      if (source === 'manual') return reading('manual', manualTokens > 0 ? 'ok' : 'empty', manualTokens)
      return seeded[source]
    })
  }

  function state(): WidgetState {
    const rows = readings()
    const totalTokens = rows.reduce((sum, row) => sum + (row.status === 'ok' ? row.tokens : 0), 0)
    const water = computeWater(totalTokens, glassesDrunk, settings)
    return {
      usage: { date: localDayKey(), collectedAt: Date.now(), totalTokens, readings: rows },
      day: { date: localDayKey(), glassesDrunk, manualTokens },
      settings,
      water,
      activeSources: rows.filter((row) => row.status === 'ok' && row.tokens > 0).map((row) => row.source),
      platform: 'preview'
    }
  }

  function emit(): WidgetState {
    const next = state()
    for (const listener of listeners) listener(next)
    return next
  }

  // Tokens keep arriving while you watch, exactly as they would on a working machine.
  setInterval(() => {
    const row = seeded['claude-code']
    seeded['claude-code'] = { ...row, tokens: row.tokens + 700 + Math.round(Math.random() * 900) }
    emit()
  }, 1500)

  return {
    getState: async () => state(),
    refresh: async () => emit(),
    drinkGlass: async () => {
      if (state().water.glassesOwed > 0) glassesDrunk += 1
      return emit()
    },
    undoDrink: async () => {
      glassesDrunk = Math.max(0, glassesDrunk - 1)
      return emit()
    },
    updateSettings: async (patch) => {
      settings = {
        ...settings,
        ...patch,
        enabledSources: { ...settings.enabledSources, ...(patch.enabledSources ?? {}) }
      }
      return emit()
    },
    setManualTokens: async (tokens) => {
      manualTokens = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0
      return emit()
    },
    setWindowHeight: async () => undefined,
    hideWidget: async () => undefined,
    quit: async () => undefined,
    onStateChanged: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

function reading(source: SourceId, status: SourceReading['status'], tokens: number): SourceReading {
  return {
    source,
    status,
    tokens,
    breakdown: { input: Math.round(tokens * 0.78), output: Math.round(tokens * 0.22), cacheCreation: 0, cacheRead: 0 }
  }
}
