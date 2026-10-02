import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { codexHome, createCodexCollector, parseCodexLine } from '../src/main/collectors/codex'
import { localDayKey } from '@shared/date'
import {
  appendJsonl,
  codexMessageLine,
  codexRolloutPath,
  codexTokenLine,
  daysAgoIso,
  tempDir,
  writeJsonl
} from './helpers/fixtures'

const today = localDayKey()

describe('codex home', () => {
  it('defaults to ~/.codex and honours CODEX_HOME', () => {
    expect(codexHome({}, '/Users/x')).toBe('/Users/x/.codex')
    expect(codexHome({ CODEX_HOME: '/custom/codex' } as NodeJS.ProcessEnv, '/Users/x')).toBe('/custom/codex')
  })
})

describe('codex line parsing', () => {
  it('splits cached tokens out of the input total', () => {
    const parsed = parseCodexLine(codexTokenLine({ input: 5000, cached: 4200, output: 800 }), today)
    expect(parsed?.breakdown).toEqual({ input: 800, output: 800, cacheCreation: 0, cacheRead: 4200 })
  })

  it('ignores everything that is not a per-turn token_count', () => {
    expect(parseCodexLine(codexMessageLine('my private prompt'), today)).toBeNull()
    expect(parseCodexLine({ type: 'event_msg', payload: { type: 'agent_message' } }, today)).toBeNull()
    expect(
      parseCodexLine({ type: 'event_msg', payload: { type: 'token_count', info: {} } }, today)
    ).toBeNull()
    expect(parseCodexLine(codexTokenLine({ input: 10, output: 1, timestamp: daysAgoIso(2) }), today)).toBeNull()
  })

  it('never reads the cumulative total_token_usage snapshot', () => {
    const parsed = parseCodexLine(
      codexTokenLine({ input: 100, output: 20, cumulativeInput: 500_000, cumulativeOutput: 90_000 }),
      today
    )
    expect(parsed?.breakdown.input).toBe(100)
    expect(parsed?.breakdown.output).toBe(20)
  })
})

describe('codex collector', () => {
  it('sums per-turn usage and ignores the running totals', async () => {
    const home = await tempDir()
    await writeJsonl(codexRolloutPath(home, 'one'), [
      codexMessageLine('do not read this'),
      codexTokenLine({ input: 5000, cached: 4200, output: 800 }),
      codexTokenLine({ input: 9000, cached: 8000, output: 1200 })
    ])

    const reading = await createCodexCollector()({ home })
    expect(reading.status).toBe('ok')
    // (5000-4200) + (9000-8000) inputs, 800 + 1200 outputs, cache reads excluded.
    expect(reading.breakdown).toEqual({ input: 1800, output: 2000, cacheCreation: 0, cacheRead: 12_200 })
    expect(reading.tokens).toBe(3800)
  })

  it('adds cached input when cache reads are counted', async () => {
    const home = await tempDir()
    await writeJsonl(codexRolloutPath(home, 'one'), [codexTokenLine({ input: 5000, cached: 4200, output: 800 })])
    expect((await createCodexCollector()({ home, countCacheReads: true })).tokens).toBe(5800)
  })

  it('picks up new turns appended to a live rollout', async () => {
    const home = await tempDir()
    const file = codexRolloutPath(home, 'live')
    await writeJsonl(file, [codexTokenLine({ input: 1000, output: 100 })])

    const collect = createCodexCollector()
    expect((await collect({ home })).tokens).toBe(1100)
    await appendJsonl(file, [codexTokenLine({ input: 400, output: 50 })])
    expect((await collect({ home })).tokens).toBe(1550)
  })

  it('also reads a session that started before midnight', async () => {
    const home = await tempDir()
    const yesterday = new Date(Date.now() - 86_400_000)
    await writeJsonl(codexRolloutPath(home, 'overnight', yesterday), [
      codexTokenLine({ input: 700, output: 300, timestamp: daysAgoIso(1) }),
      codexTokenLine({ input: 200, output: 100 })
    ])

    const reading = await createCodexCollector()({ home })
    // Only the turn that happened after midnight counts.
    expect(reading.tokens).toBe(300)
  })

  it('reports unavailable when Codex is not installed', async () => {
    const reading = await createCodexCollector()({ home: join(await tempDir(), 'missing') })
    expect(reading).toMatchObject({ source: 'codex', status: 'unavailable', tokens: 0 })
  })

  it('reports empty when installed with no usage today', async () => {
    const home = await tempDir()
    await writeJsonl(codexRolloutPath(home, 'empty'), [codexMessageLine('hello')])
    expect(await createCodexCollector()({ home })).toMatchObject({ status: 'empty', tokens: 0 })
  })
})
