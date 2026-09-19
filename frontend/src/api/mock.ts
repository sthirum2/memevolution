// ─────────────────────────────────────────────────────────────────────────────
// MOCK BACKEND
// A working fake of the whole system so the frontend can be demoed, filmed and
// judged with no Python running. It holds mutable session state: generating,
// deploying, recording metrics and evolving genuinely change what the tree and
// the belief chart show, and a page refresh resets it.
//
// The scoring here is a real (tiny) model: a candidate is scored by how closely
// its genome aligns with the agent's current beliefs, weighted by confidence.
// That keeps the Lab's predictions consistent with the Agent's Mind view — the
// numbers on screen always agree with each other.
// ─────────────────────────────────────────────────────────────────────────────
import rawExperiments from '@/data/experiments.json'
import rawAgentStates from '@/data/agentStates.json'
import rawCorpus from '@/data/corpus.json'
import type {
  AgentState,
  CorpusStats,
  EvolveResult,
  Experiment,
  GenerateParams,
  GenerationSummary,
  LiveMetrics,
  MetricsInput,
  Platform,
  PublishRequest,
  PublishResult,
  SelectionResult,
} from '@/types'
import { clamp, delta, fit } from '@/lib/format'
import { spreadScore } from '@/lib/score'

const LATENCY = { fast: 120, normal: 300, think: 620 }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/**
 * The fixture timestamps are baked into JSON, but "now" moves. Rebase the whole
 * run onto the current clock so the tree never claims a post went live in the
 * future: finished experiments end two days ago, and whatever is still
 * `deployed` went up six hours ago and is genuinely mid-flight.
 */
const HOUR_MS = 3_600_000
function rebaseClock(rows: Experiment[]): Experiment[] {
  const stamped = rows.filter((e) => e.deployment.timestamp)
  if (!stamped.length) return rows
  const times = stamped.map((e) => new Date(e.deployment.timestamp as string).getTime())
  const last = Math.max(...times)
  const shift = Date.now() - 2 * 24 * HOUR_MS - last

  for (const e of rows) {
    if (e.deployment.timestamp) {
      e.deployment.timestamp = new Date(
        new Date(e.deployment.timestamp).getTime() + shift,
      ).toISOString()
    }
    e.observed.timeseries = e.observed.timeseries.map((pt) => ({
      ...pt,
      t: new Date(new Date(pt.t).getTime() + shift).toISOString(),
    }))
  }

  // Anything still live is six hours old, measured from right now.
  for (const e of rows) {
    if (e.status !== 'deployed' || !e.deployment.timestamp) continue
    const start = Date.now() - 6 * HOUR_MS
    const span = e.observed.timeseries.length
      ? new Date(e.observed.timeseries[span_end(e)].t).getTime() -
        new Date(e.observed.timeseries[0].t).getTime()
      : 0
    e.deployment.timestamp = new Date(start).toISOString()
    if (span > 0) {
      const t0 = new Date(e.observed.timeseries[0].t).getTime()
      e.observed.timeseries = e.observed.timeseries.map((pt) => ({
        ...pt,
        t: new Date(start + (new Date(pt.t).getTime() - t0)).toISOString(),
      }))
    }
  }
  return rows
}
const span_end = (e: Experiment) => e.observed.timeseries.length - 1

let experiments: Experiment[] = rebaseClock(clone(rawExperiments as Experiment[]))
let agentStates: AgentState[] = clone(rawAgentStates as AgentState[])

export function __resetMock() {
  experiments = rebaseClock(clone(rawExperiments as Experiment[]))
  agentStates = clone(rawAgentStates as AgentState[])
}

const latestState = () => agentStates[agentStates.length - 1]

// ── The tiny model ──────────────────────────────────────────────────────────
type BeliefKey =
  | 'absurdity'
  | 'irony'
  | 'relatability'
  | 'trend_relevance'
  | 'text_density'
  | 'short_video'
  | 'trending_audio'
  | 'short_caption'

