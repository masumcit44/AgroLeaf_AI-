import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resetEngineState } from './engine'
import { summarizeField, screenFieldRow } from './fieldRow'
import type { LeafScreening } from './fieldRow.types'
import type { ModelMeta } from './types'

const dummyMeta: ModelMeta = {
  version: 'v1-test',
  architecture: 'MobileNetV3-Small (random init)',
  trainedFromScratch: true,
  classes: [
    'healthy',
    'blast',
    'brown_spot',
    'leaf_smut',
    'tungro',
    'sheath_blight',
    'not_rice',
  ],
  inputSize: 224,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
  temperature: 1.0,
  thresholds: {
    high: 0.85,
    medium: 0.55,
    healthyHigh: 0.9,
    notRice: 0.5,
  },
  camOutput: false,
}

vi.mock('onnxruntime-web/wasm', () => {
  const sessionMock = {
    inputNames: ['input'],
    outputNames: ['logits'],
    run: vi.fn().mockImplementation(async (feeds: any) => {
      const tensor = feeds.input
      const batchSize = tensor?.dims?.[0] ?? 1
      const logits = new Float32Array(batchSize * 7)
      for (let b = 0; b < batchSize; b++) {
        // High logit for healthy (class 0)
        logits[b * 7] = 5.0
      }
      return {
        logits: { data: logits, dims: [batchSize, 7] },
      }
    }),
  }
  return {
    InferenceSession: {
      create: vi.fn().mockResolvedValue(sessionMock),
    },
    Tensor: class Tensor {
      type: string
      data: any
      dims: number[]
      constructor(type: string, data: any, dims: number[]) {
        this.type = type
        this.data = data
        this.dims = dims
      }
    },
    env: { wasm: {} },
  }
})

function makeLeaf(overrides: Partial<LeafScreening>): LeafScreening {
  return {
    id: 1,
    box: { x: 0, y: 0, w: 50, h: 50 },
    source: 'leaf_region',
    status: 'healthy',
    label: 'healthy',
    confidence: 0.95,
    tier: 'high',
    abstain: null,
    margin: 0.8,
    entropy: 0.1,
    pNotRice: 0.01,
    color: { greenRatio: 0.8, brownRatio: 0.1, greyRatio: 0.1, meanSaturation: 0.6 },
    ...overrides,
  }
}

