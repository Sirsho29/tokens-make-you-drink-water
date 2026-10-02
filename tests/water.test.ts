import { describe, expect, it } from 'vitest'
import { DEFAULT_GLASS_ML, DEFAULT_ML_PER_1K_TOKENS } from '@shared/constants'
import { formatCompactTokens, formatGlassSize, formatTokens, formatVolume } from '@shared/format'
import { isOnLocalDay, localDayKey, msUntilNextLocalMidnight } from '@shared/date'
import { computeWater, tokensPerGlass, tokensToMl } from '@shared/water'

const settings = { mlPerThousandTokens: DEFAULT_ML_PER_1K_TOKENS, glassSizeMl: DEFAULT_GLASS_ML }

describe('water maths', () => {
  it('turns tokens into millilitres at the configured rate', () => {
    expect(tokensToMl(1000, 3.6)).toBeCloseTo(3.6, 6)
    expect(tokensToMl(1_000_000, 3.6)).toBeCloseTo(3600, 6)
    expect(tokensToMl(-5, 3.6)).toBe(0)
  })

  it('needs about 69,000 tokens for a 250 mL glass', () => {
    expect(Math.round(tokensPerGlass(settings))).toBe(69_444)
  })

  it('counts whole glasses earned and the partial fill towards the next one', () => {
    const perGlass = tokensPerGlass(settings)
    const water = computeWater(perGlass * 2.5, 0, settings)
    expect(water.glassesEarned).toBe(2)
    expect(water.glassesOwed).toBe(2)
    expect(water.fillFraction).toBeCloseTo(0.5, 3)
    expect(Math.abs(water.tokensToNextGlass - perGlass / 2)).toBeLessThanOrEqual(1)
  })

  it('subtracts glasses already drunk and floors at zero', () => {
    const perGlass = tokensPerGlass(settings)
    expect(computeWater(perGlass * 3, 1, settings).glassesOwed).toBe(2)
    expect(computeWater(perGlass * 3, 3, settings).glassesOwed).toBe(0)
    expect(computeWater(perGlass * 3, 9, settings).glassesOwed).toBe(0)
  })

  it('leaves the partial fill alone when a glass is drunk', () => {
    const perGlass = tokensPerGlass(settings)
    const before = computeWater(perGlass * 1.4, 0, settings)
    const after = computeWater(perGlass * 1.4, 1, settings)
    expect(after.glassesOwed).toBe(before.glassesOwed - 1)
    expect(after.fillFraction).toBeCloseTo(before.fillFraction, 6)
  })

  it('falls back to the defaults for nonsense settings', () => {
    const water = computeWater(100_000, 0, { mlPerThousandTokens: 0, glassSizeMl: -4 })
    expect(water.totalMl).toBeCloseTo(tokensToMl(100_000, DEFAULT_ML_PER_1K_TOKENS), 6)
    expect(water.tokensPerGlass).toBeCloseTo(tokensPerGlass(settings), 6)
  })

  it('handles no usage at all', () => {
    const water = computeWater(0, 0, settings)
    expect(water).toMatchObject({ totalMl: 0, glassesEarned: 0, glassesOwed: 0, fillFraction: 0 })
  })

  it('reaches a full glass at exactly the glass threshold', () => {
    const perGlass = tokensPerGlass(settings)
    expect(computeWater(perGlass - 1, 0, settings).glassesEarned).toBe(0)
    expect(computeWater(perGlass, 0, settings).glassesEarned).toBe(1)
    expect(computeWater(perGlass, 0, settings).fillFraction).toBeCloseTo(0, 6)
  })
})

describe('unit formatting', () => {
  it('stays in millilitres until a litre, then switches', () => {
    expect(formatVolume(3.6, 'metric')).toBe('3.6 mL')
    expect(formatVolume(340, 'metric')).toBe('340 mL')
    expect(formatVolume(999, 'metric')).toBe('999 mL')
    expect(formatVolume(1240, 'metric')).toBe('1.24 L')
    expect(formatVolume(0, 'metric')).toBe('0 mL')
  })

  it('renders US fluid ounces when asked', () => {
    expect(formatVolume(250, 'us')).toBe('8.5 fl oz')
    expect(formatVolume(1240, 'us')).toBe('42 fl oz')
    expect(formatVolume(0, 'us')).toBe('0 fl oz')
  })

  it('switches the glass size readout with the units', () => {
    expect(formatGlassSize(250, 'metric')).toBe('250 mL')
    expect(formatGlassSize(250, 'us')).toBe('8.5 fl oz')
  })

  it('groups token counts and compacts large ones', () => {
    expect(formatTokens(95_400)).toBe('95,400')
    expect(formatTokens(-1)).toBe('0')
    expect(formatCompactTokens(940)).toBe('940')
    expect(formatCompactTokens(9400)).toBe('9.4k')
    expect(formatCompactTokens(95_400)).toBe('95k')
    expect(formatCompactTokens(2_400_000)).toBe('2.4M')
  })
})

describe('local day handling', () => {
  it('keys days by local calendar date', () => {
    expect(localDayKey(new Date(2026, 1, 3, 23, 59))).toBe('2026-02-03')
    expect(localDayKey(new Date(2026, 1, 4, 0, 1))).toBe('2026-02-04')
  })

  it('matches log timestamps against a day key', () => {
    const at = new Date(2026, 1, 3, 12, 0)
    expect(isOnLocalDay(at.toISOString(), '2026-02-03')).toBe(true)
    expect(isOnLocalDay(at.toISOString(), '2026-02-04')).toBe(false)
    expect(isOnLocalDay(undefined, '2026-02-03')).toBe(false)
    expect(isOnLocalDay('not a date', '2026-02-03')).toBe(false)
  })

  it('counts down to the next local midnight', () => {
    const at = new Date(2026, 1, 3, 23, 30, 0)
    expect(msUntilNextLocalMidnight(at)).toBe(30 * 60 * 1000)
  })
})