/** Project a genome into the same space the agent holds beliefs in. */
function project(g: Experiment['genome']): Record<BeliefKey, number> {
  return {
    absurdity: g.absurdity,
    irony: g.irony,
    relatability: g.relatability,
    trend_relevance: g.trend_relevance,
    text_density: g.text_density,
    short_video: clamp(1 - g.video_length / 20),
    trending_audio: g.audio_strategy === 'trending' ? 0.95 : 0.15,
    short_caption: clamp(1 - g.caption_length / 30),
  }
}

const FORMAT_BONUS: Record<string, number> = {
  speedrun: 0.07,
  pov: 0.03,
  group_chat: 0.0,
  mockumentary: -0.02,
  talking_head: -0.05,
  explainer: -0.05,
  vlog: -0.08,
}

function scoreGenome(g: Experiment['genome'], state: AgentState) {
  const p = project(g)
  const keys = Object.keys(p) as BeliefKey[]
  let weighted = 0
  let weight = 0
  const contributions: { feature: string; contribution: number }[] = []

  for (const k of keys) {
    const belief = state.beliefs[k] ?? 0.5
    const conf = state.confidence[k] ?? 0.4
    const align = 1 - Math.abs(p[k] - belief) // 0..1
    weighted += align * conf
    weight += conf
    contributions.push({
      feature: k,
      // Centred at .82, not .72: with the lower centre every trait of a decent
      // genome scored positive and the diverging chart never diverged.
      contribution: Math.round((align - 0.82) * conf * 1.1 * 100) / 100,
    })
  }

  const alignment = weight === 0 ? 0.5 : weighted / weight
  const fb = FORMAT_BONUS[g.format] ?? 0
  if (fb !== 0)
    contributions.push({ feature: `format_${g.format}`, contribution: Math.round(fb * 100) / 100 })

  // Ceiling of .88: nothing above .91 has ever actually been observed, so the
  // model has no business predicting near-certainty for an untested genome.
  const fitness = clamp(0.22 + alignment * 0.58 + fb, 0.05, 0.88)
  // Confidence tracks how well-trodden this region of genome space is.
  const confidence = clamp(0.35 + alignment * 0.5, 0.2, 0.92)

  const feature_attribution = contributions
    .filter((c) => Math.abs(c.contribution) >= 0.01)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 5)

  return {
    fitness: Math.round(fitness * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    feature_attribution,
  }
}

// ── Candidate concept pool ──────────────────────────────────────────────────
// Hand-authored so generated candidates never read as lorem ipsum on stage.
interface Concept {
  trait: BeliefKey | 'format' | 'hook' | 'humor' | 'audio_strategy' | 'topic'
  intent: string
  headline: string
  visual: string
  punch: string
  caption: string
  audio: string
  patch: Partial<Experiment['genome']>
}

