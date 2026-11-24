import { describe, expect, it } from 'vitest'
import { decideAbstention, entropyAndMargin, ABSTAIN_THRESHOLDS } from './abstain'
import type { ClassProb, ModelMeta } from './types'
import type { LeafColorStats } from './fieldRow.types'

const dummyMeta: Pick<ModelMeta, 'thresholds'> = {
  thresholds: {
    high: 0.85,
    medium: 0.60,
    healthyHigh: 0.85,
    notRice: 0.9471,
  },
}

function makeProbs(overrides: Partial<Record<string, number>>): ClassProb[] {
  const base: Record<string, number> = {
    healthy: 0.1,
    blast: 0.1,
    brown_spot: 0.1,
    leaf_smut: 0.1,
    tungro: 0.1,
    sheath_blight: 0.1,
    not_rice: 0.01,
  }
  const merged = { ...base, ...overrides }
  return Object.entries(merged).map(([classId, prob]) => ({
    classId: classId as any,
    prob: prob ?? 0,
  }))
}

const greenStats: LeafColorStats = {
  greenRatio: 0.85,
  brownRatio: 0.05,
  greyRatio: 0.10,
  meanSaturation: 0.65,
}

const deadBrownStats: LeafColorStats = {
  greenRatio: 0.10,
  brownRatio: 0.75,
  greyRatio: 0.15,
  meanSaturation: 0.40,
}

const noLeafStats: LeafColorStats = {
  greenRatio: 0.02,
  brownRatio: 0.05,
  greyRatio: 0.93,
  meanSaturation: 0.05,
}

describe('abstain - entropyAndMargin', () => {
  it('exports valid documented threshold values', () => {
    expect(ABSTAIN_THRESHOLDS.deadBrownMin).toBe(0.45)
    expect(ABSTAIN_THRESHOLDS.deadGreenMax).toBe(0.20)
    expect(ABSTAIN_THRESHOLDS.minGreenForLeaf).toBe(0.12)
    expect(ABSTAIN_THRESHOLDS.unrelatedEntropyMin).toBe(0.80)
    expect(ABSTAIN_THRESHOLDS.unrelatedMarginMax).toBe(0.10)
    expect(ABSTAIN_THRESHOLDS.unrelatedNotRiceSoft).toBe(0.50)
  })

  it('computes zero entropy for uniform 1.0 peak and 1.0 margin', () => {
    const probs = makeProbs({ blast: 1.0, healthy: 0, brown_spot: 0, leaf_smut: 0, tungro: 0, sheath_blight: 0 })
    const { entropy, margin } = entropyAndMargin(probs)
    expect(entropy).toBeCloseTo(0, 2)
    expect(margin).toBeCloseTo(1.0, 2)
  })

  it('computes maximum entropy 1.0 and zero margin for flat disease distribution', () => {
    const probs = makeProbs({
      blast: 0.16,
      healthy: 0.16,
      brown_spot: 0.16,
      leaf_smut: 0.16,
      tungro: 0.16,
      sheath_blight: 0.16,
    })
    const { entropy, margin } = entropyAndMargin(probs)
    expect(entropy).toBeCloseTo(1.0, 1)
    expect(margin).toBeCloseTo(0, 2)
  })
})

describe('abstain - decideAbstention', () => {
  it('rule 1: abstains not_rice if p(not_rice) >= meta.thresholds.notRice', () => {
    const probs = makeProbs({ not_rice: 0.96, blast: 0.02 })
    const reason = decideAbstention({ probs, color: greenStats, meta: dummyMeta })
    expect(reason).toBe('not_rice')
  })

  it('rule 2: abstains dead_leaf if brownRatio >= deadBrownMin && greenRatio <= deadGreenMax', () => {
    const probs = makeProbs({ blast: 0.85, not_rice: 0.01 })
    const reason = decideAbstention({ probs, color: deadBrownStats, meta: dummyMeta })
    expect(reason).toBe('dead_leaf')
  })

  it('rule 3a: abstains unrelated_crop if green plant and p(not_rice) >= unrelatedNotRiceSoft', () => {
    const probs = makeProbs({ not_rice: 0.60, blast: 0.20 })
    const reason = decideAbstention({ probs, color: greenStats, meta: dummyMeta })
    expect(reason).toBe('unrelated_crop')
  })

  it('rule 3b: abstains unrelated_crop if green plant with flat disease distribution (high entropy, low margin)', () => {
    const probs = makeProbs({
      blast: 0.17,
      healthy: 0.17,
      brown_spot: 0.17,
      leaf_smut: 0.17,
      tungro: 0.16,
      sheath_blight: 0.16,
      not_rice: 0.02,
    })
    const reason = decideAbstention({ probs, color: greenStats, meta: dummyMeta })
    expect(reason).toBe('unrelated_crop')
  })

  it('rule 4: abstains not_rice if greenRatio < minGreenForLeaf (no leaf at all)', () => {
    const probs = makeProbs({ blast: 0.50, not_rice: 0.10 })
    const reason = decideAbstention({ probs, color: noLeafStats, meta: dummyMeta })
    expect(reason).toBe('not_rice')
  })

  it('rule 5: confident rice prediction on a green leaf returns null', () => {
    const probs = makeProbs({ blast: 0.90, not_rice: 0.01 })
    const reason = decideAbstention({ probs, color: greenStats, meta: dummyMeta })
    expect(reason).toBeNull()
  })

  it('ordering: not_rice gate beats dead_leaf', () => {
    const probs = makeProbs({ not_rice: 0.98 })
    const reason = decideAbstention({ probs, color: deadBrownStats, meta: dummyMeta })
    expect(reason).toBe('not_rice')
  })
})