describe('fieldRow - summarizeField', () => {
  it('summarizes empty field', () => {
    const summary = summarizeField([])
    expect(summary.totalRegions).toBe(0)
    expect(summary.screened).toBe(0)
    expect(summary.healthy).toBe(0)
    expect(summary.diseased).toBe(0)
    expect(summary.uncertain).toBe(0)
    expect(summary.abstained).toBe(0)
    expect(summary.diseasedShare).toBe(0)
    expect(summary.highestRisk).toBeNull()
    expect(summary.fieldAbstain).toBeNull()
  })

  it('summarizes mix of healthy, diseased, uncertain, and abstained leaves', () => {
    const leaves: LeafScreening[] = [
      makeLeaf({ id: 1, status: 'healthy', label: 'healthy', confidence: 0.92 }),
      makeLeaf({ id: 2, status: 'healthy', label: 'healthy', confidence: 0.88 }),
      makeLeaf({ id: 3, status: 'diseased', label: 'blast', confidence: 0.85 }),
      makeLeaf({ id: 4, status: 'diseased', label: 'blast', confidence: 0.91 }),
      makeLeaf({ id: 5, status: 'diseased', label: 'brown_spot', confidence: 0.95 }),
      makeLeaf({ id: 6, status: 'uncertain', label: 'tungro', confidence: 0.40 }),
      makeLeaf({ id: 7, status: 'abstained', label: null, abstain: 'dead_leaf' }),
      makeLeaf({ id: 8, status: 'abstained', label: null, abstain: 'unrelated_crop' }),
    ]

    const summary = summarizeField(leaves)
    expect(summary.totalRegions).toBe(8)
    expect(summary.screened).toBe(6) // healthy + diseased + uncertain
    expect(summary.healthy).toBe(2)
    expect(summary.diseased).toBe(3)
    expect(summary.uncertain).toBe(1)
    expect(summary.abstained).toBe(2)
    expect(summary.diseasedShare).toBeCloseTo(3 / 5, 2) // diseased / (healthy + diseased)

    // highestRisk: blast has count 2, brown_spot has count 1 -> blast wins
    expect(summary.highestRisk).toEqual({
      classId: 'blast',
      count: 2,
      maxConfidence: 0.91,
    })

    // healthy is never a key in byDisease
    expect(summary.byDisease).toEqual({
      blast: 2,
      brown_spot: 1,
    })

    expect(summary.abstainedByReason).toEqual({
      not_rice: 0,
      dead_leaf: 1,
      unrelated_crop: 1,
    })
    expect(summary.fieldAbstain).toBeNull()
  })

  it('tie-breaks highestRisk by higher maxConfidence', () => {
    const leaves: LeafScreening[] = [
      makeLeaf({ id: 1, status: 'diseased', label: 'blast', confidence: 0.80 }),
      makeLeaf({ id: 2, status: 'diseased', label: 'tungro', confidence: 0.92 }),
    ]

    const summary = summarizeField(leaves)
    expect(summary.highestRisk).toEqual({
      classId: 'tungro',
      count: 1,
      maxConfidence: 0.92,
    })
  })

  it('sets fieldAbstain to dominant abstain reason when all leaves are abstained', () => {
    const leaves: LeafScreening[] = [
      makeLeaf({ id: 1, status: 'abstained', label: null, abstain: 'dead_leaf' }),
      makeLeaf({ id: 2, status: 'abstained', label: null, abstain: 'unrelated_crop' }),
      makeLeaf({ id: 3, status: 'abstained', label: null, abstain: 'unrelated_crop' }),
    ]

    const summary = summarizeField(leaves)
    expect(summary.screened).toBe(0)
    expect(summary.fieldAbstain).toBe('unrelated_crop')
  })
})

describe('fieldRow - screenFieldRow', () => {
  beforeEach(() => {
    resetEngineState()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('model_meta.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => dummyMeta,
          }
        }
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new ArrayBuffer(10),
        }
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls onProgress 1..N and returns N leaves with proposed boxes', async () => {
    const width = 300
    const height = 200
    const data = new Uint8ClampedArray(width * height * 4)
    // Full canvas green -> grid_fallback creates 6 tiles
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 34
      data[i * 4 + 1] = 139
      data[i * 4 + 2] = 34
      data[i * 4 + 3] = 255
    }

    const progressReports: any[] = []
    const res = await screenFieldRow(
      { data, width, height },
      {
        onProgress: (p) => progressReports.push(p),
      },
    )

    expect(res.mode).toBe('grid_fallback')
    expect(res.leaves.length).toBe(6)
    expect(res.summary.totalRegions).toBe(6)
    expect(res.latencyMs).toBeGreaterThanOrEqual(0)

    // Verify progress reporting
    expect(progressReports[0]).toEqual({ stage: 'detecting', done: 0, total: 0 })
    const classifyingReports = progressReports.filter((p) => p.stage === 'classifying')
    expect(classifyingReports.length).toBe(6)
    expect(classifyingReports[0].done).toBe(1)
    expect(classifyingReports[5].done).toBe(6)
    expect(progressReports[progressReports.length - 1]).toEqual({
      stage: 'summarizing',
      done: 6,
      total: 6,
    })
  })

  it('respects AbortSignal and aborts immediately', async () => {
    const controller = new AbortController()
    controller.abort()

    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)

    await expect(
      screenFieldRow({ data, width, height }, { signal: controller.signal }),
    ).rejects.toThrow()
  })
})
