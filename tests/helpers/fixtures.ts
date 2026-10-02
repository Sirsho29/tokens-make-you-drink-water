import { mkdtemp, mkdir, writeFile, appendFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { localDayKey } from '@shared/date'

export async function tempDir(prefix = 'tmyw-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function daysAgoIso(days: number): string {
  const at = new Date()
  at.setDate(at.getDate() - days)
  return at.toISOString()
}

export async function writeJsonl(filePath: string, lines: unknown[]): Promise<void> {
  await mkdir(join(filePath, '..'), { recursive: true })
  await writeFile(filePath, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8')
}

export async function appendJsonl(filePath: string, lines: unknown[]): Promise<void> {
  await appendFile(filePath, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8')
}

/** `<root>/projects/<slug>/<session>.jsonl`, the layout Claude Code writes. */
export function claudeSessionPath(root: string, project: string, session: string): string {
  return join(root, 'projects', project, `${session}.jsonl`)
}

/** `<home>/sessions/YYYY/MM/DD/rollout-*.jsonl`, the layout Codex writes. */
export function codexRolloutPath(home: string, name: string, at = new Date()): string {
  const [year, month, day] = localDayKey(at).split('-')
  return join(home, 'sessions', year, month, day, `rollout-${name}.jsonl`)
}

export interface ClaudeUsageLineOptions {
  id: string
  requestId?: string
  input?: number
  output?: number
  cacheCreation?: number
  cacheRead?: number
  timestamp?: string
  isApiErrorMessage?: boolean
}

export function claudeUsageLine(options: ClaudeUsageLineOptions): Record<string, unknown> {
  return {
    type: 'assistant',
    timestamp: options.timestamp ?? nowIso(),
    requestId: options.requestId ?? `req_${options.id}`,
    ...(options.isApiErrorMessage ? { isApiErrorMessage: true } : {}),
    message: {
      id: options.id,
      role: 'assistant',
      model: 'claude-sonnet-4-5',
      usage: {
        input_tokens: options.input ?? 0,
        output_tokens: options.output ?? 0,
        cache_creation_input_tokens: options.cacheCreation ?? 0,
        cache_read_input_tokens: options.cacheRead ?? 0
      }
    }
  }
}

export interface CodexTokenLineOptions {
  input: number
  cached?: number
  output: number
  reasoning?: number
  cumulativeInput?: number
  cumulativeOutput?: number
  timestamp?: string
}

export function codexTokenLine(options: CodexTokenLineOptions): Record<string, unknown> {
  return {
    timestamp: options.timestamp ?? nowIso(),
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: {
          input_tokens: options.input,
          cached_input_tokens: options.cached ?? 0,
          output_tokens: options.output,
          reasoning_output_tokens: options.reasoning ?? 0,
          total_tokens: options.input + options.output
        },
        total_token_usage: {
          input_tokens: options.cumulativeInput ?? options.input * 10,
          cached_input_tokens: 0,
          output_tokens: options.cumulativeOutput ?? options.output * 10,
          total_tokens: 999_999
        }
      }
    }
  }
}

/** A transcript line carrying prompt text, to prove the parsers ignore content. */
export function codexMessageLine(text: string): Record<string, unknown> {
  return {
    timestamp: nowIso(),
    type: 'response_item',
    payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] }
  }
}
