import {
  DEFAULT_GLASS_ML,
  DEFAULT_ML_PER_1K_TOKENS,
  ML_PER_US_FL_OZ,
  SOURCE_LABELS,
  SOURCE_ORDER
} from '@shared/constants'
import { formatCompactTokens, formatGlassSize } from '@shared/format'
import type { Settings, SourceId, SourceReading, WidgetState } from '@shared/types'
import { isElectron } from '../lib/bridge'
import { NumberField } from './NumberField'
import { Toggle } from './Toggle'
import { SOURCE_MARKS } from './logos'

interface SettingsPanelProps {
  state: WidgetState
  onClose: () => void
  onUpdateSettings: (patch: Partial<Settings>) => void
  onSetManualTokens: (tokens: number) => void
  onRefresh: () => void
  onUndoDrink: () => void
}

export function SettingsPanel({
  state,
  onClose,
  onUpdateSettings,
  onSetManualTokens,
  onRefresh,
  onUndoDrink
}: SettingsPanelProps): React.JSX.Element {
  const { settings, usage, water, day } = state
  const us = settings.units === 'us'
  const needsDiskAccess = usage.readings.some((reading) => reading.needsFullDiskAccess)

  return (
    <div className="no-drag flex h-full flex-col">
      <header className="drag-region flex items-center justify-between px-3.5 pb-2 pt-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-well hover:text-ink"
        >
          Done
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3.5 pb-3">
        <Section title="Units">
          <div className="flex gap-1">
            <Segment active={!us} onClick={() => onUpdateSettings({ units: 'metric' })}>
              Litres
            </Segment>
            <Segment active={us} onClick={() => onUpdateSettings({ units: 'us' })}>
              US fl oz
            </Segment>
          </div>
        </Section>

        <Section title="Water per 1,000 tokens">
          <NumberField
            label="Millilitres of water per 1,000 tokens"
            value={round(settings.mlPerThousandTokens, 3)}
            step={0.1}
            min={0.001}
            suffix="mL"
            onCommit={(value) => onUpdateSettings({ mlPerThousandTokens: value })}
          />
        </Section>
        <Hint>
          Default {DEFAULT_ML_PER_1K_TOKENS} mL. Published estimates differ by roughly 100×; see the README.
        </Hint>

        <Section title="Glass size">
          <NumberField
            label="Glass size"
            value={us ? round(settings.glassSizeMl / ML_PER_US_FL_OZ, 1) : round(settings.glassSizeMl, 0)}
            step={us ? 0.5 : 10}
            min={us ? 0.5 : 10}
            suffix={us ? 'fl oz' : 'mL'}
            onCommit={(value) =>
              onUpdateSettings({ glassSizeMl: us ? value * ML_PER_US_FL_OZ : value })
            }
          />
        </Section>
        <Hint>
          {formatGlassSize(settings.glassSizeMl, settings.units)} per glass ·{' '}
          {formatCompactTokens(water.tokensPerGlass)} tokens fills one. Default {DEFAULT_GLASS_ML} mL.
        </Hint>

        <Divider />

        <h3 className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Sources
        </h3>
        <ul className="space-y-1.5">
          {SOURCE_ORDER.map((source) => (
            <SourceRow
              key={source}
              source={source}
              reading={usage.readings.find((row) => row.source === source)}
              enabled={settings.enabledSources[source]}
              onToggle={(enabled) =>
                onUpdateSettings({ enabledSources: { ...settings.enabledSources, [source]: enabled } })
              }
            />
          ))}
        </ul>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-muted">Tokens entered by hand</span>
          <NumberField
            label="Manual tokens for today"
            value={day.manualTokens}
            step={1000}
            min={0}
            suffix="today"
            onCommit={onSetManualTokens}
          />
        </div>
        <Hint>For anything local logs cannot see — claude.ai, ChatGPT, a phone. Resets at midnight.</Hint>

        <Divider />

        <Row label="Count cache reads" hint="Cheap re-reads of cached context. Off keeps numbers sane.">
          <Toggle
            label="Count cache read tokens"
            checked={settings.countCacheReadTokens}
            onChange={(checked) => onUpdateSettings({ countCacheReadTokens: checked })}
          />
        </Row>

        <Row label="Let Cursor sync" hint="The only network call this app makes, with your own session.">
          <Toggle
            label="Allow the Cursor usage request"
            checked={settings.allowCursorNetwork}
            onChange={(checked) => onUpdateSettings({ allowCursorNetwork: checked })}
          />
        </Row>

        {needsDiskAccess ? (
          <Hint>
            macOS blocked a read. Give this app Full Disk Access in System Settings → Privacy &amp; Security,
            or set CURSOR_SESSION_TOKEN.
          </Hint>
        ) : null}

        <Divider />

        <div className="flex flex-wrap items-center gap-1.5">
          <TextButton onClick={onRefresh}>Refresh now</TextButton>
          {day.glassesDrunk > 0 ? <TextButton onClick={onUndoDrink}>Undo a glass</TextButton> : null}
          {isElectron ? (
            <>
              <TextButton onClick={() => void window.tokenWater?.hideWidget()}>Hide</TextButton>
              <TextButton onClick={() => void window.tokenWater?.quit()}>Quit</TextButton>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SourceRow({
  source,
  reading,
  enabled,
  onToggle
}: {
  source: SourceId
  reading: SourceReading | undefined
  enabled: boolean
  onToggle: (enabled: boolean) => void
}): React.JSX.Element {
  const Mark = SOURCE_MARKS[source]
  return (
    <li className="flex items-center gap-2">
      <Mark size={13} className="shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] text-ink">{SOURCE_LABELS[source]}</span>
        <span className="block truncate text-[10px] text-ink-faint" title={reading?.detail}>
          {statusText(reading, enabled)}
        </span>
      </span>
      <Toggle label={`Use ${SOURCE_LABELS[source]}`} checked={enabled} onChange={onToggle} />
    </li>
  )
}

function statusText(reading: SourceReading | undefined, enabled: boolean): string {
  if (!enabled) return 'off'
  if (!reading) return 'waiting'
  if (reading.status === 'ok') return `${formatCompactTokens(reading.tokens)} tokens today`
  if (reading.status === 'empty') return 'nothing today'
  if (reading.status === 'disabled') return 'off'
  return reading.detail ? `unavailable — ${reading.detail}` : 'unavailable'
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[11px] text-ink-muted">{title}</span>
      {children}
    </div>
  )
}

function Row({
  label,
  hint,
  children
}: {
  label: string
  hint: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink">{label}</span>
        {children}
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-ink-faint">{hint}</p>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="pb-1 text-[10px] leading-snug text-ink-faint">{children}</p>
}

function Divider(): React.JSX.Element {
  return <div className="my-2.5 h-px bg-hairline" />
}

function Segment({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[7px] border px-2 py-[3px] text-[10.5px] transition-colors ${
        active ? 'border-ink/40 bg-ink/10 text-ink' : 'border-hairline bg-transparent text-ink-muted hover:bg-well'
      }`}
    >
      {children}
    </button>
  )
}

function TextButton({
  onClick,
  children
}: {
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[7px] border border-hairline px-2 py-[3px] text-[10.5px] text-ink-muted hover:bg-well hover:text-ink"
    >
      {children}
    </button>
  )
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
