import { describe, expect, it } from 'vitest'
import { proposeLeafRegions, gridTiles } from './leafRegions'

function drawRect(
  data: Uint8ClampedArray,
  imgW: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  r: number,
  g: number,
  b: number,
) {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const idx = (y * imgW + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }
}

describe('leafRegions - proposeLeafRegions & gridTiles', () => {
  it('proposes 3 separated leaves in reading order on brown soil', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    // Soil background (brown/grey): rgb(100, 70, 50) -> hue ~24, s ~0.50, v ~0.39 (brown/soil)
    // Wait, let's make background strictly non-green non-brown (e.g. dark soil/grey rgb(60,60,60))
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 60
      data[i * 4 + 1] = 60
      data[i * 4 + 2] = 60
      data[i * 4 + 3] = 255
    }

    // 3 green leaves:
    // Leaf 1: top-left (x=50, y=40, w=50, h=40)
    // Leaf 2: top-right (x=250, y=40, w=50, h=40)
    // Leaf 3: bottom-center (x=150, y=180, w=60, h=40)
    drawRect(data, width, 50, 40, 50, 40, 34, 139, 34)
    drawRect(data, width, 250, 40, 50, 40, 50, 160, 50)
    drawRect(data, width, 150, 180, 60, 40, 40, 150, 40)

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('leaf_regions')
    expect(res.boxes.length).toBe(3)

    // Verify reading order: top-left first, top-right second, bottom-center third
    expect(res.boxes[0].y).toBeLessThan(res.boxes[2].y)
    expect(res.boxes[0].x).toBeLessThan(res.boxes[1].x)

    // All boxes strictly inside image bounds
    for (const box of res.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w).toBeLessThanOrEqual(width)
      expect(box.y + box.h).toBeLessThanOrEqual(height)
    }
  })

  it('falls back to grid_fallback with 6 tiles for full-frame canopy', () => {
    const width = 300
    const height = 200
    const data = new Uint8ClampedArray(width * height * 4)
    // Entire canvas green
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 34
      data[i * 4 + 1] = 139
      data[i * 4 + 2] = 34
      data[i * 4 + 3] = 255
    }

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('grid_fallback')
    expect(res.boxes.length).toBe(6)

    for (const box of res.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w).toBeLessThanOrEqual(width)
      expect(box.y + box.h).toBeLessThanOrEqual(height)
    }
  })

  it('gridTiles creates overlapping square tiles inside bounds', () => {
    const landscapeTiles = gridTiles(600, 400)
    expect(landscapeTiles.length).toBe(6) // 3x2
    for (const t of landscapeTiles) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.y).toBeGreaterThanOrEqual(0)
      expect(t.x + t.w).toBeLessThanOrEqual(600)
      expect(t.y + t.h).toBeLessThanOrEqual(400)
    }

    const portraitTiles = gridTiles(400, 600)
    expect(portraitTiles.length).toBe(6) // 2x3
    for (const t of portraitTiles) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.y).toBeGreaterThanOrEqual(0)
      expect(t.x + t.w).toBeLessThanOrEqual(400)
      expect(t.y + t.h).toBeLessThanOrEqual(600)
    }
  })
})
