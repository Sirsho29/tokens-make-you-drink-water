import { CURSOR_SYNC_INTERVAL_MS, SOURCE_ORDER } from '@shared/constants'
import { localDayKey } from '@shared/date'
import type { Settings, SourceId, SourceReading, UsageSnapshot } from '@shared/types'
import { createClaudeCodeCollector } from './claudeCode'
import { createCodexCollector } from './codex'
import { createCursorCollector } from './cursor'
import { collectManual } from './manual'

export interface CollectInput {
  settings: Settings
  manualTokens: number
  now?: Date
  /** Force a Cursor request even if the throttle window has not elapsed. */
  forceCursor?: boolean
}

export function createCollectorSet() {
  const claude = createClaudeCodeCollector()
  const codex = createCodexCollector()
  const cursor = createCursorCollector()
  let lastCursor: { at: number; dayKey: string; reading: SourceReading } | null = null

  return async function collectAll(input: CollectInput): Promise<UsageSnapshot> {
    const now = input.now ?? new Date()
    const dayKey = localDayKey(now)
    const { settings } = input
    const countCacheReads = settings.countCacheReadTokens

    const readings = new Map<SourceId, SourceReading>()

    const [claudeReading, codexReading] = await Promise.all([
      settings.enabledSources['claude-code']
        ? claude({ now, countCacheReads })
        : Promise.resolve(disabled('claude-code')),
      settings.enabledSources.codex ? codex({ now, countCacheReads }) : Promise.resolve(disabled('codex'))
    ])
    readings.set('claude-code', claudeReading)
    readings.set('codex', codexReading)

    readings.set('cursor', await cursorReading())
    readings.set('manual', settings.enabledSources.manual ? collectManual(input.manualTokens) : disabled('manual'))

    const ordered = SOURCE_ORDER.map((id) => readings.get(id)).filter((r): r is SourceReading => Boolean(r))
    const totalTokens = ordered.reduce((sum, reading) => sum + (reading.status === 'ok' ? reading.tokens : 0), 0)

    return { date: dayKey, collectedAt: now.getTime(), totalTokens, readings: ordered }

    async function cursorReading(): Promise<SourceReading> {
      if (!settings.enabledSources.cursor) return disabled('cursor')
      const fresh =
        input.forceCursor ||
        !lastCursor ||
        lastCursor.dayKey !== dayKey ||
        now.getTime() - lastCursor.at >= CURSOR_SYNC_INTERVAL_MS
      if (!fresh && lastCursor) return lastCursor.reading

      const reading = await cursor({
        now,
        countCacheReads,
        allowNetwork: settings.allowCursorNetwork
      })
      lastCursor = { at: now.getTime(), dayKey, reading }
      return reading
    }
  }
}

function disabled(source: SourceId): SourceReading {
  return { source, status: 'disabled', tokens: 0 }
}

export function emptySnapshot(now: Date = new Date()): UsageSnapshot {
  return {
    date: localDayKey(now),
    collectedAt: now.getTime(),
    totalTokens: 0,
    readings: SOURCE_ORDER.map((source) => ({ source, status: 'empty' as const, tokens: 0 }))
  }
}
