import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Browser-only config for previewing the widget without Electron.
 * The renderer falls back to an in-memory bridge when `window.tokenWater`
 * is absent, so the whole UI is reviewable in a normal browser tab.
 */
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  server: {
    port: 43117,
    strictPort: true,
    host: '127.0.0.1'
  },
  build: {
    outDir: resolve('out/web'),
    emptyOutDir: true
  }
})
