import type { ClassId } from './classes'
import type { AbstentionReason } from './fieldRow.types'

/**
 * CONTRACT between the AI engine (Masum, src/ai/) and the UI (Tanjil) and content (Mehedi).
 * Do not change field names without a PR reviewed by all three members.
 */

/** Contents of public/model/model_meta.json (written by ml/export.py). */
export interface ModelMeta {
  version: string                 // e.g. "v1-mnv3s-scratch"
  architecture: string            // e.g. "MobileNetV3-Small (random init)"
  trainedFromScratch: boolean     // false => UI must show "Temporary Prototype — Pretrained Model"
  classes: ClassId[]              // order = model output order
  inputSize: number               // 224
  mean: [number, number, number]  // normalisation used in training
  std: [number, number, number]
  temperature: number             // temperature scaling T (logits / T)
  thresholds: {
    high: number                  // top-1 calibrated prob >= high  => tier "high"
    medium: number                // top-1 >= medium               => tier "medium"; else "low"
    healthyHigh: number           // stricter bar before saying "healthy"
    notRice: number               // p(not_rice) >= this => tier "not_rice"
  }
  camOutput: boolean              // true if the ONNX graph has a second output with class activation maps
}

export type ConfidenceTier = 'high' | 'medium' | 'low' | 'not_rice'

export interface ClassProb {
  classId: ClassId
  prob: number                    // calibrated probability, 0..1
}

/** Image quality check (T3, Tanjil). Pure function of pixels; warnings never block analysis. */
export interface QualityReport {
  brightness: number              // mean luma 0..255
  sharpness: number               // variance of Laplacian
  tooDark: boolean
  tooBright: boolean
  tooBlurry: boolean
}

/** Contents of public/model/report.json (written by ml/evaluate.py, M5). Read by the Accuracy page (F12). */
export interface ModelReport {
  modelVersion: string            // must equal ModelMeta.version
  createdAt: string               // ISO date
  dataset: {
    name: string                  // "RiceLeafDiseaseBD v3"
    url: string
    license: string               // "CC BY 4.0"
    images: { train: number; val: number; test: number }
  }
  test: {
    n: number
    accuracy: number              // 0..1
    macroF1: number               // 0..1
    perClass: { classId: ClassId; precision: number; recall: number; f1: number; support: number }[]
    /** rows = true class, cols = predicted class, both in `classes` order */
    confusionMatrix: number[][]
    classes: ClassId[]
  }
  calibration: { temperature: number; eceBefore: number; eceAfter: number }
  /** share of test photos that land in each tier, and how often the top-1 answer was right there */
  tiers: { tier: ConfidenceTier; coverage: number; accuracy: number }[]
  limitations: { bn: string; en: string }[]
  notRice?: {
    threshold: number
    blendConfidenceCap?: number
    rule?: string
    notRiceValRejected: number
    notRiceTestRejected: number
    riceValFalseReject: number
    riceTestFalseReject: number
    macroF1SixClassBase: number
    macroF1SixClassWithGate: number
    sources: { name: string; licence: string; url: string }[]
    split?: { train: number; val: number; test: number }
    bd5GateOnly?: {
      note: string
      testFalseReject: number
      split?: { train: number; val: number; test: number }
    }
    screenRecapture?: {
      riceFalseReject: number
      notRiceRejected: number
      macroF1SixClassWithGate: number
    }
  }
}

/** What analyze() returns. The UI renders ONLY from this object. */
export interface Prediction {
  tier: ConfidenceTier
  top: ClassProb[]                // diseases sorted desc; not_rice (if the model has it) is always last
  /** Heat map for top-1 class, values 0..1, row-major, size heatmapSize x heatmapSize. Absent if camOutput=false. */
  heatmap?: Float32Array
  heatmapSize?: number
  modelVersion: string
  trainedFromScratch: boolean
  latencyMs: number
  abstain?: AbstentionReason
}
