// ─────────────────────────────────────────────────────────────────────────────
// THE ONLY DATA DOOR IN THE APP.
// Runtime demo/live toggle: call setDemoMode(true) to switch to mock data,
// setDemoMode(false) to use the real backend.
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
  publishPost(req: PublishRequest): Promise<PublishResult>
  fetchLiveMetrics(id: string): Promise<LiveMetrics>
  evolve(experimentId?: string, metrics?: Record<string, number>): Promise<EvolveResult>
}

// Build-time flag — true only when explicitly set to "true"
const BUILD_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Runtime override stored in sessionStorage so it survives hot-reloads but not page reloads
let _demoMode: boolean = (() => {
  try {
    const v = sessionStorage.getItem('mv_demo_mode')
    if (v !== null) return v === 'true'
  } catch { /* ignore */ }
  return BUILD_MOCK
})()

export const USE_MOCK = BUILD_MOCK

export function isDemoMode() {
  return _demoMode
}

export function setDemoMode(demo: boolean) {
  _demoMode = demo
  try { sessionStorage.setItem('mv_demo_mode', String(demo)) } catch { /* ignore */ }
}

function impl(): MemevolutionApi {
  return _demoMode ? (mock as MemevolutionApi) : (http as MemevolutionApi)
}

export const getExperiments = () => impl().getExperiments()
export const getExperiment = (id: string) => impl().getExperiment(id)
export const getAgentStates = () => impl().getAgentStates()
export const getGenerations = () => impl().getGenerations()
export const getCorpus = () => impl().getCorpus()
export const generateCandidates: MemevolutionApi['generateCandidates'] = (p, cb) =>
  impl().generateCandidates(p, cb)
export const selectCandidate: MemevolutionApi['selectCandidate'] = (c, r) =>
  impl().selectCandidate(c, r)
export const commitCandidate = (c: Experiment) => impl().commitCandidate(c)
export const deployExperiment = (id: string, platform: Platform) =>
  impl().deployExperiment(id, platform)
export const recordMetrics = (id: string, m: MetricsInput) => impl().recordMetrics(id, m)
export const publishPost = (req: PublishRequest) => impl().publishPost(req)
export const fetchLiveMetrics = (id: string) => impl().fetchLiveMetrics(id)
export const evolve = (id?: string, m?: Record<string, number>) => impl().evolve(id, m)
