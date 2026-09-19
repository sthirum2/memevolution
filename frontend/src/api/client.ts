// ─────────────────────────────────────────────────────────────────────────────
// THE ONLY DATA DOOR IN THE APP.
// No component imports JSON, and no component calls fetch. Everything goes
// through this module, which picks an implementation from one env flag.
//
//   VITE_USE_MOCK=true   → src/api/mock.ts  (local JSON, simulated latency)
//   VITE_USE_MOCK=false  → src/api/http.ts  (FastAPI at VITE_API_BASE_URL)
//
// Both modules export the same names with the same signatures, so switching
// backends is a one-line change in .env and touches nothing else.
// ─────────────────────────────────────────────────────────────────────────────
import * as mock from './mock'
import * as http from './http'
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

export interface MemevolutionApi {
  getExperiments(): Promise<Experiment[]>
  getExperiment(id: string): Promise<Experiment | null>
  getAgentStates(): Promise<AgentState[]>
  getGenerations(): Promise<GenerationSummary[]>
  getCorpus(): Promise<CorpusStats>
  generateCandidates(
    params: GenerateParams,
    onCandidate?: (e: Experiment, index: number) => void,
  ): Promise<Experiment[]>
  selectCandidate(candidates: Experiment[], riskAppetite?: number): Promise<SelectionResult>
  commitCandidate(candidate: Experiment): Promise<Experiment>
  deployExperiment(id: string, platform: Platform): Promise<Experiment>
  recordMetrics(id: string, metrics: MetricsInput): Promise<Experiment>
  /** Actually publish to a real account. See PublishRequest. */
  publishPost(req: PublishRequest): Promise<PublishResult>
  /** Pull real numbers back from the platform for a published post. */
  fetchLiveMetrics(id: string): Promise<LiveMetrics>
  /** Teach the agent from a real result. id is required against the live backend. */
  evolve(experimentId?: string, metrics?: Record<string, number>): Promise<EvolveResult>
}

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const impl: MemevolutionApi = USE_MOCK ? (mock as MemevolutionApi) : (http as MemevolutionApi)

export const api: MemevolutionApi = impl

export const getExperiments = () => impl.getExperiments()
export const getExperiment = (id: string) => impl.getExperiment(id)
export const getAgentStates = () => impl.getAgentStates()
export const getGenerations = () => impl.getGenerations()
export const getCorpus = () => impl.getCorpus()
export const generateCandidates: MemevolutionApi['generateCandidates'] = (p, cb) =>
  impl.generateCandidates(p, cb)
export const selectCandidate: MemevolutionApi['selectCandidate'] = (c, r) =>
  impl.selectCandidate(c, r)
export const commitCandidate = (c: Experiment) => impl.commitCandidate(c)
export const deployExperiment = (id: string, platform: Platform) =>
  impl.deployExperiment(id, platform)
export const recordMetrics = (id: string, m: MetricsInput) => impl.recordMetrics(id, m)
export const publishPost = (req: PublishRequest) => impl.publishPost(req)
export const fetchLiveMetrics = (id: string) => impl.fetchLiveMetrics(id)
export const evolve = (id?: string, m?: Record<string, number>) => impl.evolve(id, m)

/** Shown in the top bar so it is never ambiguous which backend is answering. */
export const backendLabel = USE_MOCK ? 'MOCK' : 'LIVE'
