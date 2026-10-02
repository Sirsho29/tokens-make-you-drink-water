import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  CURSOR_USAGE_ENDPOINT,
  createCursorCollector,
  fetchCursorUsage,
  sumCursorUsage
} from '../src/main/collectors/cursor'
import {
  buildCursorSession,
  cursorStateDbPaths,
  decodeJwtSubject,
  extractAccessTokenFromBytes,
  findCursorStateDb,
  readCursorAccessToken
} from '../src/main/collectors/cursorState'
import { tempDir } from './helpers/fixtures'

const SUBJECT = 'auth0|user_01ABCDEF'

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url').replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.c2lnbmF0dXJlLXBsYWNlaG9sZGVy`
}

const JWT = makeJwt({ sub: SUBJECT, time: '1757000000', scope: 'openid profile email' })

describe('cursor state locations', () => {
  it('points at Cursor global storage per platform', () => {
    expect(cursorStateDbPaths('darwin', '/Users/x', {})).toEqual([
      '/Users/x/Library/Application Support/Cursor/User/globalStorage/state.vscdb'
    ])
    expect(cursorStateDbPaths('win32', '/Users/x', { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' })[0]).toContain(
      'Cursor'
    )
    expect(cursorStateDbPaths('linux', '/home/x', {})[0]).toBe(
      '/home/x/.config/Cursor/User/globalStorage/state.vscdb'
    )
  })

  it('returns null when no state database exists', async () => {
    expect(await findCursorStateDb([join(await tempDir(), 'state.vscdb')])).toBeNull()
  })
})

describe('cursor session token', () => {
  it('decodes the subject from the JWT payload', () => {
    expect(decodeJwtSubject(JWT)).toBe(SUBJECT)
    expect(decodeJwtSubject('not-a-jwt')).toBeNull()
    expect(decodeJwtSubject('a.b.c')).toBeNull()
  })

  it('builds the dashboard cookie the way the website does', () => {
    const session = buildCursorSession(JWT)
    expect(session?.subject).toBe(SUBJECT)
    expect(session?.cookie).toBe(`WorkosCursorSessionToken=auth0%7Cuser_01ABCDEF%3A%3A${JWT}`)
  })

  it('accepts a token already pasted in combined form', () => {
    const combined = buildCursorSession(`${SUBJECT}::${JWT}`)
    expect(combined?.jwt).toBe(JWT)
    expect(combined?.subject).toBe(SUBJECT)

    const encoded = buildCursorSession(`${encodeURIComponent(SUBJECT)}%3A%3A${JWT}`)
    expect(encoded?.jwt).toBe(JWT)
    expect(encoded?.subject).toBe(SUBJECT)
  })

  it('rejects an empty token', () => {
    expect(buildCursorSession('   ')).toBeNull()
  })

  it('finds the token next to its key in raw database bytes', async () => {
    // Stand-in for the SQLite page that holds Cursor's ItemTable rows.
    const blob = Buffer.concat([
      Buffer.from('SQLite format 3\u0000'),
      Buffer.from('\u0001\u0002\u0003cursorAuth/cachedEmail'),
      Buffer.from('person@example.com'),
      Buffer.from('cursorAuth/accessToken'),
      Buffer.from(JWT),
      Buffer.from('\u0000cursorAuth/stripeMembershipType')
    ])
    expect(extractAccessTokenFromBytes(blob)).toBe(JWT)
    expect(extractAccessTokenFromBytes(Buffer.from('nothing to see here'))).toBeNull()

    const dbPath = join(await tempDir(), 'state.vscdb')
    await writeFile(dbPath, blob)
    expect(await readCursorAccessToken(dbPath)).toBe(JWT)
  })
})

describe('cursor usage response parsing', () => {
  it('sums per-model aggregations, including string numbers', () => {
    expect(
      sumCursorUsage({
        aggregations: [
          { modelIntent: 'claude-4.5-sonnet', inputTokens: 1200, outputTokens: 800, cacheReadTokens: 50_000 },
          { modelIntent: 'gpt-5', inputTokens: '300', outputTokens: '120', cacheWriteTokens: '900' }
        ]
      })
    ).toEqual({ input: 1500, output: 920, cacheCreation: 900, cacheRead: 50_000 })
  })

  it('falls back to top-level totals and shrugs at anything else', () => {
    expect(sumCursorUsage({ totalInputTokens: 10, totalOutputTokens: 4 })).toEqual({
      input: 10,
      output: 4,
      cacheCreation: 0,
      cacheRead: 0
    })
    expect(sumCursorUsage('nope')).toEqual({ input: 0, output: 0, cacheCreation: 0, cacheRead: 0 })
  })
})

describe('cursor request', () => {
  it('posts to the dashboard endpoint with the session cookie and today\'s window', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ aggregations: [{ inputTokens: 5, outputTokens: 7 }] }), { status: 200 })
    ) as unknown as typeof fetch

    const breakdown = await fetchCursorUsage({ cookie: 'WorkosCursorSessionToken=x', fetchImpl })
    expect(breakdown).toEqual({ input: 5, output: 7, cacheCreation: 0, cacheRead: 0 })

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(CURSOR_USAGE_ENDPOINT)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Cookie).toBe('WorkosCursorSessionToken=x')
    const body = JSON.parse(init.body as string) as { startDate: string; endDate: string }
    expect(Number(body.endDate) - Number(body.startDate)).toBeGreaterThan(0)
    expect(new Date(Number(body.startDate)).getHours()).toBe(0)
  })

  it('throws on a non-200 so the collector can report it', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 })) as unknown as typeof fetch
    await expect(fetchCursorUsage({ cookie: 'c', fetchImpl })).rejects.toThrow('401')
  })
})

describe('cursor collector', () => {
  const env = { CURSOR_SESSION_TOKEN: JWT } as NodeJS.ProcessEnv

  it('reads usage with the session token override', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ aggregations: [{ inputTokens: 4000, outputTokens: 1000, cacheReadTokens: 7 }] }))
    ) as unknown as typeof fetch

    const reading = await createCursorCollector()({ env, fetchImpl })
    expect(reading).toMatchObject({ source: 'cursor', status: 'ok', tokens: 5000 })
  })

  it('never touches the network when the user turns it off', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const reading = await createCursorCollector()({ env, fetchImpl, allowNetwork: false })
    expect(reading).toMatchObject({ status: 'unavailable', tokens: 0 })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports unavailable when there is no session on this machine', async () => {
    const reading = await createCursorCollector()({
      env: {},
      dbPaths: [join(await tempDir(), 'state.vscdb')]
    })
    expect(reading).toMatchObject({ status: 'unavailable', tokens: 0 })
    expect(reading.detail).toContain('No Cursor session')
  })

  it('degrades quietly when the undocumented endpoint misbehaves', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('fetch failed')
    }) as unknown as typeof fetch
    const reading = await createCursorCollector()({ env, fetchImpl })
    expect(reading).toMatchObject({ status: 'unavailable', tokens: 0, detail: 'fetch failed' })
  })

  it('keeps showing the last good reading if a later sync fails', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls === 1) return new Response(JSON.stringify({ aggregations: [{ inputTokens: 900 }] }))
      throw new Error('network down')
    }) as unknown as typeof fetch

    const collect = createCursorCollector()
    expect((await collect({ env, fetchImpl })).tokens).toBe(900)
    const second = await collect({ env, fetchImpl })
    expect(second.status).toBe('ok')
    expect(second.tokens).toBe(900)
    expect(second.detail).toContain('last sync')
  })
})
