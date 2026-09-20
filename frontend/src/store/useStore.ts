import { create } from 'zustand'
import type { AgentState, CorpusStats, EvolveResult, Experiment, GenerationSummary, LiveMetrics, MetricsInput, SelectionResult } from '@/types'
import * as client from '@/api/client'

export type View = 'evolution' | 'lab' | 'learned'
export type LabStep = 'setup' | 'candidates' | 'review' | 'results'
/**
 * 'live' publishes to Instagram and reads real insights. 'demo' skips the
 * network entirely and lets the operator type the engagement numbers, so the
 * loop can be shown end to end in a few seconds. Demo numbers still go through
 * the backend's real scoring and belief update -- only their origin is
 * simulated, and everything on screen says so.
 */
export type Mode = 'live' | 'demo'
interface LabState {
  error: string | null; step: LabStep; topic: string; adventurous: boolean; busy: boolean
  candidates: Experiment[]; selection: SelectionResult | null; approved: boolean
  posted: Experiment | null; live: LiveMetrics | null; fetching: boolean; evolveResult: EvolveResult | null
}
const freshLab = (): LabState => ({ error: null, step: 'setup', topic: 'campus life', adventurous: false,
  busy: false, candidates: [], selection: null, approved: false, posted: null, live: null, fetching: false, evolveResult: null })
interface Store {
  experiments: Experiment[]; agentStates: AgentState[]; generations: GenerationSummary[]
  corpus: CorpusStats | null; loading: boolean; error: string | null
  view: View; selectedGen: number; openId: string | null; lab: LabState; mode: Mode
  init(): Promise<void>; setView(v: View): void; setSelectedGen(g: number): void; open(id: string | null): void
  setLab(patch: Partial<LabState>): void; resetLab(): void; resume(id: string): void
  createMemes(): Promise<void>; prepare(): Promise<void>; postIt(): Promise<void>
  refreshLive(): Promise<void>; finish(): Promise<void>
  setMode(m: Mode): void; simulate(metrics: MetricsInput): Promise<void>
}
let booting = false
const message = (e: unknown) => e instanceof Error ? e.message : String(e)
export const useStore = create<Store>((set, get) => ({
  experiments: [], agentStates: [], generations: [], corpus: null, loading: true, error: null,
  view: 'evolution', selectedGen: 0, openId: null, lab: freshLab(), mode: 'live',
  async init() {
    if (booting) return
    booting = true
    try {
      const [experiments, agentStates, generations, corpus] = await Promise.all([
        client.getExperiments(), client.getAgentStates(), client.getGenerations(), client.getCorpus(),
      ])
      set({ experiments, agentStates, generations, corpus, loading: false, error: null,
        selectedGen: Math.max(0, ...experiments.map(e => e.generation)) })
    } catch (e) { set({ error: message(e), loading: false }) }
    finally { booting = false }
  },
  setView: view => set({ view }), setSelectedGen: selectedGen => set({ selectedGen }), open: openId => set({ openId }),
  setLab: patch => set(s => ({ lab: { ...s.lab, ...patch } })),
  resetLab() { if (!get().lab.busy && !get().lab.fetching) set({ lab: freshLab() }) },
  resume(id) {
    const experiment = get().experiments.find(e => e.id === id)
    if (!experiment || get().lab.busy) return
    const selection = experiment.selection ?? null
    const candidates = selection ? get().experiments.filter(e => selection.ranking.some(r => r.id === e.id)) : [experiment]
    set({ view: 'lab', openId: null, lab: { ...freshLab(), topic: experiment.genome.topic, candidates, selection,
      posted: experiment.deployment.post_id ? experiment : null,
      step: experiment.deployment.post_id ? 'results' : experiment.content.media_url ? 'review' : 'candidates',
      evolveResult: experiment.evolve_result ?? null } })
  },
  async createMemes() {
    if (get().lab.busy) return
    const lab = get().lab
    get().setLab({ busy: true, error: null, candidates: [], selection: null })
    try {
      const candidates = await client.generateCandidates({ count: 5, topic: lab.topic, platform: 'instagram', riskAppetite: lab.adventurous ? .75 : .2 })
      const selection = await client.selectCandidate(candidates)
      set(s => ({ experiments: [...s.experiments, ...candidates], lab: { ...s.lab, candidates, selection, step: 'candidates', busy: false } }))
    } catch (e) { get().setLab({ error: message(e), busy: false }) }
  },
  async prepare() {
    const lab = get().lab
    if (!lab.selection || lab.busy) return
    get().setLab({ busy: true, error: null })
    try {
      const prepared = await client.prepareExperiment(lab.selection.selectedId)
      set(s => ({ experiments: s.experiments.map(e => e.id === prepared.id ? prepared : e),
        lab: { ...s.lab, candidates: s.lab.candidates.map(e => e.id === prepared.id ? prepared : e), step: 'review', approved: false, busy: false } }))
    } catch (e) { get().setLab({ error: message(e), busy: false }) }
  },
  async postIt() {
    const lab = get().lab
    if (!lab.selection || !lab.approved || lab.busy) return
    get().setLab({ busy: true, error: null })
    try {
      await client.publishPost(lab.selection.selectedId)
      const posted = await client.getExperiment(lab.selection.selectedId)
      set(s => ({ experiments: s.experiments.map(e => e.id === posted.id ? posted : e),
        lab: { ...s.lab, posted, step: 'results', busy: false } }))
    } catch (e) { get().setLab({ error: message(e), busy: false }) }
  },
  setMode(mode) { if (!get().lab.busy && !get().lab.fetching) set({ mode, lab: freshLab() }) },
  /**
   * Deploy without Instagram, then post the operator's own numbers.
   *
   * Both calls are the ordinary endpoints, so the fitness and the belief update
   * that follow are computed by the same backend code a real post would use.
   */
  async simulate(metrics) {
    const lab = get().lab
    if (!lab.selection || lab.busy) return
    get().setLab({ busy: true, error: null })
    try {
      const id = lab.selection.selectedId
      if (!lab.posted) await client.demoDeploy(id)
      const posted = await client.recordMetrics(id, metrics)
      set(s => ({ experiments: s.experiments.map(e => e.id === posted.id ? posted : e),
        lab: { ...s.lab, posted, step: 'results', busy: false } }))
    } catch (e) { get().setLab({ error: message(e), busy: false }) }
  },
  async refreshLive() {
    const lab = get().lab
    if (!lab.posted || lab.fetching || lab.busy) return
    get().setLab({ fetching: true, error: null })
    try {
      const live = await client.fetchLiveMetrics(lab.posted.id)
      const posted = await client.getExperiment(lab.posted.id)
      set(s => ({ experiments: s.experiments.map(e => e.id === posted.id ? posted : e), lab: { ...s.lab, posted, live, fetching: false } }))
    } catch (e) { get().setLab({ error: message(e), fetching: false }) }
  },
  async finish() {
    const lab = get().lab
    if (!lab.posted || lab.busy || lab.fetching || lab.posted.observed.fitness === null || lab.evolveResult) return
    get().setLab({ busy: true, error: null })
    try {
      const evolveResult = await client.evolve(lab.posted.id)
      get().setLab({ evolveResult, busy: false })
      await get().init()
    } catch (e) { get().setLab({ error: message(e), busy: false }) }
  },
}))
