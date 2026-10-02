import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { renderTrayIconPng } from '../src/main/trayIcon'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readChunk(png: Buffer, type: string): Buffer | null {
  let offset = 8
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset)
    const chunkType = png.subarray(offset + 4, offset + 8).toString('ascii')
    if (chunkType === type) return png.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
  }
  return null
}

describe('tray icon', () => {
  it('is a valid 8-bit grayscale+alpha PNG of the requested size', () => {
    const png = renderTrayIconPng(32)
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)

    const ihdr = readChunk(png, 'IHDR')
    expect(ihdr).not.toBeNull()
    expect(ihdr?.readUInt32BE(0)).toBe(32)
    expect(ihdr?.readUInt32BE(4)).toBe(32)
    expect(ihdr?.[8]).toBe(8)
    expect(ihdr?.[9]).toBe(4)
    expect(readChunk(png, 'IEND')).not.toBeNull()
  })

  it('draws a glass: transparent corners, an opaque outline and a translucent water body', () => {
    const size = 32
    const png = renderTrayIconPng(size, 0.5)
    const raw = inflateSync(readChunk(png, 'IDAT') as Buffer)
    expect(raw.length).toBe(size * (1 + size * 2))

    const alphaAt = (x: number, y: number): number => raw[y * (1 + size * 2) + 1 + x * 2 + 1]
    expect(alphaAt(0, 0)).toBe(0)
    expect(alphaAt(size - 1, 0)).toBe(0)
    expect(alphaAt(16, 1)).toBe(0)

    const alphas = new Set<number>()
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) alphas.add(alphaAt(x, y))
    }
    expect(Math.max(...alphas)).toBe(255)
    // Something between fully clear and fully opaque: the water and its antialiasing.
    expect([...alphas].some((alpha) => alpha > 40 && alpha < 200)).toBe(true)
  })

  it('puts more water in the glass as the fill grows', () => {
    const size = 32
    const waterPixels = (fill: number): number => {
      const raw = inflateSync(readChunk(renderTrayIconPng(size, fill), 'IDAT') as Buffer)
      let count = 0
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const alpha = raw[y * (1 + size * 2) + 1 + x * 2 + 1]
          if (alpha > 40 && alpha < 200) count += 1
        }
      }
      return count
    }
    expect(waterPixels(0.8)).toBeGreaterThan(waterPixels(0.2))
  })
})
