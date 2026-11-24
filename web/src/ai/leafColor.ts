import type { LeafBox, LeafColorStats } from './fieldRow.types'
import type { PreprocessImageInput } from './preprocess'

const DEFAULT_INPUT_SIZE = 224

/**
 * Extracts raw RGBA pixel data from various image sources.
 */
export function extractPixelData(image: PreprocessImageInput): {
  data: ArrayLike<number>
  width: number
  height: number
} {
  if (
    'data' in image &&
    typeof image.width === 'number' &&
    typeof image.height === 'number'
  ) {
    return {
      data: image.data,
      width: image.width,
      height: image.height,
    }
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    const imgEl = image as any
    const w =
      imgEl.naturalWidth ||
      imgEl.videoWidth ||
      imgEl.width ||
      DEFAULT_INPUT_SIZE
    const h =
      imgEl.naturalHeight ||
      imgEl.videoHeight ||
      imgEl.height ||
      DEFAULT_INPUT_SIZE
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(image as CanvasImageSource, 0, 0)
      const imgData = ctx.getImageData(0, 0, w, h)
      return {
        data: imgData.data,
        width: w,
        height: h,
      }
    }
  }

  throw new Error('Unable to extract pixel data from image input')
}

/**
 * Pure RGB->HSV per pixel color analysis for leaf screening and abstention.
 * Stride subsampling of 2 is used if the evaluated region exceeds 200,000 pixels.
 */
export function computeColorStats(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  box?: LeafBox,
): LeafColorStats {
  const bx = box ? Math.max(0, Math.floor(box.x)) : 0
  const by = box ? Math.max(0, Math.floor(box.y)) : 0
  const bw = box ? Math.min(width - bx, Math.floor(box.w)) : width
  const bh = box ? Math.min(height - by, Math.floor(box.h)) : height

  if (bw <= 0 || bh <= 0 || width <= 0 || height <= 0) {
    return {
      greenRatio: 0,
      brownRatio: 0,
      greyRatio: 0,
      meanSaturation: 0,
    }
  }

  const area = bw * bh
  const stride = area > 200_000 ? 2 : 1

  let totalCount = 0
  let greenCount = 0
  let brownCount = 0
  let greyCount = 0
  let sumSaturation = 0

  for (let y = by; y < by + bh; y += stride) {
    for (let x = bx; x < bx + bw; x += stride) {
      const idx = (y * width + x) * 4
      const r = rgba[idx] / 255
      const g = rgba[idx + 1] / 255
      const b = rgba[idx + 2] / 255

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

      totalCount++
      sumSaturation += s

      // 1. Green: hue 60-170 deg, s >= 0.20, v >= 0.15
      const isGreen = h >= 60 && h <= 170 && s >= 0.20 && v >= 0.15
      // 2. Brown: hue 15-55 deg, s >= 0.20 OR straw: s < 0.25 and 0.25 < v < 0.75 with r > g > b
      const isStraw = s < 0.25 && v > 0.25 && v < 0.75 && r > g && g > b
      const isBrown = (h >= 15 && h <= 55 && s >= 0.20) || isStraw
      // 3. Grey: s < 0.15 and not straw
      const isGrey = s < 0.15 && !isStraw

      if (isGreen) {
        greenCount++
      } else if (isBrown) {
        brownCount++
      } else if (isGrey) {
        greyCount++
      }
    }
  }

  return {
    greenRatio: totalCount > 0 ? greenCount / totalCount : 0,
    brownRatio: totalCount > 0 ? brownCount / totalCount : 0,
    greyRatio: totalCount > 0 ? greyCount / totalCount : 0,
    meanSaturation: totalCount > 0 ? sumSaturation / totalCount : 0,
  }
}
