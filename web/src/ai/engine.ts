import * as ort from 'onnxruntime-web/wasm'
import { decideAbstention } from './abstain'
import { decideTier } from './decideTier'
import type { AbstentionReason } from './fieldRow.types'
import { computeColorStats, extractPixelData } from './leafColor'
import { preprocess, type PreprocessImageInput } from './preprocess'
import { softmax } from './softmax'
import type { ClassProb, ModelMeta, Prediction } from './types'

const LOAD_TIMEOUT_MS = 60_000

let loadingPromise: Promise<ModelMeta> | null = null
let cachedMeta: ModelMeta | null = null
let cachedSession: ort.InferenceSession | null = null
let fixedBatch1: boolean | null = null

/** Reset internal cache for test environments. */
export function resetEngineState(): void {
  loadingPromise = null
  cachedMeta = null
  cachedSession = null
  fixedBatch1 = null
}

/**
 * Loads the model metadata and initializes the ONNX InferenceSession.
 * Cached via loadingPromise so concurrent calls create exactly one session.
 * Rejects with a timeout error if loading exceeds 60s.
 */
export function loadModel(): Promise<ModelMeta> {
  if (cachedMeta && cachedSession) {
    return Promise.resolve(cachedMeta)
  }
  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let isTimedOut = false

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        isTimedOut = true
        reject(new Error('মডেল লোড করা যায়নি: সময় শেষ'))
      }, LOAD_TIMEOUT_MS)
    })

    const doLoad = async (): Promise<ModelMeta> => {
      const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const metaUrl = `${baseUrl}/model/model_meta.json`
      const modelUrl = `${baseUrl}/model/agroleaf.onnx`

      let meta: ModelMeta
      try {
        const res = await fetch(metaUrl)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        meta = (await res.json()) as ModelMeta
      } catch (err) {
        throw new Error(
          `মডেল লোড করা যায়নি: মেটাডাটা পাওয়া যায়নি (${err instanceof Error ? err.message : String(err)})`,
        )
      }

      let modelInput: string | Uint8Array = modelUrl
      try {
        const modelRes = await fetch(modelUrl)
        if (modelRes.ok) {
          const buf = await modelRes.arrayBuffer()
          modelInput = new Uint8Array(buf)
        }
      } catch {
        // Keep string modelUrl fallback for mocked test environments
      }

      try {
        ort.env.wasm.numThreads = 1
        const session = await ort.InferenceSession.create(modelInput as any, {
          executionProviders: ['wasm'],
        })
        if (isTimedOut) {
          return meta
        }
        cachedSession = session
        cachedMeta = meta
        return meta
      } catch (err) {
        throw new Error(
          `মডেল লোড করা যায়নি: অনিক্স সেশন প্রস্তুত ব্যর্থ (${err instanceof Error ? err.message : String(err)})`,
        )
      }
    }

    try {
      return await Promise.race([doLoad(), timeoutPromise])
    } catch (err) {
      // Clear cache on failure so next call retries
      loadingPromise = null
      cachedMeta = null
      cachedSession = null
      throw err
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }
  })()

  return loadingPromise
}

/**
 * Runs inference on batched NCHW tensor data [n, 3, 224, 224], returning logits for each sample.
 * Reuses the cached session and automatically handles fixed batch 1 graphs by falling back sequentially.
 */
export async function runLogits(
  tensorData: Float32Array,
  n: number,
): Promise<Float32Array[]> {
  const meta = await loadModel()
  const session = cachedSession!
  const inputName = session.inputNames[0] ?? 'input'
  const logitsName = session.outputNames[0] ?? 'logits'
  const numClasses = meta.classes.length

  if (n <= 0) return []

  // Try batched inference if fixedBatch1 is not known to be true
  if (fixedBatch1 !== true && n > 1) {
    try {
      const batchedTensor = new ort.Tensor('float32', tensorData, [
        n,
        3,
        meta.inputSize,
        meta.inputSize,
      ])
      const out = await session.run({ [inputName]: batchedTensor })
      const outLogits = out[logitsName].data as Float32Array
      fixedBatch1 = false
      const results: Float32Array[] = []
      for (let i = 0; i < n; i++) {
        results.push(outLogits.subarray(i * numClasses, (i + 1) * numClasses))
      }
      return results
    } catch {
      fixedBatch1 = true
    }
  }

  // Sequential execution
  const sampleSize = 3 * meta.inputSize * meta.inputSize
  const results: Float32Array[] = []
  for (let i = 0; i < n; i++) {
    const slice = tensorData.subarray(i * sampleSize, (i + 1) * sampleSize)
    const singleTensor = new ort.Tensor('float32', slice, [
      1,
      3,
      meta.inputSize,
      meta.inputSize,
    ])
    const out = await session.run({ [inputName]: singleTensor })
    results.push(out[logitsName].data as Float32Array)
  }
  return results
}

