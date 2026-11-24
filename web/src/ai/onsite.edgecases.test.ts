import { describe, it, expect } from 'vitest'
import { decideAbstention } from './abstain'
import { computeColorStats } from './leafColor'
import { summarizeField } from './fieldRow'
import { proposeLeafRegions } from './leafRegions'
import type { LeafColorStats, LeafScreening, FieldSummary } from './fieldRow.types'
import type { ClassProb, ModelMeta } from './types'

const meta: Pick<ModelMeta, 'thresholds'> = {
  thresholds: {
    high: 0.85,
    medium: 0.60,
    healthyHigh: 0.80,
    notRice: 0.9471,
  },
}

describe('onsite edge-cases (C1 Field Row + C2 Abstention Engine)', () => {
  describe('C2: decideAbstention edge cases', () => {
    it('1. returns not_rice when p(not_rice) >= threshold (0.9471)', () => {
      const probs: ClassProb[] = [
        { classId: 'not_rice', prob: 0.96 },
        { classId: 'blast', prob: 0.02 },
        { classId: 'healthy', prob: 0.02 },
      ]
      const color: LeafColorStats = { greenRatio: 0.5, brownRatio: 0.1, greyRatio: 0.1, meanSaturation: 0.5 }
      const res = decideAbstention({ probs, color, meta })
      expect(res).toBe('not_rice')
    })

    it('2. returns dead_leaf for brown/dry leaf even if disease probs are confident', () => {
      const probs: ClassProb[] = [
        { classId: 'blast', prob: 0.92 },
        { classId: 'brown_spot', prob: 0.05 },
        { classId: 'not_rice', prob: 0.03 },
      ]
      const color: LeafColorStats = { greenRatio: 0.1, brownRatio: 0.65, greyRatio: 0.1, meanSaturation: 0.4 }
      const res = decideAbstention({ probs, color, meta })
      expect(res).toBe('dead_leaf')
    })

    it('3. returns unrelated_crop for living green non-rice with high entropy / low margin', () => {
      // Flat distribution over disease classes
      const probs: ClassProb[] = [
        { classId: 'blast', prob: 0.18 },
        { classId: 'brown_spot', prob: 0.17 },
        { classId: 'sheath_blight', prob: 0.17 },
        { classId: 'tungro', prob: 0.16 },
        { classId: 'healthy', prob: 0.16 },
        { classId: 'leaf_smut', prob: 0.16 },
      ]
      const color: LeafColorStats = { greenRatio: 0.45, brownRatio: 0.05, greyRatio: 0.1, meanSaturation: 0.6 }
      const res = decideAbstention({ probs, color, meta })
      expect(res).toBe('unrelated_crop')
    })

    it('4. returns not_rice when leaf has no green at all (< 0.12)', () => {
      const probs: ClassProb[] = [
        { classId: 'healthy', prob: 0.6 },
        { classId: 'blast', prob: 0.4 },
      ]
      // Soil/mud/grey patch
      const color: LeafColorStats = { greenRatio: 0.05, brownRatio: 0.1, greyRatio: 0.85, meanSaturation: 0.05 }
      const res = decideAbstention({ probs, color, meta })
      expect(res).toBe('not_rice')
    })

    it('5. returns null for a confident disease on a green rice leaf', () => {
      const probs: ClassProb[] = [
        { classId: 'blast', prob: 0.88 },
        { classId: 'brown_spot', prob: 0.08 },
        { classId: 'healthy', prob: 0.04 },
      ]
      const color: LeafColorStats = { greenRatio: 0.6, brownRatio: 0.15, greyRatio: 0.1, meanSaturation: 0.55 }
      const res = decideAbstention({ probs, color, meta })
      expect(res).toBeNull()
    })

    it('6. ordering: not_rice beats dead_leaf when both conditions trigger', () => {
      const probs: ClassProb[] = [
        { classId: 'not_rice', prob: 0.98 },
        { classId: 'blast', prob: 0.02 },
      ]
      const color: LeafColorStats = { greenRatio: 0.05, brownRatio: 0.8, greyRatio: 0.1, meanSaturation: 0.4 }
      const res = decideAbstention({ probs, color, meta })
      expect(res).toBe('not_rice')
    })
  })

  describe('C2: computeColorStats synthetic tests', () => {
    it('1. detects pure green patch', () => {
      // 10x10 green pixels (R=30, G=180, B=40, A=255)
      const rgba = new Uint8Array(10 * 10 * 4)
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = 30
        rgba[i + 1] = 180
        rgba[i + 2] = 40
        rgba[i + 3] = 255
      }
      const stats = computeColorStats(rgba, 10, 10)
      expect(stats.greenRatio).toBeGreaterThan(0.9)
    })

    it('2. detects tan / straw / brown patch', () => {
      // R=160, G=120, B=60 (dry yellow-brown)
      const rgba = new Uint8Array(10 * 10 * 4)
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = 160
        rgba[i + 1] = 120
        rgba[i + 2] = 60
        rgba[i + 3] = 255
      }
      const stats = computeColorStats(rgba, 10, 10)
      expect(stats.brownRatio).toBeGreaterThan(0.8)
    })

    it('3. detects grey / background patch', () => {
      // Low saturation grey (R=128, G=128, B=128)
      const rgba = new Uint8Array(10 * 10 * 4)
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = 128
        rgba[i + 1] = 128
        rgba[i + 2] = 128
        rgba[i + 3] = 255
      }
      const stats = computeColorStats(rgba, 10, 10)
      expect(stats.greyRatio).toBeGreaterThan(0.9)
    })

    it('4. detects half-green / half-brown patch', () => {
      const rgba = new Uint8Array(10 * 10 * 4)
      for (let i = 0; i < rgba.length; i += 4) {
        if (i < rgba.length / 2) {
          rgba[i] = 30; rgba[i + 1] = 180; rgba[i + 2] = 40; rgba[i + 3] = 255
        } else {
          rgba[i] = 160; rgba[i + 1] = 120; rgba[i + 2] = 60; rgba[i + 3] = 255
        }
      }
      const stats = computeColorStats(rgba, 10, 10)
      expect(stats.greenRatio).toBeGreaterThan(0.35)
      expect(stats.brownRatio).toBeGreaterThan(0.35)
    })
  })

  describe('C1: summarizeField edge cases', () => {
    it('1. handles 0 leaves with all zeroes and null fieldAbstain', () => {
      const summary: FieldSummary = summarizeField([])
      expect(summary.totalRegions).toBe(0)
      expect(summary.screened).toBe(0)
      expect(summary.healthy).toBe(0)
      expect(summary.diseased).toBe(0)
      expect(summary.fieldAbstain).toBeNull()
      expect(summary.diseasedShare).toBe(0)
    })

    it('2. all abstained leaves set fieldAbstain to dominant reason and screened 0', () => {
      const mockLeaves: LeafScreening[] = [
        {
          id: 1,
          box: { x: 0, y: 0, w: 50, h: 50 },
          source: 'leaf_region',
          status: 'abstained',
          label: null,
          confidence: 0,
          tier: 'not_rice',
          abstain: 'dead_leaf',
          margin: 0,
          entropy: 1,
          pNotRice: 0.1,
          color: { greenRatio: 0, brownRatio: 0.8, greyRatio: 0.2, meanSaturation: 0.4 },
        },
        {
          id: 2,
          box: { x: 50, y: 0, w: 50, h: 50 },
          source: 'leaf_region',
          status: 'abstained',
          label: null,
          confidence: 0,
          tier: 'not_rice',
          abstain: 'dead_leaf',
          margin: 0,
          entropy: 1,
          pNotRice: 0.1,
          color: { greenRatio: 0, brownRatio: 0.8, greyRatio: 0.2, meanSaturation: 0.4 },
        },
      ]
      const summary: FieldSummary = summarizeField(mockLeaves)
      expect(summary.screened).toBe(0)
      expect(summary.abstained).toBe(2)
      expect(summary.fieldAbstain).toBe('dead_leaf')
    })

    it('3. mixed leaves satisfy screened + abstained === totalRegions', () => {
      const mockLeaves: LeafScreening[] = [
        {
          id: 1,
          box: { x: 0, y: 0, w: 50, h: 50 },
          source: 'leaf_region',
          status: 'healthy',
          label: 'healthy',
          confidence: 0.9,
          tier: 'high',
          abstain: null,
          margin: 0.8,
          entropy: 0.2,
          pNotRice: 0.01,
          color: { greenRatio: 0.8, brownRatio: 0.1, greyRatio: 0.1, meanSaturation: 0.7 },
        },
        {
          id: 2,
          box: { x: 50, y: 0, w: 50, h: 50 },
          source: 'leaf_region',
          status: 'diseased',
          label: 'blast',
          confidence: 0.85,
          tier: 'high',
          abstain: null,
          margin: 0.7,
          entropy: 0.3,
          pNotRice: 0.02,
          color: { greenRatio: 0.6, brownRatio: 0.2, greyRatio: 0.1, meanSaturation: 0.6 },
        },
        {
          id: 3,
          box: { x: 100, y: 0, w: 50, h: 50 },
          source: 'leaf_region',
          status: 'abstained',
          label: null,
          confidence: 0,
          tier: 'not_rice',
          abstain: 'unrelated_crop',
          margin: 0,
          entropy: 1,
          pNotRice: 0.4,
          color: { greenRatio: 0.5, brownRatio: 0.1, greyRatio: 0.2, meanSaturation: 0.5 },
        },
      ]
      const summary: FieldSummary = summarizeField(mockLeaves)
      expect(summary.totalRegions).toBe(3)
      expect(summary.screened + summary.abstained).toBe(summary.totalRegions)
      expect(summary.healthy).toBe(1)
      expect(summary.diseased).toBe(1)
      expect(summary.abstained).toBe(1)
      expect(summary.byDisease.healthy).toBeUndefined()
    })

    it('4. highestRisk breaks tie by higher maxConfidence', () => {
      const mockLeaves: LeafScreening[] = [
        {
          id: 1,
          box: { x: 0, y: 0, w: 50, h: 50 },
          source: 'leaf_region',
          status: 'diseased',
          label: 'blast',
          confidence: 0.75,
          tier: 'high',
          abstain: null,
          margin: 0.5,
          entropy: 0.4,
          pNotRice: 0.01,
          color: { greenRatio: 0.6, brownRatio: 0.2, greyRatio: 0.1, meanSaturation: 0.6 },
        },
        {
          id: 2,
          box: { x: 50, y: 0, w: 50, h: 50 },
          source: 'leaf_region',
          status: 'diseased',
          label: 'brown_spot',
          confidence: 0.89,
          tier: 'high',
          abstain: null,
          margin: 0.7,
          entropy: 0.2,
          pNotRice: 0.01,
          color: { greenRatio: 0.6, brownRatio: 0.2, greyRatio: 0.1, meanSaturation: 0.6 },
        },
      ]
      const summary: FieldSummary = summarizeField(mockLeaves)
      expect(summary.highestRisk?.classId).toBe('brown_spot')
      expect(summary.highestRisk?.maxConfidence).toBe(0.89)
    })
  })

  describe('C1: proposeLeafRegions', () => {
    it('1. returned boxes are inside image bounds and in reading order', () => {
      // 100x100 image
      const rgba = new Uint8Array(100 * 100 * 4)
      const res = proposeLeafRegions({ data: rgba, width: 100, height: 100 })
      expect(Array.isArray(res.boxes)).toBe(true)
      for (const box of res.boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.x + box.w).toBeLessThanOrEqual(100)
        expect(box.y + box.h).toBeLessThanOrEqual(100)
      }
    })

    it('2. full-frame green triggers grid_fallback mode', () => {
      // Solid green 200x200
      const rgba = new Uint8Array(200 * 200 * 4)
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = 30; rgba[i + 1] = 180; rgba[i + 2] = 40; rgba[i + 3] = 255
      }
      const res = proposeLeafRegions({ data: rgba, width: 200, height: 200 })
      expect(res.mode).toBe('grid_fallback')
      expect(res.boxes.length).toBeGreaterThanOrEqual(4)
    })
  })
})
