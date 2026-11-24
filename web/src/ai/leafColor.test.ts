import { describe, expect, it } from 'vitest'
import { computeColorStats } from './leafColor'

function createSolidRgba(r: number, g: number, b: number, width = 10, height = 10): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  }
  return data
}

describe('leafColor - computeColorStats', () => {
  it('identifies pure green patch with greenRatio > 0.9', () => {
    // Pure green: rgb(34, 139, 34) -> hue ~120, s ~0.75, v ~0.54
    const rgba = createSolidRgba(34, 139, 34, 50, 50)
    const stats = computeColorStats(rgba, 50, 50)
    expect(stats.greenRatio).toBeGreaterThan(0.9)
    expect(stats.brownRatio).toBe(0)
    expect(stats.greyRatio).toBe(0)
    expect(stats.meanSaturation).toBeGreaterThan(0.5)
  })

  it('identifies tan/brown patch with brownRatio > 0.8', () => {
    // Tan/brown patch: rgb(160, 120, 60) -> hue ~36, s ~0.625, v ~0.627
    const rgba = createSolidRgba(160, 120, 60, 50, 50)
    const stats = computeColorStats(rgba, 50, 50)
    expect(stats.brownRatio).toBeGreaterThan(0.8)
    expect(stats.greenRatio).toBe(0)
  })

  it('identifies grey/neutral patch with greyRatio > 0.9', () => {
    // Neutral grey: rgb(128, 128, 128) -> s = 0
    const rgba = createSolidRgba(128, 128, 128, 50, 50)
    const stats = computeColorStats(rgba, 50, 50)
    expect(stats.greyRatio).toBeGreaterThan(0.9)
    expect(stats.greenRatio).toBe(0)
    expect(stats.brownRatio).toBe(0)
  })

  it('respects bounding box crop', () => {
    // 20x10 image: left half green, right half grey
    const width = 20
    const height = 10
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        if (x < 10) {
          data[idx] = 34
          data[idx + 1] = 139
          data[idx + 2] = 34
          data[idx + 3] = 255
        } else {
          data[idx] = 128
          data[idx + 1] = 128
          data[idx + 2] = 128
          data[idx + 3] = 255
        }
      }
    }

    const leftStats = computeColorStats(data, width, height, { x: 0, y: 0, w: 10, h: 10 })
    expect(leftStats.greenRatio).toBeGreaterThan(0.9)

    const rightStats = computeColorStats(data, width, height, { x: 10, y: 0, w: 10, h: 10 })
    expect(rightStats.greyRatio).toBeGreaterThan(0.9)
  })
})
