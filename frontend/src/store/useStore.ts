import { create } from 'zustand'
import type {
  AgentState,
  CorpusStats,
  EvolveResult,
  Experiment,
  GenerationSummary,
  LiveMetrics,
  Platform,
  PublishResult,
  SelectionResult,
} from '@/types'
import * as client from '@/api/client'
import { isDemoMode, setDemoMode } from '@/api/client'

export type View = 'evolution' | 'lab' | 'learned'
export type LabStep = 'setup' | 'candidates' | 'review' | 'results'

interface LabState {
  /** Local to the Lab, so a failure here never replaces the whole app. */
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
  /** Set once the post is actually live on a real account. */
  published: PublishResult | null
  live: LiveMetrics | null
  fetching: boolean
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
  published: null,
  live: null,
  fetching: false,
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
  demoMode: boolean

  lab: LabState

  init(): Promise<void>
  resetAll(): Promise<void>
  toggleDemoMode(): void
  setView(v: View): void
  setSelectedGen(g: number): void
  open(id: string | null): void

  setLab(patch: Partial<LabState>): void
  resetLab(): void
  createMemes(): Promise<void>
  postIt(): Promise<void>
  setHours(h: number): void
  publishForReal(): Promise<void>
  refreshLive(): Promise<void>
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
  demoMode: isDemoMode(),

  lab: freshLab(),

  async resetAll() {
    if (!isDemoMode()) {
      try { await fetch('/experiments', { method: 'DELETE' }) } catch { /* ignore network error */ }
    }
    booting = false
    set({
      experiments: [],
      agentStates: [],
      generations: [],
      corpus: null,
      lab: freshLab(),
      view: 'lab',
      loading: false,
      error: null,
      selectedGen: 0,
      openId: null,
    })
  },

  toggleDemoMode() {
    const next = !get().demoMode
    setDemoMode(next)
    set({ demoMode: next })
    booting = false
    get().resetAll()
  },

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
      get().setLab({ busy: false, error: message })
    }
  },

  setHours(hours) {
    get().setLab({ hours })
  },

  /** Push the approved meme to a real account. */
  async publishForReal() {
    const { lab } = get()
    const target = lab.posted
    if (!target || lab.busy) return
    get().setLab({ busy: true, error: null })
    try {
      const published = await client.publishPost({
        experiment_id: target.id,
        platform: lab.platform,
        caption: target.content.caption,
        media_url: new URL(target.content.media_url, window.location.origin).href,
        media_type: 'IMAGE',
      })
      set((s) => ({
        lab: {
          ...s.lab,
          busy: false,
          published,
          posted: {
            ...target,
            deployment: {
              platform: published.platform,
              timestamp: published.published_at,
              post_id: published.post_id,
            },
          },
        },
      }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      get().setLab({ busy: false, error: message })
    }
  },

  /** Pull the platform's real numbers for the live post. */
  async refreshLive() {
    const { lab } = get()
    if (!lab.posted || lab.fetching) return
    get().setLab({ fetching: true, error: null })
    try {
      const live = await client.fetchLiveMetrics(lab.posted.id)
      get().setLab({ fetching: false, live })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      get().setLab({ fetching: false, error: message })
    }
  },

  /** Record the result and let the agent update its strategy. */
  async finish() {
    const { lab } = get()
    if (!lab.posted || lab.busy) return
    const real = lab.live
    // Live mode never teaches the agent from a made-up number — real engagement or nothing.
    if (!isDemoMode() && (!real || real.views === null)) {
      get().setLab({
        error: 'Pull the real numbers from Instagram before updating the AI — live mode never learns from projections.',
      })
      return
    }
    get().setLab({ busy: true, error: null })
    try {
      const p = lab.posted.prediction.fitness
      const metrics =
        real && real.views !== null
          ? {
              views: real.views,
              likes: real.likes ?? 0,
              comments: real.comments ?? 0,
              shares: real.shares ?? 0,
              saves: real.saves ?? 0,
            }
          : (() => {
              const fallbackViews = Math.round(1800 + p * p * 52000 * (0.6 + lab.hours / 24))
              return {
                views: fallbackViews,
                likes: Math.round(fallbackViews * (0.06 + p * 0.1)),
                comments: Math.round(fallbackViews * (0.004 + p * 0.01)),
                shares: Math.round(fallbackViews * (0.003 + p * p * 0.048)),
                saves: Math.round(fallbackViews * (0.006 + p * 0.02)),
              }
            })()
      const updated = await client.recordMetrics(lab.posted.id, metrics)
      // The live backend needs to know which experiment produced these numbers.
      const evolveResult = await client.evolve(lab.posted.id, metrics)
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
      get().setLab({ busy: false, error: message })
    }
  },
}))

if (import.meta.env.DEV) {
  ;(window as unknown as { __mv: typeof useStore }).__mv = useStore
}
