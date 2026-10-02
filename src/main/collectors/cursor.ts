import { localDayKey, startOfLocalDay } from '@shared/date'
import type { SourceReading, TokenBreakdown } from '@shared/types'
import { describe, isPermissionError } from './errors'
import { buildCursorSession, findCursorStateDb, readCursorAccessToken } from './cursorState'
import { countedTokens, emptyBreakdown } from './tokenScan'

export const CURSOR_USAGE_ENDPOINT = 'https://cursor.com/api/dashboard/get-aggregated-usage-events'

const REQUEST_TIMEOUT_MS = 10_000

/**
 * Cursor stores no token counts on disk, so the only way to see them is the endpoint
 * its own dashboard calls, with the session already on this machine. Undocumented and
 * therefore best-effort: any change in shape degrades to "unavailable".
 */
export function sumCursorUsage(payload: unknown): TokenBreakdown {
  const total = emptyBreakdown()
  if (typeof payload !== 'object' || payload === null) return total
  const root = payload as Record<string, unknown>

  const aggregations = firstArray(root, ['aggregations', 'aggregatedUsageEvents', 'usageEvents'])
  if (aggregations) {
    for (const entry of aggregations) {
      if (typeof entry !== 'object' || entry === null) continue
      const row = entry as Record<string, unknown>
      total.input += loose(row.inputTokens)
      total.output += loose(row.outputTokens)
      total.cacheCreation += loose(row.cacheWriteTokens)
      total.cacheRead += loose(row.cacheReadTokens)
    }
    return total
  }

  total.input += loose(root.totalInputTokens)
  total.output += loose(root.totalOutputTokens)
  total.cacheCreation += loose(root.totalCacheWriteTokens)
  total.cacheRead += loose(root.totalCacheReadTokens)
  return total
}

export interface CursorFetchOptions {
  cookie: string
  now?: Date
  fetchImpl?: typeof fetch
}

export async function fetchCursorUsage(options: CursorFetchOptions): Promise<TokenBreakdown> {
  const now = options.now ?? new Date()
  const doFetch = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await doFetch(CURSOR_USAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: options.cookie,
        Origin: 'https://cursor.com',
        Referer: 'https://cursor.com/dashboard'
      },
      // Any userId, even 0, is treated as a request for another user's data and returns 401.
      body: JSON.stringify({
        startDate: String(startOfLocalDay(now).getTime()),
        endDate: String(now.getTime())
      }),
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`Usage endpoint returned ${response.status}`)
    }
    return sumCursorUsage(await response.json())
  } finally {
    clearTimeout(timer)
  }
}

export interface CursorOptions {
  now?: Date
  countCacheReads?: boolean
  allowNetwork?: boolean
  env?: NodeJS.ProcessEnv
  dbPaths?: string[]
  fetchImpl?: typeof fetch
}

export function createCursorCollector() {
  let cached: { dayKey: string; breakdown: TokenBreakdown; at: number } | null = null

  return async function collectCursor(options: CursorOptions = {}): Promise<SourceReading> {
    const now = options.now ?? new Date()
    const dayKey = localDayKey(now)
    const countCacheReads = options.countCacheReads ?? false
    const env = options.env ?? process.env

    if (options.allowNetwork === false) {
      return {
        source: 'cursor',
        status: 'unavailable',
        tokens: 0,
        detail: 'Network lookup turned off in settings'
      }
    }

    try {
      const rawToken = await resolveToken(env, options.dbPaths)
      if (!rawToken) {
        return {
          source: 'cursor',
          status: 'unavailable',
          tokens: 0,
          detail: 'No Cursor session found on this Mac'
        }
      }
      const session = buildCursorSession(rawToken)
      if (!session) {
        return { source: 'cursor', status: 'unavailable', tokens: 0, detail: 'Cursor session token unreadable' }
      }

      const breakdown = await fetchCursorUsage({
        cookie: session.cookie,
        now,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
      })
      cached = { dayKey, breakdown, at: now.getTime() }
      const tokens = countedTokens(breakdown, countCacheReads)
      return { source: 'cursor', status: tokens > 0 ? 'ok' : 'empty', tokens, breakdown }
    } catch (error) {
      // Keep the last good reading for the day so a flaky request does not blank the row.
      if (cached && cached.dayKey === dayKey) {
        return {
          source: 'cursor',
          status: 'ok',
          tokens: countedTokens(cached.breakdown, countCacheReads),
          breakdown: cached.breakdown,
          detail: `Showing last sync — ${describe(error)}`
        }
      }
      return {
        source: 'cursor',
        status: 'unavailable',
        tokens: 0,
        detail: describe(error),
        needsFullDiskAccess: isPermissionError(error)
      }
    }
  }
}

async function resolveToken(env: NodeJS.ProcessEnv, dbPaths?: string[]): Promise<string | null> {
  const override = env.CURSOR_SESSION_TOKEN?.trim()
  if (override) return override
  const dbPath = dbPaths ? await findCursorStateDb(dbPaths) : await findCursorStateDb()
  if (!dbPath) return null
  return readCursorAccessToken(dbPath)
}

function firstArray(root: Record<string, unknown>, keys: string[]): unknown[] | null {
  for (const key of keys) {
    const value = root[key]
    if (Array.isArray(value)) return value
  }
  return null
}

function loose(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }
  return 0
}
