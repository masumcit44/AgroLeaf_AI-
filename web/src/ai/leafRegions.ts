import type { LeafBox } from './fieldRow.types'

export type PixelClass = 'green' | 'brown' | 'other'

/**
 * Classifies an RGB pixel (0..255) into 'green', 'brown', or 'other'
 * using HSV color space thresholds, and returns its value (v in 0..1).
 */
export function classifyPixel(
  r255: number,
  g255: number,
  b255: number,
): { type: PixelClass; v: number } {
  const r = r255 / 255
  const g = g255 / 255
  const b = b255 / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  const v = max
  const s = max === 0 ? 0 : delta / max

  let h = 0
  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6)
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2)
    } else {
      h = 60 * ((r - g) / delta + 4)
    }
    if (h < 0) {
      h += 360
    }
  }

  // 1. Green: hue 60-170 deg, s >= 0.20, v >= 0.15
  if (h >= 60 && h <= 170 && s >= 0.20 && v >= 0.15) {
    return { type: 'green', v }
  }
  // 2. Brown: hue 15-55 deg, s >= 0.20 OR straw: s < 0.25 and 0.25 < v < 0.75 with r > g > b
  const isStraw = s < 0.25 && v > 0.25 && v < 0.75 && r > g && g > b
  if ((h >= 15 && h <= 55 && s >= 0.20) || isStraw) {
    return { type: 'brown', v }
  }

  return { type: 'other', v }
}

export interface RegionDebugStats {
  soilMode: boolean
  brownShare: number
  greenShare: number
  medianBrownV: number
}

/**
 * Computes debug stats and soil mode detection for a given image.
 * Downscales to max dimension 320 px before computing pixel share statistics.
 */
export function regionDebugStats(
  img: { data: ArrayLike<number>; width: number; height: number },
): RegionDebugStats {
  const { data, width, height } = img
  if (width <= 0 || height <= 0 || !data || data.length === 0) {
    return { soilMode: false, brownShare: 0, greenShare: 0, medianBrownV: 0 }
  }

  const maxDim = Math.max(width, height)
  const scale = maxDim > 320 ? 320 / maxDim : 1.0
  const dw = Math.max(1, Math.round(width * scale))
  const dh = Math.max(1, Math.round(height * scale))
  const total = dw * dh

  let greenCount = 0
  let brownCount = 0
  const hist = new Uint32Array(32)

  for (let dy = 0; dy < dh; dy++) {
    const sy = Math.min(height - 1, Math.floor(dy / scale))
    for (let dx = 0; dx < dw; dx++) {
      const sx = Math.min(width - 1, Math.floor(dx / scale))
      const idx = (sy * width + sx) * 4
      const { type, v } = classifyPixel(data[idx], data[idx + 1], data[idx + 2])
      if (type === 'green') {
        greenCount++
      } else if (type === 'brown') {
        brownCount++
        const bin = Math.min(31, Math.max(0, Math.floor(v * 32)))
        hist[bin]++
      }
    }
  }

  const brownShare = total > 0 ? brownCount / total : 0
  const greenShare = total > 0 ? greenCount / total : 0
  const soilMode = brownShare >= 0.35

  let medianBrownV = 0
  if (brownCount > 0) {
    let cumulative = 0
    const target = brownCount / 2
    for (let b = 0; b < 32; b++) {
      cumulative += hist[b]
      if (cumulative >= target) {
        medianBrownV = (b + 0.5) / 32
        break
      }
    }
  }

  return { soilMode, brownShare, greenShare, medianBrownV }
}

/**
 * Computes Intersection over Union (IoU) between two bounding boxes.
 */
function boxIoU(a: LeafBox, b: LeafBox): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)

  const interW = Math.max(0, x2 - x1)
  const interH = Math.max(0, y2 - y1)
  const interArea = interW * interH
  if (interArea <= 0) return 0

  const areaA = a.w * a.h
  const areaB = b.w * b.h
  const unionArea = areaA + areaB - interArea
  return unionArea > 0 ? interArea / unionArea : 0
}

/**
 * Generates overlapping grid tiles (3x2 landscape or 2x3 portrait) with ~15% overlap.
 */
