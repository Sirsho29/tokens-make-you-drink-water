import { BrowserWindow, app, ipcMain, type Tray } from 'electron'
import { SYNC_INTERVAL_MS } from '@shared/constants'
import { msUntilNextLocalMidnight } from '@shared/date'
import { IPC } from '@shared/ipc'
import type { Settings } from '@shared/types'
import { createStateService } from './state'
import { createStore } from './store'
import { createTray } from './tray'
import { createWidgetWindow, setWidgetHeight } from './widgetWindow'

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) app.quit()

let widget: BrowserWindow | null = null
let tray: Tray | null = null
let syncTimer: NodeJS.Timeout | null = null
let midnightTimer: NodeJS.Timeout | null = null

app.whenReady().then(() => {
  // A desktop widget has no business in the Dock or the app switcher.
  if (process.platform === 'darwin') app.dock?.hide()

  const store = createStore()
  const state = createStateService(store)

  widget = createWidgetWindow(store)
  tray = createTray(widget, state)

  state.subscribe((next) => {
    if (widget && !widget.isDestroyed()) widget.webContents.send(IPC.stateChanged, next)
  })

  widget.once('ready-to-show', () => {
    widget?.showInactive()
    void state.sync({ forceCursor: true })
  })

  registerIpc(state)
  syncTimer = setInterval(() => void state.sync(), SYNC_INTERVAL_MS)
  scheduleMidnightRollover(() => void state.rollOverDay())

  app.on('activate', () => widget?.showInactive())
})

function registerIpc(state: ReturnType<typeof createStateService>): void {
  ipcMain.handle(IPC.getState, () => state.snapshot())
  ipcMain.handle(IPC.refresh, () => state.sync({ forceCursor: true }))
  ipcMain.handle(IPC.drinkGlass, () => state.drinkGlass())
  ipcMain.handle(IPC.undoDrink, () => state.undoDrink())
  ipcMain.handle(IPC.updateSettings, (_event, patch: Partial<Settings>) => state.updateSettings(patch))
  ipcMain.handle(IPC.setManualTokens, (_event, tokens: number) => state.setManualTokens(tokens))
  ipcMain.handle(IPC.setWindowHeight, (_event, height: number) => {
    if (widget && !widget.isDestroyed()) setWidgetHeight(widget, height)
  })
  ipcMain.handle(IPC.hideWidget, () => widget?.hide())
  ipcMain.handle(IPC.quit, () => app.quit())
}

/** Re-arm after each midnight so the widget resets exactly at the day boundary. */
function scheduleMidnightRollover(onMidnight: () => void): void {
  if (midnightTimer) clearTimeout(midnightTimer)
  midnightTimer = setTimeout(() => {
    onMidnight()
    scheduleMidnightRollover(onMidnight)
  }, msUntilNextLocalMidnight() + 1_000)
}

// The widget lives in the tray: closing the window must not quit the app.
app.on('window-all-closed', () => undefined)

app.on('before-quit', () => {
  if (syncTimer) clearInterval(syncTimer)
  if (midnightTimer) clearTimeout(midnightTimer)
  tray?.destroy()
})

app.on('second-instance', () => widget?.showInactive())
