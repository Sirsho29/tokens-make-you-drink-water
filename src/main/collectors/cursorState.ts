import { copyFile, readFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathExists } from './fsUtils'

const ACCESS_TOKEN_KEY = 'cursorAuth/accessToken'
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/

/** Where Cursor keeps its VS Code-style global storage per platform. */
export function cursorStateDbPaths(
  platform: NodeJS.Platform = process.platform,
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const suffix = join('Cursor', 'User', 'globalStorage', 'state.vscdb')
  if (platform === 'darwin') return [join(home, 'Library', 'Application Support', suffix)]
  if (platform === 'win32') {
    const appData = env.APPDATA ?? join(home, 'AppData', 'Roaming')
    return [join(appData, suffix)]
  }
  return [join(env.XDG_CONFIG_HOME ?? join(home, '.config'), suffix)]
}

export async function findCursorStateDb(paths: string[] = cursorStateDbPaths()): Promise<string | null> {
  for (const candidate of paths) {
    if (await pathExists(candidate)) return candidate
  }
  return null
}

/**
 * Cursor holds `state.vscdb` open, so copy it to a temp file and read the copy.
 * If `node:sqlite` is unavailable we fall back to scanning the raw file for the
 * JWT that follows the auth key — the on-disk format keeps them adjacent.
 */
export async function readCursorAccessToken(dbPath: string): Promise<string | null> {
  const copyPath = join(tmpdir(), `tmyw-state-${process.pid}-${Date.now()}.vscdb`)
  try {
    await copyFile(dbPath, copyPath)
    const viaSqlite = await readTokenWithSqlite(copyPath)
    if (viaSqlite) return viaSqlite
    return extractAccessTokenFromBytes(await readFile(copyPath))
  } finally {
    await rm(copyPath, { force: true }).catch(() => undefined)
  }
}

async function readTokenWithSqlite(dbPath: string): Promise<string | null> {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const row = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get(ACCESS_TOKEN_KEY) as
        | { value?: unknown }
        | undefined
      const value = row?.value
      if (typeof value === 'string') return normalizeToken(value)
      if (value instanceof Uint8Array) return normalizeToken(Buffer.from(value).toString('utf8'))
      return null
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}

/** Exported for tests: pull the JWT that sits next to the auth key in the raw page data. */
export function extractAccessTokenFromBytes(bytes: Buffer): string | null {
  const text = bytes.toString('latin1')
  const keyAt = text.indexOf(ACCESS_TOKEN_KEY)
  const searchFrom = keyAt === -1 ? 0 : keyAt + ACCESS_TOKEN_KEY.length
  const match = JWT_PATTERN.exec(text.slice(searchFrom))
  return match ? normalizeToken(match[0]) : null
}

function normalizeToken(value: string): string | null {
  const trimmed = value.trim().replace(/^"|"$/g, '')
  return trimmed.length > 0 ? trimmed : null
}

export interface CursorSession {
  jwt: string
  subject: string | null
  cookie: string
}

/** The `sub` claim, used as the first half of the dashboard session cookie. */
export function decodeJwtSubject(jwt: string): string | null {
  const parts = jwt.split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub?: unknown }
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null
  } catch {
    return null
  }
}

/**
 * The dashboard sends `WorkosCursorSessionToken=<sub>%3A%3A<jwt>`. A token pasted into
 * `CURSOR_SESSION_TOKEN` may already be in that combined form, so accept both.
 */
export function buildCursorSession(rawToken: string): CursorSession | null {
  const token = rawToken.trim()
  if (!token) return null

  const combined = token.includes('%3A%3A') ? decodeURIComponent(token) : token
  const separatorAt = combined.indexOf('::')
  if (separatorAt > 0) {
    const subject = combined.slice(0, separatorAt)
    const jwt = combined.slice(separatorAt + 2)
    if (!jwt) return null
    return { jwt, subject, cookie: sessionCookie(subject, jwt) }
  }

  const subject = decodeJwtSubject(token)
  return { jwt: token, subject, cookie: sessionCookie(subject, token) }
}

function sessionCookie(subject: string | null, jwt: string): string {
  const value = subject ? `${encodeURIComponent(subject)}%3A%3A${jwt}` : jwt
  return `WorkosCursorSessionToken=${value}`
}
