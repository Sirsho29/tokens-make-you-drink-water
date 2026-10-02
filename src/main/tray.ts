import { Menu, Tray, app, nativeImage, type BrowserWindow } from 'electron'
import { formatVolume } from '@shared/format'
import type { StateService } from './state'
import { renderTrayIconPng } from './trayIcon'
import { toggleWidget } from './widgetWindow'

export function createTray(window: BrowserWindow, state: StateService): Tray {
  const icon = nativeImage.createFromBuffer(renderTrayIconPng(32), { scaleFactor: 2 })
  if (process.platform === 'darwin') icon.setTemplateImage(true)

  const tray = new Tray(icon)
  tray.setToolTip('tokens make you drink water')

  const render = (): void => {
    const { water, settings, day } = state.snapshot()
    const owed = water.glassesOwed
    tray.setToolTip(
      `${owed} ${owed === 1 ? 'glass' : 'glasses'} owed · ${formatVolume(water.totalMl, settings.units)} today`
    )
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `${owed} ${owed === 1 ? 'glass' : 'glasses'} owed today`, enabled: false },
        { label: `${day.glassesDrunk} drunk since midnight`, enabled: false },
        { type: 'separator' },
        {
          label: 'I had a glass of water',
          enabled: owed > 0,
          click: () => {
            state.drinkGlass()
          }
        },
        { label: 'Refresh now', click: () => void state.sync({ forceCursor: true }) },
        { type: 'separator' },
        {
          label: window.isVisible() ? 'Hide widget' : 'Show widget',
          click: () => toggleWidget(window)
        },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CommandOrControl+Q', click: () => app.quit() }
      ])
    )
  }

  render()
  state.subscribe(render)
  window.on('show', render)
  window.on('hide', render)

  // On macOS a left click opens the menu unless we handle the click ourselves.
  tray.on('click', () => toggleWidget(window))

  return tray
}
