import { create } from 'zustand'
import type {
  AgentState,
  CorpusStats,
  Experiment,
  GenerationSummary,
  Platform,
  SelectionResult,
  ViewKey,
} from '@/types'
import * as client from '@/api/client'

export type LogKind = 'info' | 'good' | 'bad' | 'probe' | 'system'

export interface LogEntry {
  id: number
  t: string
  text: string
  kind: LogKind
}

export type LabStage = 'seed' | 'generate' | 'select' | 'authorize' | 'observe'

interface LabState {
  stage: LabStage
  platform: Platform
  topic: string
  riskAppetite: number
  running: boolean
  candidates: Experiment[]
  scored: Set<string>
  selection: SelectionResult | null
  armed: boolean
  deployed: Experiment | null
  observeHours: number
  evolved: boolean
}

interface Store {
  // data
  experiments: Experiment[]
  agentStates: AgentState[]
  generations: GenerationSummary[]
  corpus: CorpusStats | null
  loading: boolean
  error: string | null

  // shell
  view: ViewKey
  selectedId: string | null
  shortcutsOpen: boolean
  logOpen: boolean
  log: LogEntry[]

  // organism replay
  replayGen: number | null // null = show everything
  replaying: boolean

  // lab
  lab: LabState
  demo: boolean

  // actions
  init(): Promise<void>
  setView(v: ViewKey): void
  select(id: string | null): void
  toggleShortcuts(): void
  toggleLog(): void
  pushLog(text: string, kind?: LogKind): void
  replay(): Promise<void>
  setReplayGen(g: number | null): void

  setLab(patch: Partial<LabState>): void
  resetLab(): void
  runGenerate(): Promise<void>
  runSelect(): Promise<void>
  arm(): void
  runDeploy(): Promise<void>
  setObserveHours(h: number): void
  runEvolve(): Promise<void>
  setDemo(on: boolean): void
}

let booting = false
const nowClock = () => new Date().toLocaleTimeString('en-GB', { hour12: false })
let logSeq = 0

const initialLab: LabState = {
  stage: 'seed',
  platform: 'tiktok',
  topic: 'bureaucracy',
  riskAppetite: 0.2,
  running: false,
  candidates: [],
  scored: new Set<string>(),
  selection: null,
  armed: false,
  deployed: null,
  observeHours: 24,
  evolved: false,
}

