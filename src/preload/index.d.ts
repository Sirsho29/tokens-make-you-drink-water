import type { Settings, WidgetState } from '@shared/types'

export interface TokenWaterApi {
  getState(): Promise<WidgetState>
  refresh(): Promise<WidgetState>
  drinkGlass(): Promise<WidgetState>
  undoDrink(): Promise<WidgetState>
  updateSettings(patch: Partial<Settings>): Promise<WidgetState>
  setManualTokens(tokens: number): Promise<WidgetState>
  setWindowHeight(height: number): Promise<void>
  hideWidget(): Promise<void>
  quit(): Promise<void>
  onStateChanged(listener: (state: WidgetState) => void): () => void
}

declare global {
  interface Window {
    tokenWater?: TokenWaterApi
  }
}
