import { create } from 'zustand'
import type {
  AgentState,
  CorpusStats,
  EvolveResult,
  Experiment,
  GenerationSummary,
  Platform,
  SelectionResult,
} from '@/types'
import * as client from '@/api/client'

export type View = 'evolution' | 'lab' | 'learned'
export type LabStep = 'setup' | 'candidates' | 'review' | 'results'

interface LabState {
  error: string | null
  step: LabStep
  platform: Platform
  topic: string
  adventurous: boolean
  busy: boolean
  candidates: Experiment[]
  scored: string[]
  selection: SelectionResult | null
  approved: boolean
  posted: Experiment | null
  hours: number
  evolveResult: EvolveResult | null
}

const freshLab = (): LabState => ({
  error: null,
  step: 'setup',
  platform: 'tiktok',
  topic: 'bureaucracy',
  adventurous: false,
  busy: false,
  candidates: [],
  scored: [],
  selection: null,
  approved: false,
  posted: null,
  hours: 0,
  evolveResult: null,
})

interface Store {
  experiments: Experiment[]
  agentStates: AgentState[]
  generations: GenerationSummary[]
  corpus: CorpusStats | null
  loading: boolean
  error: string | null

  view: View
  selectedGen: number
  openId: string | null

  lab: LabState

  init(): Promise<void>
  setView(v: View): void
  setSelectedGen(g: number): void
  open(id: string | null): void

  setLab(patch: Partial<LabState>): void
  resetLab(): void
  createMemes(): Promise<void>
  postIt(): Promise<void>
  setHours(h: number): void
  finish(): Promise<void>
}

let booting = false

export const useStore = create<Store>((set, get) => ({
  experiments: [],
  agentStates: [],
  generations: [],
  corpus: null,
  loading: true,
  error: null,

  view: 'evolution',
  selectedGen: 0,
  openId: null,

  lab: freshLab(),

  async init() {
    // React StrictMode mounts effects twice in dev; without this everything loads twice.
    if (booting) return
    booting = true
    set({ loading: true, error: null })
    try {
      const [experiments, agentStates, generations, corpus] = await Promise.all([
        client.getExperiments(),
        client.getAgentStates(),
        client.getGenerations(),
        client.getCorpus(),
      ])
      const gens = [...new Set(experiments.map((e) => e.generation))].sort((a, b) => a - b)
      set({
        experiments,
        agentStates,
        generations,
        corpus,
        loading: false,
        selectedGen: gens[gens.length - 1] ?? 0,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      set({ error: message, loading: false })
      booting = false
    }
  },

  setView(view) {
    set({ view })
  },
  setSelectedGen(selectedGen) {
    set({ selectedGen })
  },
  open(openId) {
    set({ openId })
  },

  setLab(patch) {
    set((s) => ({ lab: { ...s.lab, ...patch } }))
  },

  resetLab() {
    set({ lab: freshLab() })
  },

  /** One button: write five memes, score them all, pick a winner. */
  async createMemes() {
    const { lab } = get()
    if (lab.busy) return
    get().setLab({
      busy: true,
      error: null,
      step: 'candidates',
      candidates: [],
      scored: [],
      selection: null,
      approved: false,
      posted: null,
      evolveResult: null,
    })
    try {
      const made = await client.generateCandidates(
        {
          platform: lab.platform,
          topic: lab.topic,
          riskAppetite: lab.adventurous ? 0.75 : 0.15,
          count: 5,
        },
        (candidate) => {
          set((s) => ({ lab: { ...s.lab, candidates: [...s.lab.candidates, candidate] } }))
        },
      )

      // Reveal the scores one at a time — watching them land is the point.
      for (const c of made) {
        await new Promise((r) => setTimeout(r, 420))
        set((s) => ({ lab: { ...s.lab, scored: [...s.lab.scored, c.id] } }))
      }

      const selection = await client.selectCandidate(made, lab.adventurous ? 0.75 : 0.15)
      get().setLab({ busy: false, selection })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // Local to the Lab — a failure here must not replace the whole app
      // with an error screen while the other two tabs still work.
      get().setLab({ busy: false, error: message })
    }
  },

  async postIt() {
    const { lab } = get()
    if (!lab.selection || !lab.approved || lab.busy) return
    const chosen = lab.candidates.find((c) => c.id === lab.selection!.selectedId)
    if (!chosen) return
    get().setLab({ busy: true })
    try {
      // Save the whole batch, not just the winner. The losing candidates are
      // part of the record — "every meme it has made" has to actually mean that.
      // Sequential, so each one gets its own server-assigned id.
      const saved: Experiment[] = []
      for (const c of lab.candidates) saved.push(await client.commitCandidate(c))

      const chosenIndex = lab.candidates.findIndex((c) => c.id === chosen.id)
      const posted = await client.deployExperiment(saved[chosenIndex].id, lab.platform)

      const merged = saved.map((e) => (e.id === posted.id ? posted : e))
      set((s) => ({
        experiments: [
          ...s.experiments.filter((e) => !merged.some((m) => m.id === e.id)),
          ...merged,
        ],
        lab: { ...s.lab, busy: false, posted, step: 'results', hours: 0 },
      }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // Local to the Lab — a failure here must not replace the whole app
      // with an error screen while the other two tabs still work.
      get().setLab({ busy: false, error: message })
    }
  },

  setHours(hours) {
    get().setLab({ hours })
  },

  /** Record the result and let the agent update its strategy. */
  async finish() {
    const { lab } = get()
    if (!lab.posted || lab.busy) return
    get().setLab({ busy: true })
    try {
      const p = lab.posted.prediction.fitness
      const views = Math.round(1800 + p * p * 52000 * (0.6 + lab.hours / 24))
      const updated = await client.recordMetrics(lab.posted.id, {
        views,
        likes: Math.round(views * (0.06 + p * 0.1)),
        comments: Math.round(views * (0.004 + p * 0.01)),
        shares: Math.round(views * (0.003 + p * p * 0.048)),
        saves: Math.round(views * (0.006 + p * 0.02)),
      })
      const evolveResult = await client.evolve()
      const [experiments, agentStates, generations] = await Promise.all([
        client.getExperiments(),
        client.getAgentStates(),
        client.getGenerations(),
      ])
      const gens = [...new Set(experiments.map((e) => e.generation))].sort((a, b) => a - b)
      set((s) => ({
        experiments,
        agentStates,
        generations,
        selectedGen: gens[gens.length - 1] ?? s.selectedGen,
        lab: { ...s.lab, busy: false, posted: updated, evolveResult },
      }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // Local to the Lab — a failure here must not replace the whole app
      // with an error screen while the other two tabs still work.
      get().setLab({ busy: false, error: message })
    }
  },
}))

if (import.meta.env.DEV) {
  ;(window as unknown as { __mv: typeof useStore }).__mv = useStore
}
