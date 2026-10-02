import { utimes } from 'node:fs/promises'
import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { claudeCodeRoots, createClaudeCodeCollector, parseClaudeCodeLine } from '../src/main/collectors/claudeCode'
import { localDayKey } from '@shared/date'
import {
  appendJsonl,
  claudeSessionPath,
  claudeUsageLine,
  daysAgoIso,
  tempDir,
  writeJsonl
} from './helpers/fixtures'

const today = localDayKey()

describe('claude code roots', () => {
  it('defaults to both known config directories', () => {
    expect(claudeCodeRoots({}, '/Users/x')).toEqual(['/Users/x/.claude', '/Users/x/.config/claude'])
  })

  it('honours CLAUDE_CONFIG_DIR, including several paths', () => {
    const env = { CLAUDE_CONFIG_DIR: ['/a', '/b'].join(delimiter) } as NodeJS.ProcessEnv
    expect(claudeCodeRoots(env, '/Users/x')).toEqual(['/a', '/b'])
  })
})

describe('claude code line parsing', () => {
  it('reads only the four token counts', () => {
    const parsed = parseClaudeCodeLine(
      claudeUsageLine({ id: 'msg_1', input: 1200, output: 350, cacheCreation: 5000, cacheRead: 42_000 }),
      today
    )
    expect(parsed?.breakdown).toEqual({ input: 1200, output: 350, cacheCreation: 5000, cacheRead: 42_000 })
    expect(parsed?.dedupeKey).toBe('msg_1:req_msg_1')
  })

  it('ignores lines without usage, error replies and other days', () => {
    expect(parseClaudeCodeLine({ type: 'user', message: { role: 'user' } }, today)).toBeNull()
    expect(parseClaudeCodeLine('nonsense', today)).toBeNull()
    expect(
      parseClaudeCodeLine(claudeUsageLine({ id: 'e', input: 10, isApiErrorMessage: true }), today)
    ).toBeNull()
    expect(
      parseClaudeCodeLine(claudeUsageLine({ id: 'old', input: 10, timestamp: daysAgoIso(3) }), today)
    ).toBeNull()
  })
})

describe('claude code collector', () => {
  it('sums today\'s token counts across projects and sessions', async () => {
    const root = await tempDir()
    await writeJsonl(claudeSessionPath(root, 'project-a', 'session-1'), [
      { type: 'user', timestamp: new Date().toISOString(), message: { role: 'user', content: 'secret prompt' } },
      claudeUsageLine({ id: 'msg_1', input: 1000, output: 500, cacheCreation: 2000, cacheRead: 40_000 }),
      claudeUsageLine({ id: 'msg_2', input: 300, output: 200 })
    ])
    await writeJsonl(claudeSessionPath(root, 'project-b', 'session-2'), [
      claudeUsageLine({ id: 'msg_3', input: 100, output: 50 })
    ])

    const collect = createClaudeCodeCollector()
    const reading = await collect({ roots: [root] })

    expect(reading.status).toBe('ok')
    expect(reading.breakdown).toEqual({ input: 1400, output: 750, cacheCreation: 2000, cacheRead: 40_000 })
    expect(reading.tokens).toBe(4150)
  })

  it('includes cache reads only when asked', async () => {
    const root = await tempDir()
    await writeJsonl(claudeSessionPath(root, 'project-a', 'session-1'), [
      claudeUsageLine({ id: 'msg_1', input: 1000, output: 500, cacheRead: 40_000 })
    ])

    const collect = createClaudeCodeCollector()
    expect((await collect({ roots: [root], countCacheReads: true })).tokens).toBe(41_500)
  })

  it('deduplicates repeated message ids across sessions', async () => {
    const root = await tempDir()
    const duplicate = claudeUsageLine({ id: 'msg_1', input: 1000, output: 500 })
    await writeJsonl(claudeSessionPath(root, 'project-a', 'session-1'), [duplicate])
    // Resumed sessions and sidechains replay the same assistant line verbatim.
    await writeJsonl(claudeSessionPath(root, 'project-a', 'session-2'), [duplicate])

    const reading = await createClaudeCodeCollector()({ roots: [root] })
    expect(reading.tokens).toBe(1500)
  })

  it('only counts appended lines on a second sync', async () => {
    const root = await tempDir()
    const file = claudeSessionPath(root, 'project-a', 'session-1')
    await writeJsonl(file, [claudeUsageLine({ id: 'msg_1', input: 1000, output: 0 })])

    const collect = createClaudeCodeCollector()
    expect((await collect({ roots: [root] })).tokens).toBe(1000)
    expect((await collect({ roots: [root] })).tokens).toBe(1000)

    await appendJsonl(file, [claudeUsageLine({ id: 'msg_2', input: 250, output: 0 })])
    expect((await collect({ roots: [root] })).tokens).toBe(1250)
  })

  it('tolerates a half-written trailing line and picks it up once complete', async () => {
    const root = await tempDir()
    const file = claudeSessionPath(root, 'project-a', 'session-1')
    await writeJsonl(file, [claudeUsageLine({ id: 'msg_1', input: 1000, output: 0 })])
    const { appendFile } = await import('node:fs/promises')
    const partial = JSON.stringify(claudeUsageLine({ id: 'msg_2', input: 500, output: 0 }))
    await appendFile(file, partial.slice(0, 40), 'utf8')

    const collect = createClaudeCodeCollector()
    expect((await collect({ roots: [root] })).tokens).toBe(1000)

    await appendFile(file, `${partial.slice(40)}\n`, 'utf8')
    expect((await collect({ roots: [root] })).tokens).toBe(1500)
  })

  it('skips files that were last touched before today', async () => {
    const root = await tempDir()
    const file = claudeSessionPath(root, 'project-old', 'session-old')
    await writeJsonl(file, [claudeUsageLine({ id: 'msg_old', input: 9999, output: 0 })])
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)
    await utimes(file, twoDaysAgo, twoDaysAgo)

    const reading = await createClaudeCodeCollector()({ roots: [root] })
    expect(reading.status).toBe('empty')
    expect(reading.tokens).toBe(0)
  })

  it('reports empty, not unavailable, when the folder exists but has no usage today', async () => {
    const root = await tempDir()
    await writeJsonl(claudeSessionPath(root, 'project-a', 'session-1'), [
      claudeUsageLine({ id: 'msg_old', input: 400, timestamp: daysAgoIso(2) })
    ])

    const reading = await createClaudeCodeCollector()({ roots: [root] })
    expect(reading.status).toBe('empty')
    expect(reading.tokens).toBe(0)
  })

  it('fails quietly as unavailable when Claude Code is not installed', async () => {
    const root = await tempDir()
    const reading = await createClaudeCodeCollector()({ roots: [join(root, 'nope')] })
    expect(reading).toMatchObject({ source: 'claude-code', status: 'unavailable', tokens: 0 })
    expect(reading.detail).toBeTruthy()
  })
})
