import type { Settings, SourceId } from './types'

/**
 * Mid-range published estimate of the water footprint of a GPT-4o-class model,
 * counting datacenter cooling plus the water used to generate the electricity.
 * Public figures span roughly two orders of magnitude; see the README.
 */
export const DEFAULT_ML_PER_1K_TOKENS = 3.6

/** A glass of water, ~8.5 US fl oz. */
export const DEFAULT_GLASS_ML = 250

export const ML_PER_US_FL_OZ = 29.5735

export const SOURCE_ORDER: SourceId[] = ['claude-code', 'codex', 'cursor', 'manual']

export const SOURCE_LABELS: Record<SourceId, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  manual: 'Manual entry'
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  mlPerThousandTokens: DEFAULT_ML_PER_1K_TOKENS,
  glassSizeMl: DEFAULT_GLASS_ML,
  enabledSources: {
    'claude-code': true,
    codex: true,
    cursor: true,
    manual: true
  },
  countCacheReadTokens: false,
  allowCursorNetwork: true
}

/** How often the main process re-reads the local logs. */
export const SYNC_INTERVAL_MS = 60_000

/** Cursor's dashboard endpoint is slower and rate limited; poll it gently. */
export const CURSOR_SYNC_INTERVAL_MS = 5 * 60_000

export const WIDGET_WIDTH = 248
export const WIDGET_HEIGHT = 372
export const SETTINGS_HEIGHT = 520
