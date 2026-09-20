import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const calls = []
let responseBody
let ok = true
const source = fs.readFileSync(new URL('../src/api/http.ts', import.meta.url), 'utf8').replaceAll('import.meta.env', '{}')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const exports = {}
vm.runInNewContext(output, { exports, URL, window: { location: { origin: 'https://app.example' } }, fetch: async (url, init) => {
  calls.push({ url, init })
  return { ok, status: ok ? 200 : 409, json: async () => responseBody }
}})
const raw = {
  id: 'exp_real', generation: 1, parent_id: null, status: 'selected',
  genome: { topic: 'hackathons' }, agent_genome: { caption_length: 80, audio_strategy: 'original_sound' },
  prediction: { fitness: 0, confidence: null, model_version: 'xgboost' },
  mutations: [], hypothesis: 'test', content: { headline: 'Real concept', media_url: '/media/exp_real.jpg' },
  deployment: { platform: 'instagram', timestamp: null, post_id: null },
  observed: { views: null, likes: null, comments: null, shares: null, saves: null, fitness: null },
  timeseries: [{ timestamp: '2026-09-19T13:00:00Z', views: 100, likes: null, shares: 0 }],
}
const experiment = exports.normalizeExperiment(raw)
assert.equal(experiment.prediction.fitness, 0)
assert.ok(Number.isNaN(experiment.prediction.confidence))
assert.equal(experiment.observed.timeseries[0].shares, 0)
assert.equal(experiment.observed.timeseries[0].likes, null)
assert.equal(experiment.genome.caption_length, 80)
assert.equal(experiment.content.media_url, 'https://app.example/media/exp_real.jpg')
assert.equal(exports.normalizeExperiment({ ...raw, content: { media_url: '' } }).content.media_url, '')
responseBody = [raw]
const candidates = await exports.generateCandidates({ count: 5, platform: 'instagram', topic: 'hackathons', riskAppetite: .2 })
assert.equal(candidates.length, 1)
assert.equal(JSON.parse(calls.at(-1).init.body).riskAppetite, .2)
responseBody = { fitness: null }
await exports.fetchLiveMetrics(raw.id)
assert.equal(calls.at(-1).init.method, 'POST')
await exports.evolve(raw.id)
assert.deepEqual(JSON.parse(calls.at(-1).init.body), { experiment_id: raw.id })
await exports.publishPost(raw.id)
assert.deepEqual(JSON.parse(calls.at(-1).init.body), { platform: 'instagram' })
ok = false
responseBody = { detail: 'Instagram token expired' }
await assert.rejects(exports.publishPost(raw.id), /Instagram token expired/)
console.log('Frontend contract checks passed: zero scores, unknown metrics, history, media origin, generation, publish, observation and errors.')