export const useStore = create<Store>((set, get) => ({
  experiments: [],
  agentStates: [],
  generations: [],
  corpus: null,
  loading: true,
  error: null,

  view: 'organism',
  selectedId: null,
  shortcutsOpen: false,
  logOpen: false,
  log: [],

  replayGen: null,
  replaying: false,

  lab: initialLab,
  demo: false,

  async init() {
    // React StrictMode mounts effects twice in dev; without this the boot log
    // and every fetch would be duplicated on every reload.
    if (booting) return
    booting = true
    set({ loading: true, error: null })
    get().pushLog(`boot · backend=${client.backendLabel.toLowerCase()}`, 'system')
    try {
      const [experiments, agentStates, generations, corpus] = await Promise.all([
        client.getExperiments(),
        client.getAgentStates(),
        client.getGenerations(),
        client.getCorpus(),
      ])
      set({ experiments, agentStates, generations, corpus, loading: false })
      const latest = agentStates[agentStates.length - 1]
      get().pushLog(
        `loaded ${experiments.length} experiments across ${generations.length} generations`,
        'info',
      )
      get().pushLog(`agent state restored at generation ${latest?.generation ?? 0}`, 'info')
      const live = experiments.find((e) => e.status === 'deployed')
      if (live)
        get().pushLog(`${live.id} is live on ${live.deployment.platform} · observing`, 'good')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      set({ error: message, loading: false })
      get().pushLog(`load failed · ${message}`, 'bad')
      booting = false // allow retry
    }
  },

  setView(view) {
    set({ view })
  },

  select(selectedId) {
    set({ selectedId })
    if (selectedId) {
      const e = get().experiments.find((x) => x.id === selectedId)
      if (e) get().pushLog(`inspect ${e.id} · gen ${e.generation} · ${e.status}`, 'info')
    }
  },

  toggleShortcuts() {
    set((s) => ({ shortcutsOpen: !s.shortcutsOpen }))
  },

  toggleLog() {
    set((s) => ({ logOpen: !s.logOpen }))
  },

  pushLog(text, kind = 'info') {
    set((s) => ({
      log: [...s.log, { id: ++logSeq, t: nowClock(), text, kind }].slice(-160),
    }))
  },

  setReplayGen(replayGen) {
    set({ replayGen })
  },

  async replay() {
    const { experiments, replaying } = get()
    if (replaying || !experiments.length) return
    const gens = [...new Set(experiments.map((e) => e.generation))].sort((a, b) => a - b)
    set({ replaying: true, replayGen: -1, selectedId: null })
    get().pushLog('replaying evolution from generation 0', 'system')
    for (const g of gens) {
      await new Promise((r) => setTimeout(r, g === 0 ? 420 : 780))
      set({ replayGen: g })
      const rows = experiments.filter((e) => e.generation === g)
      const winner = rows.find((e) => e.status === 'survived')
      get().pushLog(
        `gen ${g} · ${rows.length} specimen${rows.length === 1 ? '' : 's'}${winner ? ` · ${winner.id} survives` : ''}`,
        winner ? 'good' : 'info',
      )
    }
    await new Promise((r) => setTimeout(r, 620))
    set({ replaying: false, replayGen: null })
    get().pushLog('replay complete · full lineage visible', 'system')
  },

  setLab(patch) {
    set((s) => ({ lab: { ...s.lab, ...patch } }))
  },

  resetLab() {
    set({ lab: { ...initialLab, scored: new Set<string>() } })
    get().pushLog('lab reset · stage seed', 'system')
  },

  async runGenerate() {
    const { lab } = get()
    if (lab.running) return
    get().setLab({
      running: true,
      stage: 'generate',
      candidates: [],
      selection: null,
      scored: new Set<string>(),
      armed: false,
      deployed: null,
      evolved: false,
    })
    get().pushLog(
      `generation requested · platform=${lab.platform} topic=${lab.topic} risk=${lab.riskAppetite.toFixed(2)}`,
      'system',
    )
    try {
      await client.generateCandidates(
        { platform: lab.platform, topic: lab.topic, riskAppetite: lab.riskAppetite, count: 5 },
        (candidate, i) => {
          set((s) => ({ lab: { ...s.lab, candidates: [...s.lab.candidates, candidate] } }))
          const mutated = candidate.mutations
            .map((m) => m.trait)
            .slice(0, 2)
            .join(', ')
          get().pushLog(
            `candidate ${String.fromCharCode(65 + i)} synthesised · mutating ${mutated || 'nothing'}`,
            'info',
          )
        },
      )
      get().setLab({ running: false, stage: 'select' })
      get().pushLog('population complete · 5 candidates awaiting score', 'system')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      get().setLab({ running: false })
      get().pushLog(`generation failed · ${message}`, 'bad')
    }
  },

  async runSelect() {
    const { lab } = get()
    if (lab.running || !lab.candidates.length) return
    get().setLab({ running: true, stage: 'select' })

    // Reveal scores one at a time — the re-ranking is the point of the stage.
    for (let i = 0; i < lab.candidates.length; i++) {
      await new Promise((r) => setTimeout(r, 520))
      const c = lab.candidates[i]
      set((s) => {
        const scored = new Set(s.lab.scored)
        scored.add(c.id)
        return { lab: { ...s.lab, scored } }
      })
      get().pushLog(
        `candidate ${String.fromCharCode(65 + i)} scored ${c.prediction.fitness.toFixed(2)} · conf ${c.prediction.confidence.toFixed(2)}`,
        c.prediction.fitness >= 0.75 ? 'good' : c.prediction.fitness < 0.55 ? 'bad' : 'info',
      )
    }

    try {
      const selection = await client.selectCandidate(get().lab.candidates, get().lab.riskAppetite)
      // Stop here on purpose: the EXPLOIT/EXPLORE verdict is the point of this
      // stage, and the operator advances to the gate themselves.
      get().setLab({ running: false, selection })
      const picked = get().lab.candidates.find((c) => c.id === selection.selectedId)
      get().pushLog(
        `${selection.mode.toUpperCase()} · selected ${picked?.content.headline.slice(0, 44) ?? selection.selectedId}`,
        selection.mode === 'explore' ? 'probe' : 'good',
      )
      get().pushLog('awaiting human authorization to deploy', 'system')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      get().setLab({ running: false })
      get().pushLog(`selection failed · ${message}`, 'bad')
    }
  },

  arm() {
    get().setLab({ armed: true })
    get().pushLog('deploy armed by operator', 'system')
  },

  async runDeploy() {
    const { lab } = get()
    if (!lab.selection || !lab.armed || lab.running) return
    const candidate = lab.candidates.find((c) => c.id === lab.selection!.selectedId)
    if (!candidate) return
    get().setLab({ running: true })
    get().pushLog(`deploying to ${lab.platform} …`, 'system')
    try {
      const committed = await client.commitCandidate(candidate)
      const deployed = await client.deployExperiment(committed.id, lab.platform)
      set((s) => ({
        experiments: [...s.experiments.filter((e) => e.id !== deployed.id), deployed],
        lab: { ...s.lab, running: false, deployed, stage: 'observe', observeHours: 0 },
      }))
      get().pushLog(`${deployed.id} live · post ${deployed.deployment.post_id}`, 'good')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      get().setLab({ running: false })
      get().pushLog(`deploy failed · ${message}`, 'bad')
    }
  },

  setObserveHours(observeHours) {
    get().setLab({ observeHours })
  },

  async runEvolve() {
    const { lab } = get()
    if (!lab.deployed || lab.running) return
    get().setLab({ running: true })
    get().pushLog('writing observation back to the agent …', 'system')
    try {
      const pred = lab.deployed.prediction.fitness
      const views = Math.round(1800 + pred * pred * 52000 * (0.6 + lab.observeHours / 24))
      const metrics = {
        views,
        likes: Math.round(views * (0.06 + pred * 0.1)),
        comments: Math.round(views * (0.004 + pred * 0.01)),
        shares: Math.round(views * (0.003 + pred * pred * 0.048)),
        saves: Math.round(views * (0.006 + pred * 0.02)),
      }
      const updated = await client.recordMetrics(lab.deployed.id, metrics)
      const result = await client.evolve()
      const [experiments, agentStates, generations] = await Promise.all([
        client.getExperiments(),
        client.getAgentStates(),
        client.getGenerations(),
      ])
      set((s) => ({
        experiments,
        agentStates,
        generations,
        lab: { ...s.lab, running: false, evolved: true, deployed: updated },
        selectedId: updated.id,
      }))
      const surprise = (updated.observed.fitness ?? 0) - updated.prediction.fitness
      get().pushLog(
        `observed fitness ${(updated.observed.fitness ?? 0).toFixed(2)} vs predicted ${updated.prediction.fitness.toFixed(2)} · ${surprise >= 0 ? '+' : ''}${surprise.toFixed(2)}`,
        Math.abs(surprise) >= 0.15 ? 'probe' : 'info',
      )
      for (const shift of result.shifts.slice(0, 3)) {
        get().pushLog(
          `belief ${shift.delta >= 0 ? '↑' : '↓'} ${shift.trait.replace(/_/g, ' ')} ${shift.from.toFixed(2)} → ${shift.to.toFixed(2)}`,
          shift.delta >= 0 ? 'good' : 'bad',
        )
      }
      get().pushLog(`generation ${result.generation} written · agent evolved`, 'system')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      get().setLab({ running: false })
      get().pushLog(`evolve failed · ${message}`, 'bad')
    }
  },

  setDemo(demo) {
    set({ demo })
  },
}))

// Dev affordance: poke at the whole app state from the browser console.
//   __mv.getState().lab           → current lab pipeline state
//   __mv.getState().setView('mind')
// Stripped from production builds.
if (import.meta.env.DEV) {
  ;(window as unknown as { __mv: typeof useStore }).__mv = useStore
}