export function gridTiles(width: number, height: number): LeafBox[] {
  const isLandscape = width >= height
  const cols = isLandscape ? 3 : 2
  const rows = isLandscape ? 2 : 3
  const overlap = 0.15

  // Tile dimensions accounting for overlap step: width = Tw * (1 + (cols - 1) * (1 - overlap))
  const tw = Math.round(width / (1 + (cols - 1) * (1 - overlap)))
  const th = Math.round(height / (1 + (rows - 1) * (1 - overlap)))
  const stepX = (width - tw) / Math.max(1, cols - 1)
  const stepY = (height - th) / Math.max(1, rows - 1)

  const tiles: LeafBox[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.max(0, Math.min(width - 1, Math.round(c * stepX)))
      const y = Math.max(0, Math.min(height - 1, Math.round(r * stepY)))
      const w = Math.min(width - x, tw)
      const h = Math.min(height - y, th)
      tiles.push({ x, y, w, h })
    }
  }

  return tiles
}

/**
 * Soil-aware region proposal heuristics:
 * - 0.35 (soilMode threshold): When brown pixels comprise >= 35% of the frame, the scene is
 *   dominated by soil/ground rather than dense foliage or neutral studio background.
 * - 0.55 (absolute brightness floor): Dry straw/dead leaf tissue typically has high reflectance
 *   (v >= 0.55), whereas wet or muddy paddy soil has lower value (v < 0.55).
 * - +0.15 (relative brightness contrast): Retains brown pixels with value >= medianBrownV + 0.15,
 *   ensuring high-contrast straw/dead leaves are segmented while ambient soil is suppressed.
 * - 3 borders: Components touching >= 3 image borders represent pervasive background terrain
 *   surrounding the plant canopy, rather than an isolated leaf region.
 *
 * Proposes individual leaf regions from a whole-canopy or field-row photo.
 * If individual leaves cannot be segmented or canopy is dense (>70%),
 * returns overlapping grid tiles fallback.
 */
