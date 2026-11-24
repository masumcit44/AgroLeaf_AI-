import { decideAbstention, entropyAndMargin } from './abstain'
import type { DiseaseClassId } from './classes'
import { decideTier } from './decideTier'
import { loadModel, runLogits } from './engine'
import type {
  AbstentionReason,
  FieldRowOptions,
  FieldRowResult,
  FieldSummary,
  LeafBox,
  LeafScreening,
  LeafStatus,
  ScreenFieldRow,
} from './fieldRow.types'
import { computeColorStats, extractPixelData } from './leafColor'
import { proposeLeafRegions } from './leafRegions'
import { preprocess, type PreprocessImageInput } from './preprocess'
import { softmax } from './softmax'
import type { ClassProb } from './types'

/**
 * Crops a subregion from RGBA pixel buffer into an ImageData-like object.
 */
function cropBox(
  srcData: ArrayLike<number>,
  srcW: number,
  box: LeafBox,
): { data: Uint8ClampedArray; width: number; height: number } {
  const cropData = new Uint8ClampedArray(box.w * box.h * 4)
  for (let cy = 0; cy < box.h; cy++) {
    for (let cx = 0; cx < box.w; cx++) {
      const srcIdx = ((box.y + cy) * srcW + (box.x + cx)) * 4
      const dstIdx = (cy * box.w + cx) * 4
      cropData[dstIdx] = srcData[srcIdx]
      cropData[dstIdx + 1] = srcData[srcIdx + 1]
      cropData[dstIdx + 2] = srcData[srcIdx + 2]
      cropData[dstIdx + 3] = srcData[srcIdx + 3]
    }
  }
  return { data: cropData, width: box.w, height: box.h }
}

/**
 * Summarizes the screened leaves across a whole field row.
 * Pure function; calculates counts, proportions, highest risk disease, and abstention reasons.
 */
export function summarizeField(leaves: LeafScreening[]): FieldSummary {
  const totalRegions = leaves.length
  let healthy = 0
  let diseased = 0
  let uncertain = 0
  let abstained = 0

  const byDisease: Partial<Record<DiseaseClassId, number>> = {}
  const diseaseMaxConf: Partial<Record<DiseaseClassId, number>> = {}
  const abstainedByReason: Record<AbstentionReason, number> = {
    not_rice: 0,
    dead_leaf: 0,
    unrelated_crop: 0,
  }

  for (const leaf of leaves) {
    if (leaf.status === 'healthy') {
      healthy++
    } else if (leaf.status === 'diseased') {
      diseased++
      if (leaf.label && leaf.label !== 'healthy') {
        byDisease[leaf.label] = (byDisease[leaf.label] ?? 0) + 1
        diseaseMaxConf[leaf.label] = Math.max(
          diseaseMaxConf[leaf.label] ?? 0,
          leaf.confidence,
        )
      }
    } else if (leaf.status === 'uncertain') {
      uncertain++
    } else if (leaf.status === 'abstained') {
      abstained++
      if (leaf.abstain) {
        abstainedByReason[leaf.abstain] = (abstainedByReason[leaf.abstain] ?? 0) + 1
      }
    }
  }

  const screened = healthy + diseased + uncertain

  // Highest risk disease: most diseased leaves; tie-break by higher maxConfidence
  let highestRisk: {
    classId: DiseaseClassId
    count: number
    maxConfidence: number
  } | null = null

  const diseaseEntries = Object.entries(byDisease) as [DiseaseClassId, number][]
  if (diseaseEntries.length > 0) {
    diseaseEntries.sort(([classA, countA], [classB, countB]) => {
      if (countB !== countA) {
        return countB - countA
      }
      return (diseaseMaxConf[classB] ?? 0) - (diseaseMaxConf[classA] ?? 0)
    })

    const [topClass, topCount] = diseaseEntries[0]
    highestRisk = {
      classId: topClass,
      count: topCount,
      maxConfidence: diseaseMaxConf[topClass] ?? 0,
    }
  }

  const diseasedShare = healthy + diseased > 0 ? diseased / (healthy + diseased) : 0

  // Field abstention: when NO leaf was screenable, pick the dominant abstain reason
  let fieldAbstain: AbstentionReason | null = null
  if (screened === 0 && totalRegions > 0) {
    const reasons = Object.entries(abstainedByReason) as [AbstentionReason, number][]
    reasons.sort((a, b) => b[1] - a[1])
    if (reasons[0][1] > 0) {
      fieldAbstain = reasons[0][0]
    }
  }

  return {
    totalRegions,
    screened,
    healthy,
    diseased,
    uncertain,
    abstained,
    byDisease,
    abstainedByReason,
    highestRisk,
    diseasedShare,
    fieldAbstain,
  }
}

