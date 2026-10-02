import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { localDayKey } from '@shared/date'
import { tokensPerGlass } from '@shared/water'
import { createStateService } from '../src/main/state'
import type { AppStore, PersistedShape } from '../src/main/store'
import { tempDir } from './helpers/fixtures'

const originalEnv = { ...process.env }

/** Stands in for electron-store, which needs a running Electron app. */
function fakeStore(overrides: Partial<PersistedShape> = {}): AppStore {
  const data: PersistedShape = {
    settings: { ...DEFAULT_SETTINGS, allowCursorNetwork: false },
    day: { date: localDayKey(), glassesDrunk: 0, manualTokens: 0 },
    widgetPosition: null,
    ...overrides
  }
  return {
    get: (key: keyof PersistedShape) => data[key],
    set: (key: keyof PersistedShape, value: unknown) => {
      Object.assign(data, { [key]: value })
    }
  } as unknown as AppStore
}

beforeEach(async () => {
  process.env.CLAUDE_CONFIG_DIR = await tempDir('tmyw-claude-')
  process.env.CODEX_HOME = await tempDir('tmyw-codex-')
  delete process.env.CURSOR_SESSION_TOKEN
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('state service', () => {
  it('derives glasses owed from the tokens it collected', async () => {
    const perGlass = tokensPerGlass(DEFAULT_SETTINGS)
    const store = fakeStore({
      day: { date: localDayKey(), glassesDrunk: 0, manualTokens: Math.round(perGlass * 2.5) }
    })
    const state = createStateService(store)

    const after = await state.sync()
    expect(after.usage.totalTokens).toBe(Math.round(perGlass * 2.5))
    expect(after.water.glassesOwed).toBe(2)
    expect(after.water.fillFraction).toBeCloseTo(0.5, 2)
    expect(after.activeSources).toEqual(['manual'])
  })

  it('drinking lowers what you owe, never below zero, and keeps the partial fill', async () => {
    const perGlass = tokensPerGlass(DEFAULT_SETTINGS)
    const store = fakeStore({
      day: { date: localDayKey(), glassesDrunk: 0, manualTokens: Math.round(perGlass * 2.4) }
    })
    const state = createStateService(store)
    const before = await state.sync()

    const once = state.drinkGlass()
    expect(once.water.glassesOwed).toBe(1)
    expect(once.day.glassesDrunk).toBe(1)
    expect(once.water.fillFraction).toBeCloseTo(before.water.fillFraction, 6)

    state.drinkGlass()
    const extra = state.drinkGlass()
    expect(extra.water.glassesOwed).toBe(0)
    // The third press cannot pre-pay a glass the tokens have not earned.
    expect(extra.day.glassesDrunk).toBe(2)

    expect(state.undoDrink().water.glassesOwed).toBe(1)
  })

  it('notifies subscribers whenever the state changes', async () => {
    const state = createStateService(fakeStore())
    const seen: number[] = []
    const unsubscribe = state.subscribe((next) => seen.push(next.usage.totalTokens))

    state.setManualTokens(70_000)
    await state.sync()
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(seen.at(-1)).toBe(70_000)

    unsubscribe()
    state.setManualTokens(1)
    expect(seen.at(-1)).toBe(70_000)
  })

  it('merges settings patches without dropping the other keys', () => {
    const state = createStateService(fakeStore())
    const next = state.updateSettings({ units: 'us', enabledSources: { ...DEFAULT_SETTINGS.enabledSources, codex: false } })
    expect(next.settings.units).toBe('us')
    expect(next.settings.glassSizeMl).toBe(DEFAULT_SETTINGS.glassSizeMl)
    expect(next.settings.enabledSources).toMatchObject({ codex: false, 'claude-code': true })
  })

  it('starts a fresh day when the stored day is stale', () => {
    const store = fakeStore({ day: { date: '2000-01-01', glassesDrunk: 4, manualTokens: 9999 } })
    const snapshot = createStateService(store).snapshot()
    expect(snapshot.day).toEqual({ date: localDayKey(), glassesDrunk: 0, manualTokens: 0 })
    expect(snapshot.water.glassesOwed).toBe(0)
  })

  it('clears the counter and the manual entry at the day roll-over', async () => {
    const state = createStateService(fakeStore())
    state.setManualTokens(200_000)
    await state.sync()
    state.drinkGlass()

    const rolled = await state.rollOverDay()
    expect(rolled.day).toEqual({ date: localDayKey(), glassesDrunk: 0, manualTokens: 0 })
    expect(rolled.usage.totalTokens).toBe(0)
    expect(rolled.water.glassesOwed).toBe(0)
  })
})
