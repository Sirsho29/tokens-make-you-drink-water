import { readdir, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join } from 'node:path'

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

interface FindOptions {
  /** Only return files whose mtime is at or after this instant. */
  modifiedSince: number
  extension: string
  maxDepth?: number
  maxFiles?: number
}

/**
 * Recursively collect files touched since `modifiedSince`. Unreadable directories are
 * skipped silently — on macOS a sandboxed subfolder should never break a sync.
 */
export async function findRecentFiles(root: string, options: FindOptions): Promise<string[]> {
  const { modifiedSince, extension, maxDepth = 6, maxFiles = 2000 } = options
  const found: string[] = []

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth || found.length >= maxFiles) return
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (found.length >= maxFiles) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full, depth + 1)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith(extension)) continue
      try {
        const info = await stat(full)
        if (info.mtimeMs >= modifiedSince) found.push(full)
      } catch {
        // Vanished between readdir and stat.
      }
    }
  }

  await walk(root, 0)
  return found.sort()
}