/**
 * Runs browser inference on the provided image and returns a calibrated Prediction.
 */
export async function analyze(
  image: PreprocessImageInput,
): Promise<Prediction> {
  const meta = await loadModel()
  const session = cachedSession!

  const startTime = performance.now()

  // 1. Preprocess image into Float32 NCHW tensor
  const tensorData = preprocess(image, meta)
  const inputTensor = new ort.Tensor('float32', tensorData, [
    1,
    3,
    meta.inputSize,
    meta.inputSize,
  ])

  // 2. Run session
  const inputName = session.inputNames[0] ?? 'input'
  const feeds = { [inputName]: inputTensor }
  const outputs = await session.run(feeds)

  // 3. Extract logits & scale with temperature
  const logitsName = session.outputNames[0] ?? 'logits'
  const logitsTensor = outputs[logitsName]
  const logits = logitsTensor.data as Float32Array
  const probs = softmax(logits, meta.temperature)

  // 4. Map to classes: diseases sorted desc, then not_rice (if present) appended last
  const diseases: ClassProb[] = []
  let notRiceEntry: ClassProb | null = null

  for (let i = 0; i < meta.classes.length; i++) {
    const classId = meta.classes[i]
    const prob = probs[i] ?? 0
    if (classId === 'not_rice') {
      notRiceEntry = { classId, prob }
    } else {
      diseases.push({ classId, prob })
    }
  }

  diseases.sort((a, b) => b.prob - a.prob)

  const top: ClassProb[] = notRiceEntry ? [...diseases, notRiceEntry] : diseases

  // 5. Determine tier & evaluate honest abstention
  let tier = decideTier(top, meta)
  let abstain: AbstentionReason | undefined

  try {
    const rawPixels = extractPixelData(image)
    const color = computeColorStats(rawPixels.data, rawPixels.width, rawPixels.height)
    const abstention = decideAbstention({ probs: top, color, meta })
    if (abstention === 'dead_leaf' || abstention === 'unrelated_crop') {
      tier = 'not_rice'
      abstain = abstention
    } else if (tier === 'not_rice' || abstention === 'not_rice') {
      abstain = 'not_rice'
    }
  } catch {
    // If pixel extraction fails, maintain standard tier evaluation
  }

  // 6. Handle optional Class Activation Map (CAM) heatmap
  let heatmap: Float32Array | undefined
  let heatmapSize: number | undefined

  if (meta.camOutput && session.outputNames.length > 1) {
    const camName = session.outputNames[1]
    const camTensor = outputs[camName]
    if (camTensor && camTensor.data) {
      const camData = camTensor.data as Float32Array
      // Take channel of top-1 class in meta.classes order
      const top1ClassId = top[0]?.classId
      const top1Idx =
        top1ClassId !== undefined ? meta.classes.indexOf(top1ClassId) : 0

      const dims = camTensor.dims
      const w = dims ? dims[dims.length - 1] : 7
      const h = dims ? dims[dims.length - 2] : w
      const channelArea = h * w

      const start = (top1Idx >= 0 ? top1Idx : 0) * channelArea
      const end = start + channelArea
      const channelSlice = camData.subarray(start, end)

      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < channelSlice.length; i++) {
        const val = channelSlice[i]
        if (val < min) min = val
        if (val > max) max = val
      }

      heatmap = new Float32Array(channelSlice.length)
      if (max > min) {
        const range = max - min
        for (let i = 0; i < channelSlice.length; i++) {
          heatmap[i] = (channelSlice[i] - min) / range
        }
      } else {
        // all-equal map -> zeros
        heatmap.fill(0)
      }
      heatmapSize = w
    }
  }

  const latencyMs = Math.max(0, Math.round(performance.now() - startTime))

  return {
    tier,
    top,
    modelVersion: meta.version,
    trainedFromScratch: meta.trainedFromScratch,
    latencyMs,
    ...(abstain ? { abstain } : {}),
    ...(meta.camOutput && heatmap ? { heatmap, heatmapSize } : {}),
  }
}
