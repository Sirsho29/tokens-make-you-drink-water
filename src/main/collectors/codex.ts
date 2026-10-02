import { homedir } from 'node:os'
import { join } from 'node:path'
import { isOnLocalDay, localDayKey, startOfLocalDay } from '@shared/date'
import type { SourceReading } from '@shared/types'
import { describe, isPermissionError } from './errors'
import { findRecentFiles, pathExists } from './fsUtils'
import { JsonlScanner, countedTokens, emptyBreakdown, num, type ParsedUsage } from './tokenScan'

/** Codex writes rollouts to `<CODEX_HOME>/sessions/YYYY/MM/DD/rollout-*.jsonl`. */
export function codexHome(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const override = env.CODEX_HOME?.trim()
  return override ? override : join(home, '.codex')
}

interface CodexTokenUsage {
  input_tokens?: unknown
  cached_input_tokens?: unknown
  output_tokens?: unknown
  reasoning_output_tokens?: unknown
}

interface CodexLine {
  timestamp?: string
  type?: string
  payload?: {
    type?: string
    info?: {
      last_token_usage?: CodexTokenUsage
      total_token_usage?: CodexTokenUsage
    }
  }
}

/**
 * Only `last_token_usage` is per turn. `total_token_usage` is a running cumulative
 * snapshot repeated on every event, so summing it would multiply the real usage.
 */
export function parseCodexLine(raw: unknown, dayKey: string): ParsedUsage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const line = raw as CodexLine
  if (line.payload?.type !== 'token_count') return null
  const last = line.payload.info?.last_token_usage
  if (!last) return null
  if (line.timestamp && !isOnLocalDay(line.timestamp, dayKey)) return null

  const inputTotal = num(last.input_tokens)
  const cached = Math.min(num(last.cached_input_tokens), inputTotal)
  const breakdown = {
    // Codex reports cached tokens inside `input_tokens`; split them out so the
    // cache-read preference behaves the same across every source.
    input: inputTotal - cached,
    output: num(last.output_tokens),
    cacheCreation: 0,
    cacheRead: cached
  }
  if (breakdown.input + breakdown.output + breakdown.cacheRead === 0) return null
  return { breakdown }
}

export interface CodexOptions {
  home?: string
  now?: Date
  countCacheReads?: boolean
}

export function createCodexCollector() {
  let scanner: JsonlScanner | null = null
  let activeDay = ''

  return async function collectCodex(options: CodexOptions = {}): Promise<SourceReading> {
    const now = options.now ?? new Date()
    const dayKey = localDayKey(now)
    const countCacheReads = options.countCacheReads ?? false
    const sessions = join(options.home ?? codexHome(), 'sessions')

    if (!scanner || activeDay !== dayKey) {
      activeDay = dayKey
      scanner = new JsonlScanner((raw) => parseCodexLine(raw, dayKey))
    }

    try {
      if (!(await pathExists(sessions))) {
        return { source: 'codex', status: 'unavailable', tokens: 0, detail: 'No Codex sessions folder found' }
      }

      // Scan today's and yesterday's date folders: a session started before midnight
      // keeps appending to yesterday's file.
      const modifiedSince = startOfLocalDay(now).getTime()
      const files: string[] = []
      for (const dir of recentSessionDirs(sessions, now)) {
        if (!(await pathExists(dir))) continue
        files.push(...(await findRecentFiles(dir, { modifiedSince, extension: '.jsonl', maxDepth: 2 })))
      }

      const breakdown = files.length > 0 ? await scanner.scan(files, dayKey) : emptyBreakdown()
      const tokens = countedTokens(breakdown, countCacheReads)
      return { source: 'codex', status: tokens > 0 ? 'ok' : 'empty', tokens, breakdown }
    } catch (error) {
      return {
        source: 'codex',
        status: 'unavailable',
        tokens: 0,
        detail: describe(error),
        needsFullDiskAccess: isPermissionError(error)
      }
    }
  }
}

function recentSessionDirs(sessionsRoot: string, now: Date): string[] {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return [dateDir(sessionsRoot, now), dateDir(sessionsRoot, yesterday)]
}

function dateDir(root: string, at: Date): string {
  const [year, month, day] = localDayKey(at).split('-')
  return join(root, year, month, day)
}
