import type { TokenWaterApi } from '../../../preload/index.d'
import { createPreviewBridge } from './previewBridge'

let cached: TokenWaterApi | null = null

export const isElectron = typeof window !== 'undefined' && Boolean(window.tokenWater)

/** The real preload bridge when running inside Electron, a local preview otherwise. */
export function bridge(): TokenWaterApi {
  if (cached) return cached
  cached = window.tokenWater ?? createPreviewBridge()
  return cached
}
