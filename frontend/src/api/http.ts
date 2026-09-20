import type { AgentState, CorpusStats, Experiment, GenerateParams, GenerationSummary, LiveMetrics, MetricsInput, PublishResult, SelectionResult, EvolveResult } from '@/types'

// Empty origin supports the backend-served build and Vite's development proxy.
const BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    if (typeof body.detail === 'string') throw new Error(body.detail)
    // A proxy in front of the backend (a tunnel, a CDN) answers a timeout with
    // HTML rather than our JSON, and HTTP/2 carries no status text -- so the
    // generic branch below rendered the useless "524: \"\"".
    if (response.status >= 502) {
      throw new Error(
        `The connection timed out before the backend answered (HTTP ${response.status}). ` +
        'Video generation takes about two minutes, which is longer than a public tunnel allows. ' +
        'Use the app on localhost for generation, or set VEO_TIER=lite for a faster render.'
      )
    }
    throw new Error(`${response.status}: ${JSON.stringify(body.detail ?? response.statusText)}`)
  }
  return response.json() as Promise<T>
}
const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export type Capabilities = {
  gemini: boolean
  instagram: boolean
  publicMedia: boolean
  predictor: string
}

/**
 * What the backend is actually configured to do.
 *
 * run_generation builds GeminiConceptGenerator directly, which throws when
 * neither an API key nor Vertex is configured, so `gemini: false` means every
 * generation will 503. The Lab checks this up front to explain that rather
 * than letting the user hit a raw error.
 */
export const getCapabilities = () => request<Capabilities>('/capabilities')

type BackendExperiment = Omit<Experiment, 'genome' | 'prediction' | 'status'> & {
  status: string
  genome: Partial<Experiment['genome']>
  agent_genome?: Partial<Experiment['genome']> | null
  prediction: { fitness: number; model_version: string; confidence?: number | null } | null
  timeseries: { timestamp: string; views: number | null; likes: number | null; shares: number | null }[]
}

export function normalizeExperiment(raw: BackendExperiment): Experiment {
  const genome = { ...raw.genome, ...raw.agent_genome }
  return {
    ...raw,
    status: raw.observed.fitness !== null ? 'survived' : raw.deployment.post_id ? 'deployed' : raw.prediction ? 'predicted' : 'pending',
    genome: { ...genome, text_density: Number.NaN, caption_length: genome.caption_length ?? Number.NaN,
      audio_strategy: genome.audio_strategy ?? 'Unavailable' } as Experiment['genome'],
    prediction: { fitness: raw.prediction?.fitness ?? Number.NaN, confidence: raw.prediction?.confidence ?? Number.NaN, feature_attribution: [] },
    content: { ...raw.content, media_url: raw.content.media_url ? new URL(raw.content.media_url, BASE || window.location.origin).href : '' },
    observed: { ...raw.observed, timeseries: (raw.timeseries ?? []).map(p => ({ t: p.timestamp, views: p.views, likes: p.likes, shares: p.shares })) },
  }
}
export const getExperiments = async () => (await request<BackendExperiment[]>('/experiments')).map(normalizeExperiment)
export const getExperiment = async (id: string) => normalizeExperiment(await request<BackendExperiment>(`/experiments/${id}`))
export const getAgentStates = () => request<AgentState[]>('/agent-states')
export const getCorpus = () => request<CorpusStats>('/corpus')
export const getGenerations = async (): Promise<GenerationSummary[]> => {
  const groups = await request<{ generation: number; experiments: BackendExperiment[] }[]>('/generations')
  return groups.map(g => {
    const scored = g.experiments.filter(e => e.observed.fitness !== null)
    const best = [...scored].sort((a,b) => b.observed.fitness! - a.observed.fitness!)[0]
    return { generation: g.generation, count: g.experiments.length,
      meanFitness: scored.length ? scored.reduce((s,e) => s + e.observed.fitness!, 0) / scored.length : 0,
      bestId: best?.id ?? null, bestFitness: best?.observed.fitness ?? null }
  })
}
export async function generateCandidates(params: GenerateParams, onCandidate?: (e: Experiment, index: number) => void) {
  const rows = (await post<BackendExperiment[]>('/generation', params)).map(normalizeExperiment)
  rows.forEach((e,i) => onCandidate?.(e,i))
  return rows
}
export const selectCandidate = (candidates: Experiment[]) => post<SelectionResult>('/select', { candidate_ids: candidates.map(c => c.id) })
export const prepareExperiment = async (id: string) => normalizeExperiment(await post<BackendExperiment>(`/experiments/${id}/prepare`))
export const publishPost = (id: string) => post<PublishResult>(`/experiments/${id}/publish`, { platform: 'instagram' })
export const fetchLiveMetrics = (id: string) => post<LiveMetrics>(`/experiments/${id}/live-metrics`)
export const evolve = (id: string) => post<EvolveResult>('/evolve', { experiment_id: id })

/**
 * Demo mode: mark the experiment deployed without touching Instagram.
 *
 * The post id is deliberately prefixed so nothing downstream can mistake a
 * simulated run for a real one -- there is no Instagram media behind it.
 */
/** Wipe every stored round server-side; published posts are unaffected. */
export const resetAll = () => post<{ cleared: Record<string, number> }>('/reset', {})

export const demoDeploy = async (id: string) =>
  normalizeExperiment(await post<BackendExperiment>(`/experiments/${id}/deploy`, {
    platform: 'demo', post_id: `demo_${id}`,
  }))

/**
 * Demo mode: hand the backend engagement numbers the operator typed.
 *
 * This is the same endpoint a real observation uses, so the figures run
 * through the real spread_score and land in the same snapshot table; only
 * their origin differs, and `platform: 'demo'` records that.
 */
export const recordMetrics = async (id: string, metrics: MetricsInput) =>
  normalizeExperiment(await post<BackendExperiment>(`/experiments/${id}/metrics`, metrics))
