import Store from 'electron-store'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { localDayKey } from '@shared/date'
import type { DayState, Settings } from '@shared/types'

export interface PersistedShape {
  settings: Settings
  day: DayState
  widgetPosition: { x: number; y: number } | null
}

export type AppStore = Store<PersistedShape>

export function createStore(): AppStore {
  return new Store<PersistedShape>({
    name: 'tokens-make-you-drink-water',
    defaults: {
      settings: DEFAULT_SETTINGS,
      day: { date: localDayKey(), glassesDrunk: 0, manualTokens: 0 },
      widgetPosition: null
    }
  })
}
