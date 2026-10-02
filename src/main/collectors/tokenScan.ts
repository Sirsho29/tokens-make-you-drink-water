import { open, stat } from 'node:fs/promises'
import type { TokenBreakdown } from '@shared/types'

export function emptyBreakdown(): TokenBreakdown {
  return { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 }
}

export function addBreakdown(into: TokenBreakdown, extra: TokenBreakdown): TokenBreakdown {
  into.input += extra.input
  into.output += extra.output
  into.cacheCreation += extra.cacheCreation
  into.cacheRead += extra.cacheRead
  return into
}

export function countedTokens(breakdown: TokenBreakdown, countCacheReads: boolean): number {
  const base = breakdown.input + breakdown.output + breakdown.cacheCreation
  return Math.round(countCacheReads ? base + breakdown.cacheRead : base)
}

export function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** What a parser extracts from one JSONL line. `null` means "not a usage line". */
export interface ParsedUsage {
  breakdown: TokenBreakdown
  /** Stable identity so resumed sessions and sidechains do not double count. */
  dedupeKey?: string
}

export type LineParser = (line: unknown, context: { file: string; lineNumber: number }) => ParsedUsage | null

interface FileCursor {
  offset: number
  breakdown: TokenBreakdown
}

/**
 * Incremental JSONL reader. Files are only ever read forward from the last byte we
 * consumed, so repeat syncs over an append-only session log are cheap. State is keyed
 * by local day: a new day starts from zero and re-reads today's files from the top.
 */
export class JsonlScanner {
  private dayKey = ''
  private files = new Map<string, FileCursor>()
  private seen = new Set<string>()

  constructor(private readonly parse: LineParser) {}

  /** Drop all cached state when the local day rolls over. */
  private resetIfNewDay(dayKey: string): void {
    if (this.dayKey === dayKey) return
    this.dayKey = dayKey
    this.files.clear()
    this.seen.clear()
  }

  async scan(filePaths: string[], dayKey: string): Promise<TokenBreakdown> {
    this.resetIfNewDay(dayKey)

    for (const filePath of filePaths) {
      try {
        await this.scanFile(filePath)
      } catch {
        // A single unreadable or mid-write file never fails the whole source.
      }
    }

    const total = emptyBreakdown()
    for (const cursor of this.files.values()) addBreakdown(total, cursor.breakdown)
    return total
  }

  private async scanFile(filePath: string): Promise<void> {
    const info = await stat(filePath)
    let cursor = this.files.get(filePath)
    if (!cursor || info.size < cursor.offset) {
      cursor = { offset: 0, breakdown: emptyBreakdown() }
      this.files.set(filePath, cursor)
    }
    if (info.size === cursor.offset) return

    const handle = await open(filePath, 'r')
    try {
      const length = info.size - cursor.offset
      const buffer = Buffer.allocUnsafe(length)
      const { bytesRead } = await handle.read(buffer, 0, length, cursor.offset)
      const chunk = buffer.subarray(0, bytesRead)

      // Stop at the last newline: a trailing partial line is read again next sync.
      const lastNewline = chunk.lastIndexOf(0x0a)
      if (lastNewline === -1) return
      const complete = chunk.subarray(0, lastNewline).toString('utf8')
      const startLine = cursor.offset

      let lineNumber = 0
      for (const rawLine of complete.split('\n')) {
        lineNumber += 1
        const line = rawLine.trim()
        if (!line) continue
        let json: unknown
        try {
          json = JSON.parse(line)
        } catch {
          continue
        }
        const parsed = this.parse(json, { file: filePath, lineNumber })
        if (!parsed) continue
        const key = parsed.dedupeKey ?? `${filePath}:${startLine}:${lineNumber}`
        if (this.seen.has(key)) continue
        this.seen.add(key)
        addBreakdown(cursor.breakdown, parsed.breakdown)
      }

      cursor.offset += lastNewline + 1
    } finally {
      await handle.close()
    }
  }
}
