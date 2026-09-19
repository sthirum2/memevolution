// ─────────────────────────────────────────────────────────────────────────────
// HTTP BACKEND
// Implements the identical interface to mock.ts against a FastAPI server.
// Nothing in the UI changes when this takes over — set in .env:
//     VITE_USE_MOCK=false
//     VITE_API_BASE_URL=http://localhost:8000
// See the BACKEND INTEGRATION section of README.md for the endpoint table.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AgentState,
  CorpusStats,
  EvolveResult,
  Experiment,
  GenerateParams,
  GenerationSummary,
  MetricsInput,
  Platform,
  SelectionResult,
} from '@/types'

const BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

type BackendExperiment = {
  id: string
  generation: number
  parent_id: string | null
  genome: Pick<Experiment['genome'], 'topic' | 'humor' | 'format' | 'hook' | 'absurdity' | 'irony' | 'relatability' | 'trend_relevance' | 'video_length'>
  mutations: Experiment['mutations']
  hypothesis: string
  prediction: { fitness: number; model_version: string } | null
  deployment: Experiment['deployment']
  observed: Experiment['observed']
}

type BackendGeneration = { generation: number; experiments: BackendExperiment[] }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'Content-Type': 'application/json' } : undefined
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...init,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `${init?.method ?? 'GET'} ${path} → ${res.status} ${res.statusText}${body ? ` · ${body.slice(0, 200)}` : ''}`,
    )
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function normalizeExperiment(raw: BackendExperiment): Experiment {
  const status = raw.observed.fitness !== null
    ? 'survived'
    : raw.deployment.post_id
      ? 'deployed'
      : raw.prediction
        ? 'predicted'
        : 'pending'

  return {
    id: raw.id,
    generation: raw.generation,
    parent_id: raw.parent_id,
    status,
    genome: {
      ...raw.genome,
      text_density: 0,
      caption_length: 0,
      audio_strategy: 'not provided',
    },
    mutations: raw.mutations,
    hypothesis: raw.hypothesis,
    prediction: raw.prediction
      ? { fitness: raw.prediction.fitness, confidence: Number.NaN, feature_attribution: [] }
      : { fitness: 0, confidence: 0, feature_attribution: [] },
    content: {
      headline: `${raw.genome.topic} · ${raw.genome.format}`,
      visual_description: 'Content concept is managed by the agent.',
      punchline: '—',
      caption: '—',
      audio: 'Not provided',
      media_url: '/specimens/exp_000.svg',
    },
    deployment: raw.deployment,
    observed: { ...raw.observed, timeseries: [] },
  }
}

export const getExperiments = async () => {
  const rows = await req<BackendExperiment[]>('/experiments')
  return rows.map(normalizeExperiment)
}

export const getExperiment = async (id: string) => normalizeExperiment(await req<BackendExperiment>(`/experiments/${id}`))

export const getAgentStates = async (): Promise<AgentState[]> => []

export const getGenerations = async () => {
  const groups = await req<BackendGeneration[]>('/generations')
  return groups.map((group): GenerationSummary => {
    const experiments = group.experiments.map(normalizeExperiment)
    const scored = experiments.filter((experiment) => experiment.observed.fitness !== null)
    const best = [...scored].sort((a, b) => (b.observed.fitness ?? 0) - (a.observed.fitness ?? 0))[0]
    return {
      generation: group.generation,
      count: experiments.length,
      meanFitness: scored.length
        ? scored.reduce((sum, experiment) => sum + (experiment.observed.fitness ?? 0), 0) / scored.length
        : 0,
      bestId: best?.id ?? null,
      bestFitness: best?.observed.fitness ?? null,
    }
  })
}

export const getCorpus = async (): Promise<CorpusStats> => ({
  datasets: [],
  fitnessDistribution: [],
  traitCorrelation: [],
  propagationByFormat: [],
})

/**
 * The mock streams candidates one at a time to drive the Lab's staged reveal.
 * Over HTTP the simplest correct thing is to take the batch and replay it
 * through the same callback, so the UI behaves identically. If the backend
 * later exposes SSE at /generation/stream, swap the body — the signature and
 * every caller stay exactly as they are.
 */
export async function generateCandidates(
  params: GenerateParams,
  onCandidate?: (e: Experiment, index: number) => void,
): Promise<Experiment[]> {
  void params
  void onCandidate
  throw new Error('Live generation creation is owned by the agent integration, not this backend API.')
}

export async function selectCandidate(
  candidates: Experiment[],
  riskAppetite = 0.2,
): Promise<SelectionResult> {
  void candidates
  void riskAppetite
  throw new Error('Live candidate selection is owned by the agent integration, not this backend API.')
}

export const deployExperiment = (id: string, platform: Platform) => {
  void id
  void platform
  throw new Error('Live deployment requires a TikTok post_id and is completed by the human workflow.')
}

/** Persists a generated candidate so it has a server-side id before deploy. */
export const commitCandidate = (candidate: Experiment) =>
  req<BackendExperiment>('/experiments', { method: 'POST', body: JSON.stringify(candidate) }).then(normalizeExperiment)

export const recordMetrics = (id: string, metrics: MetricsInput) =>
  req<Experiment>(`/experiments/${id}/metrics`, {
    method: 'POST',
    body: JSON.stringify(metrics),
  })

export const evolve = async (): Promise<EvolveResult> => {
  throw new Error('Live evolution is owned by the agent integration, not this backend API.')
}


