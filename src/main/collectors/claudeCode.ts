import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { isOnLocalDay, localDayKey, startOfLocalDay } from '@shared/date'
import type { SourceReading } from '@shared/types'
import { describe, isPermissionError } from './errors'
import { findRecentFiles, pathExists } from './fsUtils'
import { JsonlScanner, countedTokens, emptyBreakdown, num, type ParsedUsage } from './tokenScan'

/**
 * Claude Code appends one JSON object per message to
 * `<config dir>/projects/<slugified project path>/<session id>.jsonl`.
 * `CLAUDE_CONFIG_DIR` may hold several paths separated by the platform delimiter.
 */
export function claudeCodeRoots(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const override = env.CLAUDE_CONFIG_DIR?.trim()
  if (override) {
    return override
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return [join(home, '.claude'), join(home, '.config', 'claude')]
}

interface ClaudeLine {
  type?: string
  timestamp?: string
  requestId?: string
  isApiErrorMessage?: boolean
  message?: {
    id?: string
    role?: string
    usage?: Record<string, unknown>
  }
}

/** Exported for tests: pulls the token counts out of one assistant line. */
export function parseClaudeCodeLine(raw: unknown, dayKey: string): ParsedUsage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const line = raw as ClaudeLine
  const usage = line.message?.usage
  if (!usage) return null
  if (line.isApiErrorMessage) return null
  if (line.timestamp && !isOnLocalDay(line.timestamp, dayKey)) return null

  const breakdown = {
    input: num(usage.input_tokens),
    output: num(usage.output_tokens),
    cacheCreation: num(usage.cache_creation_input_tokens),
    cacheRead: num(usage.cache_read_input_tokens)
  }
  if (breakdown.input + breakdown.output + breakdown.cacheCreation + breakdown.cacheRead === 0) {
    return null
  }

  const messageId = line.message?.id
  const dedupeKey = messageId ? `${messageId}:${line.requestId ?? ''}` : undefined
  return dedupeKey ? { breakdown, dedupeKey } : { breakdown }
}

export interface ClaudeCodeOptions {
  roots?: string[]
  now?: Date
  countCacheReads?: boolean
}

export function createClaudeCodeCollector() {
  let scanner: JsonlScanner | null = null
  let activeDay = ''

  return async function collectClaudeCode(options: ClaudeCodeOptions = {}): Promise<SourceReading> {
    const now = options.now ?? new Date()
    const dayKey = localDayKey(now)
    const countCacheReads = options.countCacheReads ?? false
    const roots = options.roots ?? claudeCodeRoots()

    if (!scanner || activeDay !== dayKey) {
      activeDay = dayKey
      scanner = new JsonlScanner((raw) => parseClaudeCodeLine(raw, dayKey))
    }

    try {
      const projectDirs: string[] = []
      for (const root of roots) {
        const projects = join(root, 'projects')
        if (await pathExists(projects)) projectDirs.push(projects)
      }
      if (projectDirs.length === 0) {
        return {
          source: 'claude-code',
          status: 'unavailable',
          tokens: 0,
          detail: 'No Claude Code session folder found'
        }
      }

      const modifiedSince = startOfLocalDay(now).getTime()
      const files: string[] = []
      for (const dir of projectDirs) {
        files.push(...(await findRecentFiles(dir, { modifiedSince, extension: '.jsonl' })))
      }

      const breakdown = files.length > 0 ? await scanner.scan(files, dayKey) : emptyBreakdown()
      const tokens = countedTokens(breakdown, countCacheReads)
      return {
        source: 'claude-code',
        status: tokens > 0 ? 'ok' : 'empty',
        tokens,
        breakdown
      }
    } catch (error) {
      return {
        source: 'claude-code',
        status: 'unavailable',
        tokens: 0,
        detail: describe(error),
        needsFullDiskAccess: isPermissionError(error)
      }
    }
  }
}