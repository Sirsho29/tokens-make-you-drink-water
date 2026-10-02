import { join } from 'node:path'
import { BrowserWindow, screen, shell, type BrowserWindowConstructorOptions } from 'electron'
import { WIDGET_HEIGHT, WIDGET_WIDTH } from '@shared/constants'
import type { AppStore } from './store'

const EDGE_MARGIN = 24

export function createWidgetWindow(store: AppStore): BrowserWindow {
  const options: BrowserWindowConstructorOptions = {
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  }

  // Frosted glass is macOS-only; passing these elsewhere is either ignored or fatal,
  // so keep the window plain-transparent on Linux and Windows.
  if (process.platform === 'darwin') {
    options.vibrancy = 'under-window'
    options.visualEffectState = 'active'
    options.roundedCorners = true
  }

  const window = new BrowserWindow(options)
  positionWindow(window, store)

  // 'floating' keeps the widget above ordinary windows without stealing focus.
  window.setAlwaysOnTop(true, 'floating')
  try {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } catch {
    // Not supported on every window manager.
  }

  // Dragging emits a stream of move events; only write the final resting place.
  let persistTimer: NodeJS.Timeout | null = null
  const persistPosition = (): void => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      if (window.isDestroyed()) return
      const [x, y] = window.getPosition()
      store.set('widgetPosition', { x, y })
    }, 400)
  }
  window.on('moved', persistPosition)
  window.on('closed', () => {
    if (persistTimer) clearTimeout(persistTimer)
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  loadRenderer(window)
  return window
}

function loadRenderer(window: BrowserWindow): void {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL
  if (devServerUrl) {
    void window.loadURL(devServerUrl)
    return
  }
  void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
}

/** Restore the saved spot, clamped to a display that still exists; else top-right. */
function positionWindow(window: BrowserWindow, store: AppStore): void {
  const saved = store.get('widgetPosition')
  const work = screen.getPrimaryDisplay().workArea

  if (saved && isOnSomeDisplay(saved)) {
    window.setPosition(Math.round(saved.x), Math.round(saved.y))
    return
  }

  window.setPosition(
    Math.round(work.x + work.width - WIDGET_WIDTH - EDGE_MARGIN),
    Math.round(work.y + EDGE_MARGIN)
  )
}

function isOnSomeDisplay(point: { x: number; y: number }): boolean {
  return screen.getAllDisplays().some(({ bounds }) => {
    const insideX = point.x >= bounds.x - WIDGET_WIDTH / 2 && point.x <= bounds.x + bounds.width - 40
    const insideY = point.y >= bounds.y - 10 && point.y <= bounds.y + bounds.height - 40
    return insideX && insideY
  })
}

export function setWidgetHeight(window: BrowserWindow, height: number): void {
  if (window.isDestroyed()) return
  const clamped = Math.max(WIDGET_HEIGHT, Math.min(900, Math.round(height)))
  const [width] = window.getSize()
  if (window.getSize()[1] === clamped) return
  window.setSize(width, clamped, false)
}

export function toggleWidget(window: BrowserWindow): void {
  if (window.isVisible()) {
    window.hide()
    return
  }
  window.showInactive()
}
