import { describe, expect, it } from 'vitest'
import { proposeLeafRegions, gridTiles, regionDebugStats } from './leafRegions'

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

  // --- Soil-aware region proposal tests (C1 bugfix) ---

  it('1. proposes 3 green leaves on brown soil rgb(120,85,55) without falling back to grid', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    // Realistic brown soil background
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 120
      data[i * 4 + 1] = 85
      data[i * 4 + 2] = 55
      data[i * 4 + 3] = 255
    }

    // 3 green leaves
    drawRect(data, width, 50, 40, 50, 40, 34, 139, 34)
    drawRect(data, width, 250, 40, 50, 40, 50, 160, 50)
    drawRect(data, width, 150, 180, 60, 40, 40, 150, 40)

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('leaf_regions')
    expect(res.boxes.length).toBe(3)

    // Reading order
    expect(res.boxes[0].y).toBeLessThan(res.boxes[2].y)
    expect(res.boxes[0].x).toBeLessThan(res.boxes[1].x)

    for (const box of res.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w).toBeLessThanOrEqual(width)
      expect(box.y + box.h).toBeLessThanOrEqual(height)
    }
  })

  it('2. proposes 2 green leaves and 1 elongated dry straw leaf rgb(200,170,110) on brown soil', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 120
      data[i * 4 + 1] = 85
      data[i * 4 + 2] = 55
      data[i * 4 + 3] = 255
    }

    // 2 green leaves
    drawRect(data, width, 50, 40, 50, 40, 34, 139, 34)
    drawRect(data, width, 250, 40, 50, 40, 50, 160, 50)
    // 1 elongated dry straw leaf: size 120x20, rgb(200,170,110)
    drawRect(data, width, 140, 180, 120, 20, 200, 170, 110)

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('leaf_regions')
    expect(res.boxes.length).toBe(3)

    for (const box of res.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w).toBeLessThanOrEqual(width)
      expect(box.y + box.h).toBeLessThanOrEqual(height)
    }
  })

  it('3. proposes 4 green leaves on muddy dark soil rgb(90,65,45)', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 90
      data[i * 4 + 1] = 65
      data[i * 4 + 2] = 45
      data[i * 4 + 3] = 255
    }

    // 4 green leaves
    drawRect(data, width, 40, 40, 50, 40, 34, 139, 34)
    drawRect(data, width, 260, 40, 50, 40, 50, 160, 50)
    drawRect(data, width, 40, 200, 50, 40, 40, 150, 40)
    drawRect(data, width, 260, 200, 50, 40, 34, 140, 34)

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('leaf_regions')
    expect(res.boxes.length).toBe(4)

    for (const box of res.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w).toBeLessThanOrEqual(width)
      expect(box.y + box.h).toBeLessThanOrEqual(height)
    }
  })

  it('4. falls back to grid_fallback without crashing when only soil is present', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 120
      data[i * 4 + 1] = 85
      data[i * 4 + 2] = 55
      data[i * 4 + 3] = 255
    }

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('grid_fallback')
    expect(res.boxes.length).toBe(6)
  })

  it('5. dense green canopy full frame still returns grid_fallback', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 40
      data[i * 4 + 1] = 150
      data[i * 4 + 2] = 40
      data[i * 4 + 3] = 255
    }

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('grid_fallback')
    expect(res.boxes.length).toBe(6)
  })

  it('6. dead brown leaf rgb(160,120,60) on green-dominant/grey background is proposed', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    // Neutral grey background
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 128
      data[i * 4 + 1] = 128
      data[i * 4 + 2] = 128
      data[i * 4 + 3] = 255
    }

    // 1 green leaf + 1 dead brown leaf
    drawRect(data, width, 50, 40, 60, 40, 34, 139, 34)
    drawRect(data, width, 250, 40, 60, 40, 160, 120, 60)

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('leaf_regions')
    expect(res.boxes.length).toBe(2)
  })

  it('regionDebugStats computes soilMode and shares correctly', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 120
      data[i * 4 + 1] = 85
      data[i * 4 + 2] = 55
      data[i * 4 + 3] = 255
    }
    const stats = regionDebugStats({ data, width, height })
    expect(stats.soilMode).toBe(true)
    expect(stats.brownShare).toBeGreaterThan(0.9)
    expect(stats.greenShare).toBe(0)
  })

  it('7. green row spanning full width (touching 3 borders) survives soil mode', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    // Soil background rgb(120, 85, 55)
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 120
      data[i * 4 + 1] = 85
      data[i * 4 + 2] = 55
      data[i * 4 + 3] = 255
    }

    // Green row spanning full width at bottom: x=0, y=230, w=400, h=70, rgb(40, 150, 40)
    drawRect(data, width, 0, 230, 400, 70, 40, 150, 40)

    // Two green 50x40 leaves at (60,40) and (250,40)
    drawRect(data, width, 60, 40, 50, 40, 40, 150, 40)
    drawRect(data, width, 250, 40, 50, 40, 40, 150, 40)

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('leaf_regions')
    expect(res.boxes.length).toBe(3)
    // Strip at y=230 expands upwards to y=161 due to square-ish adjustment (h >= 0.5 * w)
    const rowBox = res.boxes.find((b) => b.y >= 150 && b.w >= 300)
    expect(rowBox).toBeDefined()
  })

  it('8. bright straw band spanning full width at bottom (touches 3 borders, brown) stays dropped', () => {
    const width = 400
    const height = 300
    const data = new Uint8ClampedArray(width * height * 4)

    // Soil background rgb(120, 85, 55)
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 120
      data[i * 4 + 1] = 85
      data[i * 4 + 2] = 55
      data[i * 4 + 3] = 255
    }

    // Bright straw band spanning full width at bottom: rgb(200, 170, 110)
    drawRect(data, width, 0, 230, 400, 70, 200, 170, 110)

    // Two green 50x40 leaves at (60,40) and (250,40)
    drawRect(data, width, 60, 40, 50, 40, 40, 150, 40)
    drawRect(data, width, 250, 40, 50, 40, 40, 150, 40)

    const res = proposeLeafRegions({ data, width, height })
    expect(res.mode).toBe('leaf_regions')
    // Straw band touches 3 borders and is brown (< 0.5 green), so it must be dropped
    expect(res.boxes.length).toBe(2)
    const strawBox = res.boxes.find((b) => b.y >= 200 && b.w >= 300)
    expect(strawBox).toBeUndefined()
  })
})