const CONCEPTS: Record<Platform, Concept[]> = {
  tiktok: [
    {
      trait: 'absurdity',
      intent: 'push absurdity past the current plateau',
      headline: 'the meal plan speedrun, hardcore mode',
      visual: 'Cold open on a swipe counter at 1. Timer. Runner attempts to make it to May.',
      punch: 'PERMADEATH — 0 swipes, 3 weeks left',
      caption: 'hardcore is a choice',
      audio: 'trending — speedrun timer sting',
      patch: { absurdity: 0.93, video_length: 6, format: 'speedrun' },
    },
    {
      trait: 'short_video',
      intent: 'cut below five seconds and test the floor',
      headline: 'shuttle bus speedrun, frame-perfect',
      visual: 'Four seconds. Doors closing. Runner makes it. Timer stops mid-stride.',
      punch: 'FRAME PERFECT',
      caption: 'one frame',
      audio: 'trending — speedrun timer sting',
      patch: { video_length: 4, caption_length: 5, absurdity: 0.82, format: 'speedrun' },
    },
    {
      trait: 'format',
      intent: 'swap the borrowed frame from speedrun to tier list',
      headline: 'ranking every campus building by how much it wants you dead',
      visual:
        'Tier list drag-and-drop. S tier is one building nobody expects. F tier is the new one.',
      punch: 'the library annex is in its own tier below F',
      caption: 'this is objective',
      audio: 'trending — tier list bed',
      patch: { format: 'tier_list', absurdity: 0.8, video_length: 11, caption_length: 10 },
    },
    {
      trait: 'relatability',
      intent: 'widen the shared antagonist from one campus to all of them',
      headline: 'the group project free-rider, documented',
      visual: 'Cold open on a commit history. One name. Four collaborators listed on the slide.',
      punch: 'CONTRIBUTIONS: 1 message, "looks good"',
      caption: 'we all know one',
      audio: 'trending — speedrun timer sting',
      patch: { relatability: 0.93, absurdity: 0.79, video_length: 7 },
    },
    {
      trait: 'hook',
      intent: 'test a mid-sentence cold open with no context whatsoever',
      headline: 'no because why does the printer need my student id',
      visual: 'Opens mid-argument with a printer. No setup. The printer is winning.',
      punch: 'it charged me and did not print',
      caption: 'explain this',
      audio: 'trending — pitched-up sample',
      patch: { hook: 'cold_open', absurdity: 0.85, caption_length: 6, video_length: 6 },
    },
    {
      trait: 'trending_audio',
      intent: 'probe whether original audio can carry the winning frame',
      headline: 'the laundry room speedrun, no-audio route',
      visual: 'Silent run. Only machine beeps and a door. Timer in the corner.',
      punch: 'ALL MACHINES OCCUPIED — run reset',
      caption: 'silent route',
      audio: 'original audio — machines only',
      patch: { audio_strategy: 'original', absurdity: 0.8, video_length: 7 },
    },
  ],
  instagram: [
    {
      trait: 'text_density',
      intent: 'test whether a carousel can carry a speedrun',
      headline: 'financial aid, in 8 slides',
      visual: 'Carousel. Each slide is one step of the portal, annotated like a museum placard.',
      punch: 'slide 8 is the session timeout',
      caption: 'swipe if you have suffered',
      audio: 'n/a — carousel',
      patch: { format: 'carousel', text_density: 0.55, caption_length: 14 },
    },
    {
      trait: 'relatability',
      intent: 'lean on the shared antagonist, static format',
      headline: 'the housing lottery, as a chart',
      visual: 'A single chart with one bar labelled "you" far below every other bar.',
      punch: 'statistically you were never getting the suite',
      caption: 'the math was never mathing',
      audio: 'n/a — still',
      patch: { format: 'infographic', relatability: 0.9, text_density: 0.48, video_length: 0 },
    },
    {
      trait: 'absurdity',
      intent: 'maximum absurdity in a reel',
      headline: 'campus wildlife documentary: the 4th-year',
      visual:
        'Long-lens reel. Whispered narration. Subject has not left the same chair in six hours.',
      punch: 'it has begun to blend with the furniture',
      caption: 'do not approach',
      audio: 'trending — documentary strings',
      patch: { format: 'mockumentary', absurdity: 0.91, video_length: 14 },
    },
    {
      trait: 'short_caption',
      intent: 'strip the caption to three words',
      headline: 'parking permit reel',
      visual: 'Reel. Timer. Lot fills. Runner arrives four cars too late.',
      punch: 'LOT FULL',
      caption: 'attempt six',
      audio: 'trending — speedrun timer sting',
      patch: { caption_length: 3, absurdity: 0.84, video_length: 6, format: 'speedrun' },
    },
    {
      trait: 'format',
      intent: 'test the meme-template format native to the platform',
      headline: 'me vs the syllabus, side by side',
      visual: 'Two-panel still. Left panel is the plan. Right panel is week 6.',
      punch: 'week 6 has no plan',
      caption: 'it got away from me',
      audio: 'n/a — still',
      patch: { format: 'two_panel', text_density: 0.6, video_length: 0, absurdity: 0.72 },
    },
    {
      trait: 'trend_relevance',
      intent: 'ride a format that is peaking this week',
      headline: 'rating my semester like a restaurant review',
      visual: 'Reel styled as a food review. Ambience, service, value. Semester scores 2.1.',
      punch: 'service: nonexistent. would not return.',
      caption: '2.1 stars',
      audio: 'trending — review format bed',
      patch: { trend_relevance: 0.9, absurdity: 0.78, video_length: 9 },
    },
  ],
  x: [
    {
      trait: 'short_caption',
      intent: 'compress the whole joke into one postable line',
      headline: 'the housing lottery is a slot machine that takes rent',
      visual: 'Text post. No media.',
      punch: '—',
      caption: 'the housing lottery is a slot machine that takes rent',
      audio: 'n/a — text',
      patch: { format: 'text_post', caption_length: 9, text_density: 0.95, video_length: 0 },
    },
    {
      trait: 'irony',
      intent: 'probe whether irony that died on video survives in text',
      headline: 'attendance policy, but sincerely',
      visual: 'Text post, deadpan, no punchline marker.',
      punch: '—',
      caption: 'love that attendance is mandatory for the lectures that are recorded',
      audio: 'n/a — text',
      patch: { format: 'text_post', irony: 0.86, text_density: 0.95, video_length: 0 },
    },
    {
      trait: 'relatability',
      intent: 'shared antagonist, quotable phrasing',
      headline: 'the portal timed me out again',
      visual: 'Text post with one screenshot of a session timeout.',
      punch: '—',
      caption: 'four password resets and it logged me out at 4:51',
      audio: 'n/a — text',
      patch: { format: 'text_post', relatability: 0.92, text_density: 0.88, video_length: 0 },
    },
    {
      trait: 'format',
      intent: 'test the thread as a propagation unit',
      headline: 'a thread on library seat law',
      visual: 'Six-post thread citing statutes that do not exist.',
      punch: 'a charger is adverse possession',
      caption: 'precedent is precedent 🧵',
      audio: 'n/a — thread',
      patch: { format: 'thread', text_density: 0.92, caption_length: 18, video_length: 0 },
    },
    {
      trait: 'absurdity',
      intent: 'absurdity with no image to carry it',
      headline: 'the gap is load-bearing',
      visual: 'Text post. Nothing else.',
      punch: '—',
      caption: 'from 11 to 3 i simply cease to exist and the schedule depends on this',
      audio: 'n/a — text',
      patch: { format: 'text_post', absurdity: 0.9, text_density: 0.9, video_length: 0 },
    },
    {
      trait: 'trend_relevance',
      intent: 'attach to a format currently circulating',
      headline: 'campus buildings, ranked, no explanation',
      visual: 'Text post, numbered list, no justification given.',
      punch: '—',
      caption: '1. the old one 2. the other old one 3. (gap) 4. the annex',
      audio: 'n/a — text',
      patch: { format: 'text_post', trend_relevance: 0.88, text_density: 0.9, video_length: 0 },
    },
  ],
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function nextId(): string {
  const nums = experiments.map((e) => Number(e.id.replace('exp_', '')) || 0)
  return `exp_${String(Math.max(...nums) + 1).padStart(3, '0')}`
}

/**
 * The meme a new batch descends from: the strongest thing in the most recent
 * round that has actually been posted. Using "last survivor" instead would
 * hang a new batch off an older round and pile it on top of a round that is
 * still in progress.
 */
function currentParent(): Experiment {
  const posted = experiments.filter((e) => e.deployment.timestamp !== null)
  if (posted.length) {
    const newest = Math.max(...posted.map((e) => e.generation))
    const pool = posted.filter((e) => e.generation === newest)
    return pool.reduce((acc, e) => {
      const a = e.observed.fitness ?? e.prediction.fitness
      const b = acc.observed.fitness ?? acc.prediction.fitness
      return a > b ? e : acc
    })
  }
  const survivors = experiments.filter((e) => e.status === 'survived')
  if (survivors.length) return survivors[survivors.length - 1]
  return [...experiments].sort((a, b) => b.generation - a.generation)[0]
}

function diffGenome(from: Experiment['genome'], to: Experiment['genome']) {
  const out: { trait: string; from: number | string; to: number | string }[] = []
  for (const k of Object.keys(to) as (keyof Experiment['genome'])[]) {
    if (from[k] !== to[k]) out.push({ trait: k, from: from[k], to: to[k] })
  }
  return out
}

// ── API surface ─────────────────────────────────────────────────────────────
export async function getExperiments(): Promise<Experiment[]> {
  await sleep(LATENCY.normal)
  return clone(experiments)
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  await sleep(LATENCY.fast)
  return clone(experiments.find((e) => e.id === id) ?? null)
}

export async function getAgentStates(): Promise<AgentState[]> {
  await sleep(LATENCY.normal)
  return clone(agentStates)
}

export async function getGenerations(): Promise<GenerationSummary[]> {
  await sleep(LATENCY.fast)
  const gens = [...new Set(experiments.map((e) => e.generation))].sort((a, b) => a - b)
  return gens.map((generation) => {
    const rows = experiments.filter((e) => e.generation === generation)
    const scored = rows.filter((e) => e.observed.fitness !== null)
    const best = scored.reduce<Experiment | null>(
      (acc, e) => (!acc || (e.observed.fitness ?? 0) > (acc.observed.fitness ?? 0) ? e : acc),
      null,
    )
    return {
      generation,
      count: rows.length,
      meanFitness: scored.length
        ? Math.round(
            (scored.reduce((a, e) => a + (e.observed.fitness ?? 0), 0) / scored.length) * 100,
          ) / 100
        : 0,
      bestId: best?.id ?? null,
      bestFitness: best?.observed.fitness ?? null,
    }
  })
}

export async function getCorpus(): Promise<CorpusStats> {
  await sleep(LATENCY.fast)
  return clone(rawCorpus as CorpusStats)
}

export async function generateCandidates(
  params: GenerateParams,
  onCandidate?: (e: Experiment, index: number) => void,
): Promise<Experiment[]> {
  const count = params.count ?? 5
  const parent = currentParent()
  const state = latestState()
  const generation = parent.generation + 1
  const pool = CONCEPTS[params.platform]

  // Risk appetite biases which concepts get drawn: low risk keeps the genome
  // near the agent's beliefs, high risk reaches for the untested corners.
  const ranked = [...pool].sort((a, b) => {
    const ca = state.confidence[a.trait as string] ?? 0.5
    const cb = state.confidence[b.trait as string] ?? 0.5
    return params.riskAppetite > 0.5 ? ca - cb : cb - ca
  })
  const chosen = ranked.slice(0, count)

  const out: Experiment[] = []
  for (let i = 0; i < chosen.length; i++) {
    await sleep(LATENCY.think + i * 90)
    const c = chosen[i]
    const genome: Experiment['genome'] = {
      ...clone(parent.genome),
      topic: params.topic || parent.genome.topic,
      ...c.patch,
    }
    const prediction = scoreGenome(genome, state)
    const exp: Experiment = {
      id: `${nextId()}_c${i}`,
      generation,
      parent_id: parent.id,
      status: 'predicted',
      genome,
      mutations: diffGenome(parent.genome, genome),
      hypothesis: `${c.intent[0].toUpperCase()}${c.intent.slice(1)}. ${
        params.riskAppetite > 0.5
          ? 'Confidence here is low, so the measurement is worth more than the score.'
          : 'This stays close to what has already been shown to work.'
      }`,
      prediction,
      content: {
        headline: c.headline,
        visual_description: c.visual,
        punchline: c.punch,
        caption: c.caption,
        audio: c.audio,
        media_url: `/specimens/exp_0${String(6 + (i % 9)).padStart(2, '0')}.svg`,
      },
      deployment: { platform: null, timestamp: null, post_id: null },
      observed: {
        views: null,
        likes: null,
        comments: null,
        shares: null,
        saves: null,
        fitness: null,
        timeseries: [],
      },
    }
    out.push(exp)
    onCandidate?.(clone(exp), i)
  }
  return clone(out)
}

export async function selectCandidate(
  candidates: Experiment[],
  riskAppetite = 0.2,
): Promise<SelectionResult> {
  await sleep(LATENCY.think)
  const ranking = [...candidates]
    .map((c) => ({ id: c.id, fitness: c.prediction.fitness, confidence: c.prediction.confidence }))
    .sort((a, b) => b.fitness - a.fitness)

  const best = ranking[0]
  // Least-certain candidate is the one worth probing when exploring.
  const probe = [...ranking].sort((a, b) => a.confidence - b.confidence)[0]
  const explore = probe.id !== best.id && Math.random() < riskAppetite

  const selected = explore ? probe : best
  const gap = Math.round((best.fitness - probe.fitness) * 100) / 100

  return {
    selectedId: selected.id,
    mode: explore ? 'explore' : 'exploit',
    reasoning: explore
      ? `Exploring: this candidate scores ${fit(gap)} lower than the leader but carries the lowest confidence in the population (${fit(probe.confidence)}), so the result buys more information than the safe pick would.`
      : `Exploiting: the leader scores highest at ${fit(best.fitness)} with ${fit(best.confidence)} confidence, and no sibling is uncertain enough to be worth the forgone fitness.`,
    ranking,
  }
}

export async function deployExperiment(id: string, platform: Platform): Promise<Experiment> {
  await sleep(LATENCY.think)
  const idx = experiments.findIndex((e) => e.id === id)
  const target = idx >= 0 ? experiments[idx] : null
  if (!target) throw new Error(`deployExperiment: unknown experiment ${id}`)
  target.status = 'deployed'
  target.deployment = {
    platform,
    timestamp: new Date().toISOString(),
    post_id: `7${Date.now()}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 19),
  }
  return clone(target)
}

/** Used by the Lab so a freshly generated candidate exists before deploy. */
export async function commitCandidate(candidate: Experiment): Promise<Experiment> {
  const exp = clone(candidate)
  exp.id = nextId()
  if (!experiments.some((e) => e.id === exp.id)) experiments.push(exp)
  return clone(exp)
}

export async function recordMetrics(id: string, metrics: MetricsInput): Promise<Experiment> {
  await sleep(LATENCY.normal)
  const target = experiments.find((e) => e.id === id)
  if (!target) throw new Error(`recordMetrics: unknown experiment ${id}`)
  // Defined in src/lib/score.ts so the tooltip that explains this number is
  // showing a breakdown of the same sum, not a re-typed copy of it.
  const fitness = spreadScore(metrics)
  target.observed = {
    ...metrics,
    fitness: Math.round(fitness * 100) / 100,
    timeseries: target.observed.timeseries,
  }
  return clone(target)
}

export async function evolve(): Promise<EvolveResult> {
  await sleep(LATENCY.think)
  const previous = latestState()
  const generation = previous.generation + 1

  // Evolve from the newest generation that actually has observations. The
  // agent-state counter and the experiment generation are not the same number,
  // so deriving the pool from `generation` cites results from the wrong round.
  const observed = experiments.filter((e) => e.observed.fitness !== null)
  const targetGen = observed.length ? Math.max(...observed.map((e) => e.generation)) : -1
  const pool = observed.filter((e) => e.generation === targetGen)

  const winner = pool.reduce<Experiment | null>(
    (acc, e) => (!acc || (e.observed.fitness ?? 0) > (acc.observed.fitness ?? 0) ? e : acc),
    null,
  )

  // Largest calibration miss in this generation is what moved the beliefs.
  const driver = pool.reduce<Experiment | null>((acc, e) => {
    const s = Math.abs((e.observed.fitness ?? 0) - e.prediction.fitness)
    const best = acc ? Math.abs((acc.observed.fitness ?? 0) - acc.prediction.fitness) : -1
    return s > best ? e : acc
  }, null)

  const beliefs = { ...previous.beliefs }
  const confidence = { ...previous.confidence }
  const shifts: EvolveResult['shifts'] = []

  if (winner) {
    const p = project(winner.genome)
    const err = (winner.observed.fitness ?? 0) - winner.prediction.fitness
    const rate = 0.34 + Math.min(0.26, Math.abs(err)) // bigger surprise, bigger update
    for (const k of Object.keys(p) as BeliefKey[]) {
      const from = beliefs[k] ?? 0.5
      const to = Math.round(clamp(from + (p[k] - from) * rate * (err >= 0 ? 1 : 0.45)) * 100) / 100
      beliefs[k] = to
      confidence[k] =
        Math.round(
          clamp((confidence[k] ?? 0.4) + (Math.abs(err) < 0.1 ? 0.06 : -0.04), 0.15, 0.95) * 100,
        ) / 100
      if (Math.abs(to - from) >= 0.01)
        shifts.push({ trait: k, from, to, delta: Math.round((to - from) * 100) / 100 })
    }
    for (const e of experiments) {
      if (e.generation === winner.generation && e.observed.fitness !== null) {
        e.status = e.id === winner.id ? 'survived' : 'extinct'
      }
    }
  }

  shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const top = shifts[0]
  const next: AgentState = {
    generation,
    beliefs,
    confidence,
    note: driver
      ? `${driver.id} came in ${delta((driver.observed.fitness ?? 0) - driver.prediction.fitness)} against its prediction${top ? `, moving ${top.trait.replace(/_/g, ' ')} to ${fit(top.to)}` : ''}.`
      : 'No observations available for this generation; beliefs carried forward unchanged.',
  }
  agentStates.push(next)

  return {
    generation,
    previous: clone(previous),
    next: clone(next),
    shifts,
    driverId: driver?.id ?? null,
  }
}

/**
 * Stands in for a real publish. Against the live backend this is an Instagram
 * Graph API call; here it just stamps a post id so the UI can be built and
 * demoed without touching anyone's account.
 */
export async function publishPost(req: PublishRequest): Promise<PublishResult> {
  await sleep(LATENCY.think)
  const target = experiments.find((e) => e.id === req.experiment_id)
  if (!target) throw new Error(`publishPost: unknown experiment ${req.experiment_id}`)

  const postId = `demo_${Date.now().toString(36)}`
  target.status = 'deployed'
  target.deployment = {
    platform: req.platform,
    timestamp: new Date().toISOString(),
    post_id: postId,
  }
  return {
    experiment_id: target.id,
    platform: req.platform,
    post_id: postId,
    permalink: null, // no real post exists, so no real link
    published_at: target.deployment.timestamp as string,
  }
}

/** Simulates the platform's numbers climbing after a post goes out. */
export async function fetchLiveMetrics(id: string): Promise<LiveMetrics> {
  await sleep(LATENCY.normal)
  const target = experiments.find((e) => e.id === id)
  if (!target) throw new Error(`fetchLiveMetrics: unknown experiment ${id}`)

  const since = target.deployment.timestamp
    ? (Date.now() - new Date(target.deployment.timestamp).getTime()) / 3_600_000
    : 0
  const p = target.prediction.fitness || 0.5
  const ramp = 1 - Math.exp(-3.1 * (Math.max(0.15, since) / 24))
  const views = Math.round((2400 + p * p * 46000) * ramp)
  const m = {
    views,
    likes: Math.round(views * (0.06 + p * 0.1)),
    comments: Math.round(views * (0.004 + p * 0.01)),
    shares: Math.round(views * (0.003 + p * p * 0.048)),
    saves: Math.round(views * (0.006 + p * 0.02)),
  }
  return {
    experiment_id: id,
    fetched_at: new Date().toISOString(),
    ...m,
    fitness: Math.round(spreadScore(m) * 100) / 100,
  }
}
