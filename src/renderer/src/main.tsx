import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WIDGET_HEIGHT, WIDGET_WIDTH } from '@shared/constants'
import { App } from './App'
import { isElectron } from './lib/bridge'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root')

// Outside Electron there is no window to fill, so give the widget its real size and
// stand it on a desktop-like backdrop.
if (!isElectron) {
  document.documentElement.classList.add('preview')
  container.style.width = `${WIDGET_WIDTH}px`
  container.style.height = `${WIDGET_HEIGHT}px`
  document.title = 'tokens make you drink water — preview'
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
