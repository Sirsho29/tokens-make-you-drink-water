/** Local calendar day as `YYYY-MM-DD`. Everything in the app rolls over at local midnight. */
export function localDayKey(at: Date = new Date()): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function startOfLocalDay(at: Date = new Date()): Date {
  const start = new Date(at)
  start.setHours(0, 0, 0, 0)
  return start
}

export function msUntilNextLocalMidnight(at: Date = new Date()): number {
  const next = startOfLocalDay(at)
  next.setDate(next.getDate() + 1)
  return next.getTime() - at.getTime()
}

/** True when an ISO timestamp from a log line belongs to the given local day. */
export function isOnLocalDay(isoTimestamp: string | undefined, dayKey: string): boolean {
  if (!isoTimestamp) return false
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) return false
  return localDayKey(parsed) === dayKey
}
