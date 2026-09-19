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
  EngagementSnapshot,
  CorpusStats,
  EvolveResult,
  Experiment,
  GenerateParams,
  GenerationSummary,
  MetricsInput,
  Platform,
  LiveMetrics,
  PublishRequest,
  PublishResult,
  SelectionResult,
} from '@/types'

const BASE = (
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'http://127.0.0.1:8000'
).replace(/\/$/, '')

type BackendExperiment = {
  id: string
  generation: number
  parent_id: string | null
  genome: Pick<
    Experiment['genome'],
    | 'topic'
    | 'humor'
    | 'format'
    | 'hook'
    | 'absurdity'
    | 'irony'
    | 'relatability'
    | 'trend_relevance'
    | 'video_length'
  >
  mutations: Experiment['mutations']
  hypothesis: string
  content?: Partial<Experiment['content']>
  prediction: {
    fitness: number
    model_version?: string
    confidence?: number | null
    feature_attribution?: Experiment['prediction']['feature_attribution']
  } | null
  deployment: Experiment['deployment']
  observed: Experiment['observed']
}

type BackendGeneration = { generation: number; experiments: BackendExperiment[] }

async function req_<T>(path: string, init?: RequestInit): Promise<T> {
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

export function mediaUrl(url: string): string {
  // /specimens is the backend's placeholder, not generated media.
  if (!url || url.startsWith('/specimens/')) return ''
  const resolved = new URL(url, `${BASE}/`)
  return ['http:', 'https:'].includes(resolved.protocol) ? resolved.href : ''
}

export function normalizeExperiment(raw: BackendExperiment): Experiment {
  const status =
    raw.deployment.post_id && !raw.deployment.post_id.startsWith('pending_')
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
      text_density: Number.NaN,
      caption_length: Number.NaN,
      audio_strategy: 'not provided',
    },
    mutations: raw.mutations,
    hypothesis: raw.hypothesis,
    prediction: raw.prediction
      ? {
          fitness: raw.prediction.fitness,
          confidence: raw.prediction.confidence ?? Number.NaN,
          feature_attribution: raw.prediction.feature_attribution ?? [],
          model_version: raw.prediction.model_version,
        }
      : { fitness: Number.NaN, confidence: Number.NaN, feature_attribution: [] },
    // The API stores the real meme text now. Fall back to describing the
    // genome only when a record predates that column.
    content: {
      headline: raw.content?.headline || `${raw.genome.topic} · ${raw.genome.format}`,
      visual_description: raw.content?.visual_description || 'No concept was written for this one.',
      punchline: raw.content?.punchline || '—',
      caption: raw.content?.caption || '—',
      audio: raw.content?.audio || 'not specified',
      media_url: mediaUrl(raw.content?.media_url ?? ''),
    },
    deployment: raw.deployment,
    observed: { ...raw.observed, timeseries: [] },
  }
}

export const getExperiments = async () => {
  const rows = await req_<BackendExperiment[]>('/experiments')
  return rows.map(normalizeExperiment)
}

export const getExperiment = async (id: string) =>
  normalizeExperiment(await req_<BackendExperiment>(`/experiments/${id}`))

export const getAgentStates = () => req_<AgentState[]>('/agent-states')