/**
 * Screen a full field-row image by proposing leaf regions and screening each with ONNX runtime.
 */
export const screenFieldRow: ScreenFieldRow = async (
  image: PreprocessImageInput,
  opts?: FieldRowOptions,
): Promise<FieldRowResult> => {
  if (opts?.signal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  const startTime = performance.now()
  const meta = await loadModel()

  // 1. Extract image pixel buffer
  const { data, width, height } = extractPixelData(image)

  if (opts?.signal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  // 2. Propose leaf regions
  opts?.onProgress?.({ stage: 'detecting', done: 0, total: 0 })
  const { boxes, mode } = proposeLeafRegions(
    { data, width, height },
    { maxRegions: opts?.maxRegions },
  )

  const n = boxes.length
  if (n === 0) {
    const emptySummary = summarizeField([])
    return {
      imageWidth: width,
      imageHeight: height,
      mode,
      leaves: [],
      summary: emptySummary,
      modelVersion: meta.version,
      latencyMs: Math.max(0, Math.round(performance.now() - startTime)),
    }
  }

  // 3. Preprocess and prepare batch tensor data
  const sampleSize = 3 * meta.inputSize * meta.inputSize
  const batchedTensorData = new Float32Array(n * sampleSize)
  const cropsColorStats = []

  for (let i = 0; i < n; i++) {
    const box = boxes[i]
    const crop = cropBox(data, width, box)
    const tensor = preprocess(crop, meta)
    batchedTensorData.set(tensor, i * sampleSize)
    cropsColorStats.push(computeColorStats(data, width, height, box))
  }

  if (opts?.signal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  // 4. Run real inference through runLogits
  const allLogits = await runLogits(batchedTensorData, n)

  // 5. Evaluate each leaf screening
  const leaves: LeafScreening[] = []

  for (let i = 0; i < n; i++) {
    if (opts?.signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    const box = boxes[i]
    const color = cropsColorStats[i]
    const logits = allLogits[i]
    const probs = softmax(logits, meta.temperature)

    const diseases: { classId: DiseaseClassId; prob: number }[] = []
    let notRiceEntry: ClassProb | null = null

    for (let c = 0; c < meta.classes.length; c++) {
      const classId = meta.classes[c]
      const prob = probs[c] ?? 0
      if (classId === 'not_rice') {
        notRiceEntry = { classId, prob }
      } else {
        diseases.push({ classId: classId as DiseaseClassId, prob })
      }
    }

    diseases.sort((a, b) => b.prob - a.prob)
    const top: ClassProb[] = notRiceEntry ? [...diseases, notRiceEntry] : diseases
    const top1Disease = diseases[0] as { classId: DiseaseClassId; prob: number } | undefined

    const tier = decideTier(top, meta)
    const abstain = decideAbstention({ probs: top, color, meta })
    const { entropy, margin } = entropyAndMargin(top)
    const pNotRice = notRiceEntry?.prob ?? 0

    // Determine status per contract
    let status: LeafStatus
    let label: DiseaseClassId | null = null

    if (abstain !== null) {
      status = 'abstained'
      label = null
    } else if (tier === 'low') {
      status = 'uncertain'
      label = top1Disease?.classId ?? null
    } else if (top1Disease?.classId === 'healthy') {
      status = 'healthy'
      label = 'healthy'
    } else {
      status = 'diseased'
      label = top1Disease?.classId ?? null
    }

    const confidence = top1Disease?.prob ?? 0

    leaves.push({
      id: i + 1,
      box,
      source: mode === 'leaf_regions' ? 'leaf_region' : 'grid_tile',
      status,
      label,
      confidence,
      tier,
      abstain,
      margin,
      entropy,
      pNotRice,
      color,
    })

    opts?.onProgress?.({ stage: 'classifying', done: i + 1, total: n })

    // Yield control to UI thread
    await new Promise((r) => setTimeout(r, 0))
  }

  // 6. Summarize results
  opts?.onProgress?.({ stage: 'summarizing', done: n, total: n })
  const summary = summarizeField(leaves)
  const latencyMs = Math.max(0, Math.round(performance.now() - startTime))

  return {
    imageWidth: width,
    imageHeight: height,
    mode,
    leaves,
    summary,
    modelVersion: meta.version,
    latencyMs,
  }
}
