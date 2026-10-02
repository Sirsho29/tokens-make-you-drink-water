import { ML_PER_US_FL_OZ } from './constants'
import type { Units } from './types'

/**
 * Volumes are stored in mL and formatted at the edge. Metric stays in mL until it
 * crosses a litre, so the widget never shows `0.004 L`. US always reads in fl oz.
 */
export function formatVolume(ml: number, units: Units): string {
  const value = Number.isFinite(ml) && ml > 0 ? ml : 0
  if (units === 'us') {
    const flOz = value / ML_PER_US_FL_OZ
    if (value === 0) return '0 fl oz'
    if (flOz < 10) return `${round(flOz, 1)} fl oz`
    return `${round(flOz, 0)} fl oz`
  }
  if (value < 1000) return `${round(value, value > 0 && value < 10 ? 1 : 0)} mL`
  return `${round(value / 1000, 2)} L`
}

/** Compact readout for a fixed quantity such as the glass size. */
export function formatGlassSize(ml: number, units: Units): string {
  if (units === 'us') return `${round(ml / ML_PER_US_FL_OZ, 1)} fl oz`
  return `${round(ml, 0)} mL`
}

export function formatTokens(tokens: number): string {
  const value = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0
  return value.toLocaleString('en-US')
}

export function formatCompactTokens(tokens: number): string {
  const value = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${round(value / 1000, value < 10_000 ? 1 : 0)}k`
  return `${round(value / 1_000_000, 1)}M`
}

function round(value: number, decimals: number): string {
  const factor = 10 ** decimals
  const rounded = Math.round(value * factor) / factor
  return decimals === 0 ? rounded.toLocaleString('en-US') : rounded.toFixed(decimals)
}