export const getGenerations = async () => {
  const groups = await req_<BackendGeneration[]>('/generations')
  return groups.map((group): GenerationSummary => {
    const experiments = group.experiments.map(normalizeExperiment)
    const scored = experiments.filter((experiment) => experiment.observed.fitness !== null)
    const best = [...scored].sort(
      (a, b) => (b.observed.fitness ?? 0) - (a.observed.fitness ?? 0),
    )[0]
    return {
      generation: group.generation,
      count: experiments.length,
      meanFitness: scored.length
        ? scored.reduce((sum, experiment) => sum + (experiment.observed.fitness ?? 0), 0) /
          scored.length
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
  // The backend runs the real evolutionary step in-process: the XGBoost
  // predictor scores the candidates and Gemini writes the selected concept.
  const batch = await req_<Experiment[]>('/generation', {
    method: 'POST',
    body: JSON.stringify({
      count: params.count ?? 5,
      topic: params.topic,
      platform: params.platform,
      riskAppetite: params.riskAppetite,
    }),
  })
  const list = batch.map((row) => ({
    ...normalizeExperiment(row),
    genome: row.genome,
    prediction: {
      fitness: row.prediction?.fitness ?? Number.NaN,
      confidence: row.prediction?.confidence ?? Number.NaN,
      feature_attribution: row.prediction?.feature_attribution ?? [],
      model_version: row.prediction?.model_version,
    },
  }))
  // Reveal them one at a time so the UI reads the same as it does on mock data.
  for (let i = 0; i < list.length; i++) {
    onCandidate?.(list[i], i)
    if (i < list.length - 1) await new Promise((r) => setTimeout(r, 260))
  }
  return list
}

export async function selectCandidate(
  candidates: Experiment[],
  riskAppetite = 0.2,
): Promise<SelectionResult> {
  // The agent already chose during /generation; this returns that decision.
  return req_<SelectionResult>('/select', {
    method: 'POST',
    body: JSON.stringify({
      candidate_ids: candidates.map((c) => c.id),
      risk_appetite: riskAppetite,
    }),
  })
}

// Preparing a record is not evidence of publication. Only /publish returns a real ID.
export const deployExperiment = (id: string, _platform: Platform) => getExperiment(id)

export const getSnapshots = (id: string) =>
  req_<EngagementSnapshot[]>(`/experiments/${encodeURIComponent(id)}/snapshots`)

/** Persists a generated candidate so it has a server-side id before deploy. */
export async function commitCandidate(candidate: Experiment): Promise<Experiment> {
  const saved = await req_<BackendExperiment>('/experiments', {
    method: 'POST',
    body: JSON.stringify(candidate),
  })
  // The create endpoint takes no prediction, so attach it separately. Without
  // this the stored experiment has none, and predicted-vs-actual - the whole
  // point of the comparison - shows 0.
  if (Number.isFinite(candidate.prediction?.fitness)) {
    try {
      await req_<unknown>(`/experiments/${saved.id}/prediction`, {
        method: 'POST',
        body: JSON.stringify({
          fitness: candidate.prediction.fitness,
          model_version: candidate.prediction.model_version ?? 'unreported',
        }),
      })
    } catch (e) {
      // Not fatal - the meme is saved, it just loses its predicted score.
      console.warn('could not attach prediction', e)
    }
  }
  return normalizeExperiment(await req_<BackendExperiment>(`/experiments/${saved.id}`))
}

export const recordMetrics = (id: string, metrics: MetricsInput) =>
  req_<BackendExperiment>(`/experiments/${id}/metrics`, {
    method: 'POST',
    body: JSON.stringify(metrics),
  }).then(normalizeExperiment)

export const evolve = (experimentId?: string, metrics?: Record<string, number>) =>
  req_<EvolveResult>('/evolve', {
    method: 'POST',
    body: JSON.stringify({ experiment_id: experimentId, ...(metrics ?? {}) }),
  })

/**
 * Publish for real. The backend owns the platform call because it holds the
 * access tokens, which must never reach the browser.
 *
 * INSTAGRAM — publishes outright, returns status 'live'.
 *   POST graph.facebook.com/v21.0/{ig-user-id}/media
 *        ?image_url=…&caption=…              -> { id: creation_id }
 *   POST graph.facebook.com/v21.0/{ig-user-id}/media_publish
 *        ?creation_id=…                      -> { id: media_id }
 *   GET  graph.facebook.com/v21.0/{media_id}?fields=permalink
 *   media_url must be publicly reachable: Meta fetches it server-side.
 *
 * TIKTOK — uploads into the creator's drafts, returns status 'awaiting_user'.
 *   POST open.tiktokapis.com/v2/post/publish/inbox/video/init/
 *        { source_info: { source: 'FILE_UPLOAD', video_size, chunk_size,
 *                         total_chunk_count } }
 *                                            -> { publish_id, upload_url }
 *   PUT  {upload_url}   (the video bytes, Content-Range per chunk)
 *   POST open.tiktokapis.com/v2/post/publish/status/fetch/
 *        { publish_id }                      -> poll until SEND_TO_USER_INBOX
 *
 *   Use the inbox route, NOT /v2/post/publish/video/init/ (Direct Post).
 *   Direct Post forces SELF_ONLY visibility until the app passes TikTok's
 *   audit, so the post is invisible and there is no spread to measure. The
 *   inbox route has no visibility restriction precisely because the creator
 *   publishes it themselves from the TikTok app. Scope: video.upload.
 *
 *   Prefer FILE_UPLOAD over PULL_FROM_URL — PULL_FROM_URL additionally
 *   requires you to verify domain ownership with TikTok.
 */
export const publishPost = (req: PublishRequest) =>
  req_<PublishResult>(`/experiments/${req.experiment_id}/publish`, {
    method: 'POST',
    body: JSON.stringify({
      platform: req.platform,
      caption: req.caption,
      media_url: req.media_url,
      media_type: req.media_type ?? 'IMAGE',
    }),
  })

/**
 * Real numbers back from the platform, recomputed into a fitness server-side.
 *
 * INSTAGRAM  GET /{media_id}?fields=like_count,comments_count
 *            GET /{media_id}/insights?metric=reach,saved,shares
 * TIKTOK     POST open.tiktokapis.com/v2/video/query/
 *            ?fields=id,like_count,comment_count,share_count,view_count
 *            { filters: { video_ids: [...] } }        scope: video.list
 *
 * For TikTok the id you query is the video id the creator ended up with, which
 * you only learn after they publish from their drafts — resolve it by listing
 * the account's recent videos and matching, or have the operator paste the URL.
 */
export const fetchLiveMetrics = (id: string) => req_<LiveMetrics>(`/experiments/${id}/live-metrics`)
