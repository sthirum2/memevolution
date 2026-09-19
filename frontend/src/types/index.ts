// ─────────────────────────────────────────────────────────────────────────────
// FROZEN DATA CONTRACT
// Agreed across all four roles (data-model / agent / frontend / backend).
// Do not add or rename fields without telling the whole team — the backend
// serialises exactly this shape and the agent writes exactly this shape.
// ─────────────────────────────────────────────────────────────────────────────

export type Platform = 'tiktok' | 'instagram' | 'x'

export type ExperimentStatus =
  | 'pending' // genome exists, model has not scored it yet
  | 'predicted' // scored by the historical model, not deployed
  | 'deployed' // live on a real platform, accumulating observations
  | 'survived' // finished, selected as parent of the next generation
  | 'extinct' // finished, pruned — did not reproduce

export interface Genome {
  topic: string
  humor: string
  format: string
  hook: string
  absurdity: number
  irony: number
  relatability: number
  trend_relevance: number
  text_density: number
  caption_length: number
  video_length: number
  audio_strategy: string
}

export interface Mutation {
  trait: string
  from: number | string
  to: number | string
}

export interface FeatureAttribution {
  feature: string
  contribution: number
}

export interface Prediction {
  fitness: number
  confidence: number
  feature_attribution: FeatureAttribution[]
}

export interface Content {
  headline: string
  visual_description: string
  punchline: string
  caption: string
  audio: string
  media_url: string
}

export interface Deployment {
  platform: Platform | null
  timestamp: string | null
  post_id: string | null
}

export interface TimeseriesPoint {
  t: string
  views: number
  likes: number
  shares: number
}

export interface Observed {
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  fitness: number | null
  timeseries: TimeseriesPoint[]
}

export interface Experiment {
  id: string
  generation: number
  parent_id: string | null
  status: ExperimentStatus
  genome: Genome
  mutations: Mutation[]
  hypothesis: string
  prediction: Prediction
  content: Content
  deployment: Deployment
  observed: Observed
}

export interface AgentState {
  generation: number
  beliefs: Record<string, number>
  confidence: Record<string, number>
  note: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontend-only view models. Not part of the backend contract.
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationSummary {
  generation: number
  count: number
  meanFitness: number
  bestId: string | null
  bestFitness: number | null
}

export interface CorpusStats {
  datasets: {
    name: string
    scale: string
    source: string
    description: string
    rowsSampled: number
  }[]
  fitnessDistribution: { bucket: string; count: number }[]
  traitCorrelation: { trait: string; correlation: number }[]
  propagationByFormat: { format: string; medianShareRate: number; n: number }[]
}

export interface GenerateParams {
  platform: Platform
  topic: string
  riskAppetite: number // 0 = pure exploit, 1 = pure explore
  count?: number
}

export interface SelectionResult {
  selectedId: string
  mode: 'exploit' | 'explore'
  reasoning: string
  ranking: { id: string; fitness: number; confidence: number }[]
}

export interface MetricsInput {
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
}

export interface EvolveResult {
  generation: number
  previous: AgentState
  next: AgentState
  shifts: { trait: string; from: number; to: number; delta: number }[]
  driverId: string | null
}

export type ViewKey = 'organism' | 'specimen' | 'mind' | 'lab' | 'corpus'


