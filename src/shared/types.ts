export const SOURCE_IDS = ['claude-code', 'codex', 'cursor', 'manual'] as const

export type SourceId = (typeof SOURCE_IDS)[number]

/**
 * `ok`          — the source was read and reported tokens today
 * `empty`       — the source was read fine, but there is no usage today
 * `disabled`    — the user switched the source off in settings
 * `unavailable` — the source could not be read (not installed, no permission, network)
 */
export type SourceStatus = 'ok' | 'empty' | 'disabled' | 'unavailable'

export interface TokenBreakdown {
  input: number
  output: number
  cacheCreation: number
  cacheRead: number
}

export interface SourceReading {
  source: SourceId
  status: SourceStatus
  /** Tokens counted towards water, after the cache-read preference is applied. */
  tokens: number
  breakdown?: TokenBreakdown
  /** Short, human-readable reason shown in settings when something is off. */
  detail?: string
  /** True when macOS file permissions are the likely cause of `unavailable`. */
  needsFullDiskAccess?: boolean
}

export interface UsageSnapshot {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string
  collectedAt: number
  totalTokens: number
  readings: SourceReading[]
}

export type Units = 'metric' | 'us'

export interface Settings {
  units: Units
  mlPerThousandTokens: number
  glassSizeMl: number
  enabledSources: Record<SourceId, boolean>
  /**
   * Cache reads are real tokens but a fraction of the compute, and they dominate
   * agent logs. Off by default so a day of Claude Code does not read as 900 glasses.
   */
  countCacheReadTokens: boolean
  /** Opt out of the one network call the app makes. */
  allowCursorNetwork: boolean
}

export interface DayState {
  date: string
  glassesDrunk: number
  manualTokens: number
}

export interface WaterMath {
  totalTokens: number
  totalMl: number
  tokensPerGlass: number
  /** Whole glasses the tokens have earned so far today. */
  glassesEarned: number
  /** Earned minus drunk, floored at zero. */
  glassesOwed: number
  /** 0..1 progress towards the next glass. */
  fillFraction: number
  tokensToNextGlass: number
}

export interface WidgetState {
  usage: UsageSnapshot
  day: DayState
  settings: Settings
  water: WaterMath
  /** Sources with usage today, in display order. */
  activeSources: SourceId[]
  platform: string
}
