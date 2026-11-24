/// <reference types="node" />
// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runLogits, resetEngineState } from './engine'

const webRoot = resolve(__dirname, '../..')
const modelPath = join(webRoot, 'public', 'model', 'agroleaf.onnx')
const fixturePath = join(__dirname, '__fixtures__', 'model_parity.json')
const metaPath = join(webRoot, 'public', 'model', 'model_meta.json')

interface Case {
  name: string
  input: string
  logits: number[]
  camShape: number[]
}

function f32(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64')
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
}

describe.runIf(existsSync(modelPath) && existsSync(fixturePath))(
  'fieldRow / engine runLogits parity',
  () => {
    it(
      'runs runLogits on 2 fixture inputs batched and equals single-image logits within 1e-4',
      async () => {
        resetEngineState()
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        const fx = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
          atol: number
          cases: Case[]
        }

        // Mock fetch for loadModel in Node environment
        const originalFetch = globalThis.fetch
        globalThis.fetch = async (url: any) => {
          const urlStr = String(url)
          if (urlStr.endsWith('model_meta.json')) {
            return {
              ok: true,
              status: 200,
              json: async () => meta,
            } as any
          }
          if (urlStr.endsWith('agroleaf.onnx')) {
            const bytes = readFileSync(modelPath)
            return {
              ok: true,
              status: 200,
              arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
            } as any
          }
          return originalFetch(url)
        }

        try {
          const case0 = fx.cases[0]
          const case1 = fx.cases[1]
          const input0 = f32(case0.input)
          const input1 = f32(case1.input)

          const sampleLen = input0.length
          const batched = new Float32Array(sampleLen * 2)
          batched.set(input0, 0)
          batched.set(input1, sampleLen)

          const [singleLogits0] = await runLogits(input0, 1)
          const [singleLogits1] = await runLogits(input1, 1)

          const batchedLogits = await runLogits(batched, 2)
          expect(batchedLogits).toHaveLength(2)

          const probs = (v: ArrayLike<number>) => {
            const m = Math.max(...Array.from(v))
            const e = Array.from(v, (z) => Math.exp(z - m))
            const s = e.reduce((a, b) => a + b, 0)
            return e.map((z) => z / s)
          }

          // Case 0 comparison
          const pBatch0 = probs(batchedLogits[0])
          const pSingle0 = probs(singleLogits0)
          for (let i = 0; i < pBatch0.length; i++) {
            expect(Math.abs(pBatch0[i] - pSingle0[i])).toBeLessThanOrEqual(1e-4)
          }

          // Case 1 comparison
          const pBatch1 = probs(batchedLogits[1])
          const pSingle1 = probs(singleLogits1)
          for (let i = 0; i < pBatch1.length; i++) {
            expect(Math.abs(pBatch1[i] - pSingle1[i])).toBeLessThanOrEqual(1e-4)
          }
        } finally {
          globalThis.fetch = originalFetch
        }
      },
      60_000,
    )
  },
)