export function proposeLeafRegions(
  img: { data: ArrayLike<number>; width: number; height: number },
  opts?: { maxRegions?: number },
): { boxes: LeafBox[]; mode: 'leaf_regions' | 'grid_fallback' } {
  const { data, width, height } = img
  const maxRegions = opts?.maxRegions ?? 24

  if (width <= 0 || height <= 0 || !data || data.length === 0) {
    return { boxes: [], mode: 'grid_fallback' }
  }

  // 1. Downscale to <= 320 px long side
  const maxDim = Math.max(width, height)
  const scale = maxDim > 320 ? 320 / maxDim : 1.0
  const dw = Math.max(1, Math.round(width * scale))
  const dh = Math.max(1, Math.round(height * scale))
  const totalScaledArea = dw * dh

  // 2. Compute image statistics for soil-awareness (Pass 1)
  const stats = regionDebugStats(img)
  const brownThreshold = Math.max(0.55, stats.medianBrownV + 0.15)

  // 3. Build binary mask (Pass 2)
  // Soil mode: green OR leaf-bright brown (v >= max(0.55, medianBrownV + 0.15))
  // Normal mode: green OR brown
  const mask = new Uint8Array(totalScaledArea)
  for (let dy = 0; dy < dh; dy++) {
    const sy = Math.min(height - 1, Math.floor(dy / scale))
    for (let dx = 0; dx < dw; dx++) {
      const sx = Math.min(width - 1, Math.floor(dx / scale))
      const idx = (sy * width + sx) * 4
      const { type, v } = classifyPixel(data[idx], data[idx + 1], data[idx + 2])
      if (type === 'green') {
        mask[dy * dw + dx] = 1
      } else if (type === 'brown') {
        if (!stats.soilMode || v >= brownThreshold) {
          mask[dy * dw + dx] = 1
        }
      }
    }
  }

  // 4. 1-pass 3x3 dilation
  const dilated = new Uint8Array(totalScaledArea)
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      if (mask[y * dw + x] === 1) {
        for (let ny = Math.max(0, y - 1); ny <= Math.min(dh - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(dw - 1, x + 1); nx++) {
            dilated[ny * dw + nx] = 1
          }
        }
      }
    }
  }

  // 5. Connected components (BFS 4-neighbour)
  const visited = new Uint8Array(totalScaledArea)
  const minPixels = Math.max(1, Math.round(totalScaledArea * 0.004)) // 0.4% threshold
  const rawBoxes: LeafBox[] = []

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const startIdx = y * dw + x
      if (dilated[startIdx] === 0 || visited[startIdx] === 1) {
        continue
      }

      visited[startIdx] = 1
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let count = 0

      const queueX = [x]
      const queueY = [y]

      while (queueX.length > 0) {
        const cx = queueX.pop()!
        const cy = queueY.pop()!
        count++

        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        // 4-neighbors
        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ]

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < dw && ny >= 0 && ny < dh) {
            const nIdx = ny * dw + nx
            if (dilated[nIdx] === 1 && visited[nIdx] === 0) {
              visited[nIdx] = 1
              queueX.push(nx)
              queueY.push(ny)
            }
          }
        }
      }

      // In soil mode, drop any component that touches 3 or more image borders
      const touchesLeft = minX <= 0
      const touchesRight = maxX >= dw - 1
      const touchesTop = minY <= 0
      const touchesBottom = maxY >= dh - 1
      const bordersTouched =
        (touchesLeft ? 1 : 0) +
        (touchesRight ? 1 : 0) +
        (touchesTop ? 1 : 0) +
        (touchesBottom ? 1 : 0)

      if (count >= minPixels) {
        if (stats.soilMode && bordersTouched >= 3) {
          continue
        }

        rawBoxes.push({
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
        })
      }
    }
  }

  // 6. Merge boxes with IoU > 0.3
  let mergedBoxes = [...rawBoxes]
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < mergedBoxes.length; i++) {
      for (let j = i + 1; j < mergedBoxes.length; j++) {
        if (boxIoU(mergedBoxes[i], mergedBoxes[j]) > 0.3) {
          const b1 = mergedBoxes[i]
          const b2 = mergedBoxes[j]
          const nx = Math.min(b1.x, b2.x)
          const ny = Math.min(b1.y, b2.y)
          const nw = Math.max(b1.x + b1.w, b2.x + b2.w) - nx
          const nh = Math.max(b1.y + b1.h, b2.y + b2.h) - ny
          mergedBoxes[i] = { x: nx, y: ny, w: nw, h: nh }
          mergedBoxes.splice(j, 1)
          changed = true
          break
        }
      }
      if (changed) break
    }
  }

  // 7. Pad each box 8%, make square-ish (min side >= 0.5 * max side), clip, and scale back to original coords
  const processedBoxes: LeafBox[] = mergedBoxes.map((b) => {
    // 8% padding
    const padX = Math.round(b.w * 0.08)
    const padY = Math.round(b.h * 0.08)
    let px = Math.max(0, b.x - padX)
    let py = Math.max(0, b.y - padY)
    let pw = Math.min(dw - px, b.w + padX * 2)
    let ph = Math.min(dh - py, b.h + padY * 2)

    // Square-ish adjustment (min side >= 0.5 * max side)
    if (pw < 0.5 * ph) {
      const targetW = 0.5 * ph
      const diff = targetW - pw
      px = Math.max(0, Math.round(px - diff / 2))
      pw = Math.min(dw - px, Math.round(targetW))
    } else if (ph < 0.5 * pw) {
      const targetH = 0.5 * pw
      const diff = targetH - ph
      py = Math.max(0, Math.round(py - diff / 2))
      ph = Math.min(dh - py, Math.round(targetH))
    }

    // Scale back to original coordinates
    const ox = Math.max(0, Math.min(width - 1, Math.round(px / scale)))
    const oy = Math.max(0, Math.min(height - 1, Math.round(py / scale)))
    const ow = Math.min(width - ox, Math.max(1, Math.round(pw / scale)))
    const oh = Math.min(height - oy, Math.max(1, Math.round(ph / scale)))

    return { x: ox, y: oy, w: ow, h: oh }
  })

  // 8. Check dense canopy or insufficient regions
  const totalArea = width * height
  const hasDenseCanopy = processedBoxes.some((b) => b.w * b.h > 0.70 * totalArea)

  if (processedBoxes.length < 2 || hasDenseCanopy) {
    return {
      boxes: gridTiles(width, height),
      mode: 'grid_fallback',
    }
  }

  // 9. Keep largest maxRegions
  processedBoxes.sort((a, b) => b.w * b.h - a.w * a.h)
  const kept = processedBoxes.slice(0, maxRegions)

  // 10. Sort in reading order (top to bottom, left to right)
  const rowBand = height * 0.10
  kept.sort((a, b) => {
    if (Math.abs(a.y - b.y) > rowBand) {
      return a.y - b.y
    }
    return a.x - b.x
  })

  return {
    boxes: kept,
    mode: 'leaf_regions',
  }
}
