import type { SourceReading } from '@shared/types'

/**
 * Anything the app cannot see — claude.ai, ChatGPT web, a phone app — can be typed in
 * by hand. It behaves like any other source and resets with the day.
 */
export function collectManual(manualTokens: number): SourceReading {
  const tokens = Number.isFinite(manualTokens) && manualTokens > 0 ? Math.round(manualTokens) : 0
  return {
    source: 'manual',
    status: tokens > 0 ? 'ok' : 'empty',
    tokens,
    breakdown: { input: tokens, output: 0, cacheCreation: 0, cacheRead: 0 }
  }
}
