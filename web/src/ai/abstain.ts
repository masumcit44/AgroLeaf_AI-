import type { AbstentionReason, LeafColorStats } from './fieldRow.types'
import type { ClassProb, ModelMeta } from './types'

/**
 * Tuned thresholds for honest abstention (Challenge 2).
 * - deadBrownMin / deadGreenMax: Detects dry straw/dead leaves where disease symptoms are obscured.
 * - minGreenForLeaf: Minimum chlorophyll presence needed to consider the region a living leaf.
 * - unrelatedEntropyMin / unrelatedMarginMax: Unrelated plants produce flat, ambiguous predictions across rice disease classes.
 * - unrelatedNotRiceSoft: Moderate confidence in not_rice combined with green plant tissue indicates an unrelated crop.
 * Note: not_rice hard threshold is dynamically read from meta.thresholds.notRice (0.9471).
 */
export const ABSTAIN_THRESHOLDS = {
  deadBrownMin: 0.45,
  deadGreenMax: 0.20,
  minGreenForLeaf: 0.12,
  unrelatedEntropyMin: 0.80,
  unrelatedMarginMax: 0.10,
  unrelatedNotRiceSoft: 0.50,
} as const

/**
 * Computes normalised Shannon entropy (0..1) and confidence margin (top1 - top2)
 * over the rice disease classes (excluding not_rice).
 */
export function entropyAndMargin(probs: ClassProb[]): { entropy: number; margin: number } {
  const diseaseProbs = probs.filter((p) => p.classId !== 'not_rice')
  if (diseaseProbs.length === 0) {
    return { entropy: 0, margin: 1 }
  }

  // Sort descending by probability
  const sorted = [...diseaseProbs].sort((a, b) => b.prob - a.prob)
  const margin = sorted.length >= 2 ? Math.max(0, sorted[0].prob - sorted[1].prob) : sorted[0].prob

  const total = sorted.reduce((sum, p) => sum + Math.max(0, p.prob), 0)
  if (total <= 0) {
    return { entropy: 1, margin: 0 }
  }

  let h = 0
  for (const p of sorted) {
    const q = Math.max(0, p.prob) / total
    if (q > 1e-9) {
      h -= q * Math.log(q)
    }
  }

  const k = sorted.length
  const maxH = k > 1 ? Math.log(k) : 1
  const normEntropy = maxH > 0 ? Math.min(1, Math.max(0, h / maxH)) : 0

  return { entropy: normEntropy, margin }
}

/**
 * Evaluates whether to abstain from diagnosing a leaf region.
 * Strict priority order:
 * 1. 'not_rice': hard gate if p(not_rice) >= meta.thresholds.notRice
 * 2. 'dead_leaf': dry/brown/straw tissue without sufficient living green
 * 3. 'unrelated_crop': living green plant with flat disease distribution or moderate not_rice score
 * 4. 'not_rice': insufficient green tissue to be a leaf
 * 5. null: acceptable rice leaf for diagnosis
 */
export function decideAbstention(args: {
  probs: ClassProb[]
  color: LeafColorStats
  meta: Pick<ModelMeta, 'thresholds'>
}): AbstentionReason | null {
  const { probs, color, meta } = args
  const notRiceProb = probs.find((p) => p.classId === 'not_rice')?.prob ?? 0

  // 1. Existing hard not_rice gate
  if (notRiceProb >= meta.thresholds.notRice) {
    return 'not_rice'
  }

  // 2. Dead leaf: high brown ratio and low green ratio
  if (
    color.brownRatio >= ABSTAIN_THRESHOLDS.deadBrownMin &&
    color.greenRatio <= ABSTAIN_THRESHOLDS.deadGreenMax
  ) {
    return 'dead_leaf'
  }

  // 3. Unrelated crop: living plant tissue with ambiguous disease distribution or elevated not_rice
  const { entropy, margin } = entropyAndMargin(probs)
  if (color.greenRatio >= ABSTAIN_THRESHOLDS.minGreenForLeaf) {
    if (
      notRiceProb >= ABSTAIN_THRESHOLDS.unrelatedNotRiceSoft ||
      (entropy >= ABSTAIN_THRESHOLDS.unrelatedEntropyMin &&
        margin <= ABSTAIN_THRESHOLDS.unrelatedMarginMax)
    ) {
      return 'unrelated_crop'
    }
  }

  // 4. No leaf at all (insufficient green)
  if (color.greenRatio < ABSTAIN_THRESHOLDS.minGreenForLeaf) {
    return 'not_rice'
  }

  // 5. Normal rice leaf
  return null
}
