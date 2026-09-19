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

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
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

export const getExperiments = () => req<Experiment[]>('/experiments')

export const getExperiment = (id: string) => req<Experiment | null>(`/experiments/${id}`)

export const getAgentStates = () => req<AgentState[]>('/agent-states')

export const getGenerations = () => req<GenerationSummary[]>('/generations')

export const getCorpus = () => req<CorpusStats>('/corpus')

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
  const list = await req<Experiment[]>('/generation', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  list.forEach((e, i) => onCandidate?.(e, i))
  return list
}

export async function selectCandidate(
  candidates: Experiment[],
  riskAppetite = 0.2,
): Promise<SelectionResult> {
  return req<SelectionResult>('/select', {
    method: 'POST',
    body: JSON.stringify({
      candidate_ids: candidates.map((c) => c.id),
      risk_appetite: riskAppetite,
    }),
  })
}

export const deployExperiment = (id: string, platform: Platform) =>
  req<Experiment>(`/experiments/${id}/deploy`, {
    method: 'POST',
    body: JSON.stringify({ platform }),
  })

/** Persists a generated candidate so it has a server-side id before deploy. */
export const commitCandidate = (candidate: Experiment) =>
  req<Experiment>('/experiments', { method: 'POST', body: JSON.stringify(candidate) })

export const recordMetrics = (id: string, metrics: MetricsInput) =>
  req<Experiment>(`/experiments/${id}/metrics`, {
    method: 'POST',
    body: JSON.stringify(metrics),
  })

export const evolve = () => req<EvolveResult>('/evolve', { method: 'POST' })
