import { deflateSync } from 'node:zlib'

/**
 * The tray mark is drawn in code rather than shipped as a binary asset: a half-full
 * glass, rendered as a macOS template image so the system tints it for light and dark
 * menu bars. Grayscale + alpha PNG, 8 bit, no dependencies.
 */
export function renderTrayIconPng(size = 32, fillFraction = 0.55): Buffer {
  const pixels = Buffer.alloc(size * size * 2)
  const samples = 3

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let alpha = 0
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples
          const py = y + (sy + 0.5) / samples
          alpha += sampleGlass(px / size, py / size, fillFraction)
        }
      }
      alpha = Math.round(alpha / (samples * samples))
      const at = (y * size + x) * 2
      pixels[at] = 0
      pixels[at + 1] = Math.min(255, alpha)
    }
  }

  return encodeGrayAlphaPng(pixels, size, size)
}

/** Unit-square glass: returns the alpha contribution of one sample point. */
function sampleGlass(u: number, v: number, fillFraction: number): number {
  const top = 0.14
  const bottom = 0.88
  if (v < top || v > bottom) return 0

  const t = (v - top) / (bottom - top)
  const halfWidth = 0.3 - 0.09 * t
  const dx = Math.abs(u - 0.5)
  if (dx > halfWidth) return 0

  const strokeX = 0.055
  const strokeY = 0.05
  const onWall = dx > halfWidth - strokeX
  const onBase = v > bottom - strokeY
  const onRim = v < top + strokeY * 0.8
  if (onWall || onBase || onRim) return 255

  const waterTop = bottom - (bottom - top) * fillFraction
  return v >= waterTop ? 110 : 0
}

function encodeGrayAlphaPng(pixels: Buffer, width: number, height: number): Buffer {
  const bytesPerPixel = 2
  const raw = Buffer.alloc(height * (1 + width * bytesPerPixel))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * bytesPerPixel)
    raw[rowStart] = 0
    pixels.copy(raw, rowStart + 1, y * width * bytesPerPixel, (y + 1) * width * bytesPerPixel)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 4 // grayscale with alpha
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // default filter
  ihdr[12] = 0 // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
