import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
async function load(entry) {
  const result = await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    alias: { '@': path.join(root, 'src') },
    define: {
      'import.meta.env': JSON.stringify({ VITE_USE_MOCK: 'false', DEV: false }),
      'process.env.NODE_ENV': '"test"',
    },
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
  )
}

const { fitnessText, measuredMetrics, isVideo } = await load('src/lib/evidence.ts')
assert.equal(fitnessText(0), '0.0000')
assert.equal(fitnessText(Number.NaN), 'Not available')
assert.equal(measuredMetrics(null), null)
const metrics = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
assert.deepEqual(measuredMetrics(metrics), metrics)
assert.equal(measuredMetrics({ ...metrics, saves: null }), null)
assert.equal(measuredMetrics({ ...metrics, likes: Infinity }), null)
assert.ok(isVideo('https://example.test/movie.mp4?token=demo'))
console.log('PASS missing values, real zeros, complete measurements, video recognition')

const http = await load('src/api/http.ts')
const raw = {
  id: 'test',
  generation: 1,
  parent_id: null,
  genome: { topic: 'test', format: 'pov' },
  mutations: [],
  hypothesis: '',
  prediction: null,
  content: {},
  deployment: { platform: null, timestamp: null, post_id: null },
  observed: { ...Object.fromEntries(Object.keys(metrics).map((k) => [k, null])), fitness: null },
}
const normalized = http.normalizeExperiment(raw)
assert.ok(Number.isNaN(normalized.prediction.fitness))
assert.ok(Number.isNaN(normalized.prediction.confidence))
assert.equal(normalized.content.media_url, '')
assert.equal(
  http.normalizeExperiment({ ...raw, observed: { ...raw.observed, fitness: 0.1 } }).status,
  'pending',
)
assert.equal(http.mediaUrl('/specimens/exp_000.svg'), '')
assert.equal(http.mediaUrl('/media/test.mp4'), 'http://127.0.0.1:8000/media/test.mp4')
assert.equal(http.mediaUrl('javascript:alert(1)'), '')
console.log(
  'PASS live normalization does not invent prediction, confidence, winner, or generated media',
)

let requests = []
globalThis.fetch = async (url, init) => {
  requests.push({ url, method: init?.method ?? 'GET', body: init?.body && JSON.parse(init.body) })
  return new Response(JSON.stringify(raw), { status: 200 })
}
await http.deployExperiment('test', 'tiktok')
assert.deepEqual(
  requests.map((r) => r.method),
  ['GET'],
)
assert.ok(!JSON.stringify(requests).includes('pending_test'))
requests = []
await http.commitCandidate({
  ...normalized,
  prediction: {
    fitness: 0,
    confidence: Number.NaN,
    feature_attribution: [],
    model_version: 'verified-test-model',
  },
})
const attached = requests.find((r) => r.url.endsWith('/prediction'))
assert.equal(attached.body.fitness, 0)
assert.equal(attached.body.model_version, 'verified-test-model')
console.log(
  'PASS preparation does not fabricate deployment; zero prediction and provenance survive saving',
)

const { useStore } = await load('src/store/useStore.ts')
useStore.getState().setLab({ posted: normalized, live: null, hours: 24 })
requests = []
await useStore.getState().finish()
assert.equal(requests.length, 0)
assert.match(useStore.getState().lab.error, /Awaiting complete engagement/)
useStore.getState().setLab({ live: { ...metrics, saves: null } })
await useStore.getState().finish()
assert.equal(requests.length, 0)
console.log(
  'PASS live learning cannot submit simulated engagement or replace missing measurements with zero',
)

console.log('All frontend evidence regression checks passed.')
