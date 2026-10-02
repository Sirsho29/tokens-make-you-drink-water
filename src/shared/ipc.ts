export const IPC = {
  getState: 'token-water:get-state',
  stateChanged: 'token-water:state-changed',
  refresh: 'token-water:refresh',
  drinkGlass: 'token-water:drink-glass',
  undoDrink: 'token-water:undo-drink',
  updateSettings: 'token-water:update-settings',
  setManualTokens: 'token-water:set-manual-tokens',
  setWindowHeight: 'token-water:set-window-height',
  hideWidget: 'token-water:hide-widget',
  quit: 'token-water:quit'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
