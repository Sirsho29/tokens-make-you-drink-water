import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { Settings } from '@shared/types'
import { createCollectorSet, emptySnapshot } from '../src/main/collectors'
import { claudeSessionPath, claudeUsageLine, codexRolloutPath, codexTokenLine, tempDir, writeJsonl } from './helpers/fixtures'

const originalEnv = { ...process.env }

function settings(patch: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, allowCursorNetwork: false, ...patch }
}

beforeEach(async () => {
  // Point every file-based collector at a throwaway home for the duration of a test.
  process.env.CLAUDE_CONFIG_DIR = await tempDir('tmyw-claude-')
  process.env.CODEX_HOME = await tempDir('tmyw-codex-')
  delete process.env.CURSOR_SESSION_TOKEN
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
})

describe('collector set', () => {
  it('always returns a row per source, in display order', async () => {
    const snapshot = await createCollectorSet()({ settings: settings(), manualTokens: 0 })
    expect(snapshot.readings.map((row) => row.source)).toEqual(['claude-code', 'codex', 'cursor', 'manual'])
  })

  it('adds up the sources that reported usage', async () => {
    const claudeRoot = process.env.CLAUDE_CONFIG_DIR as string
    const codexRoot = process.env.CODEX_HOME as string
    await writeJsonl(claudeSessionPath(claudeRoot, 'proj', 'session'), [
      claudeUsageLine({ id: 'msg_1', input: 2000, output: 500 })
    ])
    await writeJsonl(codexRolloutPath(codexRoot, 'one'), [codexTokenLine({ input: 900, cached: 400, output: 100 })])

    const snapshot = await createCollectorSet()({ settings: settings(), manualTokens: 10_000 })
    expect(snapshot.totalTokens).toBe(2500 + 600 + 10_000)
    expect(snapshot.readings.find((row) => row.source === 'manual')).toMatchObject({ status: 'ok', tokens: 10_000 })
  })

  it('marks sources the user switched off as disabled and leaves them out of the total', async () => {
    const claudeRoot = process.env.CLAUDE_CONFIG_DIR as string
    await writeJsonl(claudeSessionPath(claudeRoot, 'proj', 'session'), [
      claudeUsageLine({ id: 'msg_1', input: 2000, output: 500 })
    ])

    const snapshot = await createCollectorSet()({
      settings: settings({ enabledSources: { ...DEFAULT_SETTINGS.enabledSources, 'claude-code': false } }),
      manualTokens: 40
    })
    expect(snapshot.readings.find((row) => row.source === 'claude-code')).toMatchObject({
      status: 'disabled',
      tokens: 0
    })
    expect(snapshot.totalTokens).toBe(40)
  })

  it('throttles the Cursor request instead of calling it on every sync', async () => {
    process.env.CURSOR_SESSION_TOKEN = 'plain-session-token'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ aggregations: [{ inputTokens: 1234 }] })))
    vi.stubGlobal('fetch', fetchMock)

    const collectAll = createCollectorSet()
    const input = { settings: settings({ allowCursorNetwork: true }), manualTokens: 0 }
    const first = await collectAll(input)
    const second = await collectAll(input)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first.readings.find((row) => row.source === 'cursor')).toMatchObject({ status: 'ok', tokens: 1234 })
    expect(second.readings.find((row) => row.source === 'cursor')).toMatchObject({ status: 'ok', tokens: 1234 })

    await collectAll({ ...input, forceCursor: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('survives every source being unavailable', async () => {
    process.env.CLAUDE_CONFIG_DIR = '/definitely/not/here'
    process.env.CODEX_HOME = '/definitely/not/here'
    const snapshot = await createCollectorSet()({ settings: settings(), manualTokens: 0 })
    expect(snapshot.totalTokens).toBe(0)
    expect(snapshot.readings.filter((row) => row.status === 'unavailable').length).toBe(3)
  })
})

describe('empty snapshot', () => {
  it('has a row per source and no tokens', () => {
    const snapshot = emptySnapshot()
    expect(snapshot.totalTokens).toBe(0)
    expect(snapshot.readings).toHaveLength(4)
  })
})
