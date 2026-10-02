import { DEFAULT_GLASS_ML, DEFAULT_ML_PER_1K_TOKENS } from './constants'
import type { Settings, WaterMath } from './types'

const MIN_ML_PER_1K = 0.001
const MIN_GLASS_ML = 10

export function sanitizeRate(mlPerThousandTokens: number): number {
  if (!Number.isFinite(mlPerThousandTokens) || mlPerThousandTokens <= 0) {
    return DEFAULT_ML_PER_1K_TOKENS
  }
  return Math.max(MIN_ML_PER_1K, mlPerThousandTokens)
}

export function sanitizeGlassSize(glassSizeMl: number): number {
  if (!Number.isFinite(glassSizeMl) || glassSizeMl <= 0) return DEFAULT_GLASS_ML
  return Math.max(MIN_GLASS_ML, glassSizeMl)
}

export function tokensToMl(tokens: number, mlPerThousandTokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0
  return (tokens / 1000) * sanitizeRate(mlPerThousandTokens)
}

export function tokensPerGlass(settings: Pick<Settings, 'mlPerThousandTokens' | 'glassSizeMl'>): number {
  const rate = sanitizeRate(settings.mlPerThousandTokens)
  return (sanitizeGlassSize(settings.glassSizeMl) / rate) * 1000
}

/**
 * Tokens accumulate, the glass fills. Each full glass bumps `glassesEarned` and the
 * glass starts again from empty. Drinking a glass only ever reduces what you owe —
 * the partial fill keeps accruing, since those tokens have already been spent.
 */
export function computeWater(
  totalTokens: number,
  glassesDrunk: number,
  settings: Pick<Settings, 'mlPerThousandTokens' | 'glassSizeMl'>
): WaterMath {
  const tokens = Number.isFinite(totalTokens) && totalTokens > 0 ? totalTokens : 0
  const glassMl = sanitizeGlassSize(settings.glassSizeMl)
  const totalMl = tokensToMl(tokens, settings.mlPerThousandTokens)
  const perGlass = tokensPerGlass(settings)

  const glassesEarned = Math.floor(totalMl / glassMl)
  const drunk = Number.isFinite(glassesDrunk) && glassesDrunk > 0 ? Math.floor(glassesDrunk) : 0
  const remainderMl = totalMl - glassesEarned * glassMl
  const fillFraction = clamp01(remainderMl / glassMl)

  return {
    totalTokens: tokens,
    totalMl,
    tokensPerGlass: perGlass,
    glassesEarned,
    glassesOwed: Math.max(0, glassesEarned - drunk),
    fillFraction,
    tokensToNextGlass: Math.max(0, Math.ceil(((glassMl - remainderMl) / glassMl) * perGlass))
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
