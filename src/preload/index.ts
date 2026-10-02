import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { Settings, WidgetState } from '@shared/types'

/**
 * The renderer gets exactly these calls and nothing else — no Node, no fs, no network.
 */
const api = {
  getState: (): Promise<WidgetState> => ipcRenderer.invoke(IPC.getState),
  refresh: (): Promise<WidgetState> => ipcRenderer.invoke(IPC.refresh),
  drinkGlass: (): Promise<WidgetState> => ipcRenderer.invoke(IPC.drinkGlass),
  undoDrink: (): Promise<WidgetState> => ipcRenderer.invoke(IPC.undoDrink),
  updateSettings: (patch: Partial<Settings>): Promise<WidgetState> =>
    ipcRenderer.invoke(IPC.updateSettings, patch),
  setManualTokens: (tokens: number): Promise<WidgetState> => ipcRenderer.invoke(IPC.setManualTokens, tokens),
  setWindowHeight: (height: number): Promise<void> => ipcRenderer.invoke(IPC.setWindowHeight, height),
  hideWidget: (): Promise<void> => ipcRenderer.invoke(IPC.hideWidget),
  quit: (): Promise<void> => ipcRenderer.invoke(IPC.quit),
  onStateChanged: (listener: (state: WidgetState) => void): (() => void) => {
    const handler = (_event: unknown, state: WidgetState): void => listener(state)
    ipcRenderer.on(IPC.stateChanged, handler)
    return () => ipcRenderer.removeListener(IPC.stateChanged, handler)
  }
}

export type TokenWaterApi = typeof api

contextBridge.exposeInMainWorld('tokenWater', api)
