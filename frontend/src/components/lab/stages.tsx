import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Instagram, Loader2, Music2, Sparkles, Twitter } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '@/store/useStore'
import { USE_MOCK } from '@/api/client'
import type { Experiment, Platform } from '@/types'
import { C, NUMERIC_TRAITS, fitnessColor } from '@/lib/fitness'
import { compact, delta, fit, full, titleize } from '@/lib/format'
import { useCountUp } from '@/lib/useCountUp'
import { Button, Chip, Meter, SectionLabel, cx } from '@/components/common/ui'
import { AXIS, GRID, TooltipShell } from '@/components/charts/chartTheme'
import CandidateCard from './CandidateCard'
import PlatformPost from './PlatformPost'
import ViralOdds from './ViralOdds'
import SlideToArm from './SlideToArm'

// ── STAGE 1 · SEED ──────────────────────────────────────────────────────────
const PLATFORMS: { key: Platform; name: string; icon: typeof Music2; note: string }[] = [
  {
    key: 'tiktok',
    name: 'tiktok',
    icon: Music2,
    note: 'sound-driven · short video · highest share ceiling',
  },
  {
    key: 'instagram',
    name: 'instagram',
    icon: Instagram,
    note: 'reels + carousels · saves matter more than shares',
  },
  { key: 'x', name: 'x', icon: Twitter, note: 'text-native · quote-share is the propagation unit' },
]

const TOPICS = ['bureaucracy', 'cs_major', 'campus', 'dining', 'group_work', 'gym']

export function StageSeed() {
  const lab = useStore((s) => s.lab)
  const setLab = useStore((s) => s.setLab)
  const runGenerate = useStore((s) => s.runGenerate)

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex flex-col gap-2">
        <SectionLabel right="step 1 of 5">target environment</SectionLabel>
        <p className="text-2xs leading-relaxed text-smoke">
          the agent's strategy is platform-specific — what propagates through sound on one does not
          propagate through text on another.
        </p>
        <div className="mt-1 grid gap-3 sm:grid-cols-3">
          {PLATFORMS.map((p) => {
            const active = lab.platform === p.key
            const Icon = p.icon
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setLab({ platform: p.key })}
                className={cx(
                  'group relative flex flex-col gap-3 border p-4 text-left transition-all duration-200',
                  active
                    ? 'border-acid/70 bg-acid/[0.045]'
                    : 'border-hairline hover:border-hairline-strong hover:bg-graphite/50',
                )}
              >
                {active ? <span className="absolute inset-x-0 top-0 h-px bg-acid" /> : null}
                <Icon size={20} className={active ? 'text-acid' : 'text-smoke'} />
                <span
                  className={cx(
                    'font-display text-sm font-bold lowercase tracking-[0.12em]',
                    active ? 'text-acid' : 'text-bone',
                  )}
                >
                  {p.name}
                </span>
                <span className="text-2xs leading-relaxed text-smoke">{p.note}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <SectionLabel>topic / niche</SectionLabel>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {TOPICS.map((t) => (
              <button key={t} type="button" onClick={() => setLab({ topic: t })}>
                <Chip tone={lab.topic === t ? 'acid' : 'neutral'}>{titleize(t)}</Chip>
              </button>
            ))}
          </div>
          <input
            value={lab.topic}
            onChange={(e) => setLab({ topic: e.target.value })}
            placeholder="or type a niche"
            className="mt-2 border border-hairline bg-transparent px-2.5 py-2 text-2xs text-bone outline-none transition-colors placeholder:text-smoke focus:border-acid/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel right={lab.riskAppetite > 0.5 ? 'explore' : 'exploit'}>
            risk appetite
          </SectionLabel>
          <p className="text-2xs leading-relaxed text-smoke">
            how far the agent is allowed to deviate from the strategy it has already learned. low
            keeps it near proven ground; high spends fitness to buy information about traits it is
            unsure of.
          </p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={lab.riskAppetite}
            onChange={(e) => setLab({ riskAppetite: Number(e.target.value) })}
            className="mt-2 w-full accent-[#C7F04A]"
          />
          <div className="flex items-baseline justify-between text-2xs lowercase tracking-lab text-smoke">
            <span>exploit</span>
            <span className="num text-bone">
              {Math.round((1 - lab.riskAppetite) * 100)} / {Math.round(lab.riskAppetite * 100)}
            </span>
            <span>explore</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-hairline pt-5">
        <Button variant="solid" onClick={runGenerate} disabled={lab.running}>
          run generation
        </Button>
        <span className="text-2xs text-smoke">
          synthesises 5 candidates, each testing one deliberate mutation.
        </span>
      </div>
    </div>
  )
}

// ── STAGE 2 · GENERATE ──────────────────────────────────────────────────────
export function StageGenerate() {
  const lab = useStore((s) => s.lab)
  const runSelect = useStore((s) => s.runSelect)

  return (
    <div className="flex flex-col gap-4 p-5">
      <SectionLabel right={`step 2 of 5 · ${lab.candidates.length}/5`}>population</SectionLabel>
      <p className="text-2xs leading-relaxed text-smoke">
        each candidate inherits the surviving genome and changes one thing deliberately — if
        everything moved at once, nothing could be attributed to anything.
      </p>

      <div className="flex flex-col gap-2.5">
        {lab.candidates.map((c, i) => (
          <CandidateCard key={c.id} candidate={c} index={i} scored={false} />
        ))}
        {lab.running ? (
          <div className="flex items-center gap-2.5 border border-dashed border-hairline p-4">
            <Loader2 size={13} className="animate-spin text-acid" />
            <span className="animate-breathe text-2xs lowercase tracking-lab text-smoke">
              synthesising candidate {String.fromCharCode(65 + lab.candidates.length)}…
            </span>
          </div>
        ) : null}
      </div>

      {!lab.running && lab.candidates.length > 0 ? (
        <div className="flex items-center gap-4 border-t border-hairline pt-4">
          <Button variant="solid" onClick={runSelect}>
            score population
          </Button>
          <span className="text-2xs text-smoke">
            sends all 5 genomes to the historical model for a fitness estimate.
          </span>
        </div>
      ) : null}
    </div>
  )
}

// ── STAGE 3 · SELECT ────────────────────────────────────────────────────────
export function StageSelect() {
  const lab = useStore((s) => s.lab)
  const runSelect = useStore((s) => s.runSelect)
  const setLab = useStore((s) => s.setLab)

  const ordered = useMemo(() => {
    const withIndex = lab.candidates.map((c, i) => ({ c, i }))
    if (lab.scored.size === 0) return withIndex
    return [...withIndex].sort((a, b) => {
      const sa = lab.scored.has(a.c.id) ? a.c.prediction.fitness : -1
      const sb = lab.scored.has(b.c.id) ? b.c.prediction.fitness : -1
      return sb - sa
    })
  }, [lab.candidates, lab.scored])

  const allScored = lab.scored.size === lab.candidates.length && lab.candidates.length > 0

  return (
    <div className="flex flex-col gap-4 p-5">
      <SectionLabel right={`step 3 of 5 · ${lab.scored.size}/${lab.candidates.length} scored`}>
        selection
      </SectionLabel>

      {!allScored && !lab.running ? (
        <Button variant="solid" onClick={runSelect} className="self-start">
          score population
        </Button>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {ordered.map(({ c, i }, rank) => {
          const isSelected = lab.selection?.selectedId === c.id
          return (
            <CandidateCard
              key={c.id}
              candidate={c}
              index={i}
              scored={lab.scored.has(c.id)}
              rank={rank + 1}
              selected={isSelected}
              mode={lab.selection?.mode}
              decayed={Boolean(lab.selection) && !isSelected}
            />
          )
        })}
      </div>

      {lab.selection ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-2 border p-4"
          style={{
            borderColor:
              lab.selection.mode === 'explore' ? 'rgba(88,182,196,0.4)' : 'rgba(199,240,74,0.4)',
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              size={13}
              style={{ color: lab.selection.mode === 'explore' ? C.probe : C.acid }}
            />
            <span
              className="font-display text-xs font-bold tracking-[0.2em]"
              style={{ color: lab.selection.mode === 'explore' ? C.probe : C.acid }}
            >
              {lab.selection.mode.toUpperCase()}
            </span>
          </div>
          <p className="text-2xs leading-relaxed text-bone/80">{lab.selection.reasoning}</p>
          <div className="flex items-center gap-4 pt-2">
            <Button variant="solid" onClick={() => setLab({ stage: 'authorize' })}>
              review & authorize
            </Button>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}

// ── STAGE 4 · REVIEW & AUTHORIZE ────────────────────────────────────────────
export function StageAuthorize() {
  const lab = useStore((s) => s.lab)
  const corpus = useStore((s) => s.corpus)
  const arm = useStore((s) => s.arm)
  const runDeploy = useStore((s) => s.runDeploy)

  const selected = lab.candidates.find((c) => c.id === lab.selection?.selectedId)
  if (!selected) return null

  const f = selected.prediction.fitness
  const projected = {
    views: Math.round(2400 + f * f * 46000),
    likes: Math.round((2400 + f * f * 46000) * (0.06 + f * 0.1)),
    comments: Math.round((2400 + f * f * 46000) * (0.004 + f * 0.01)),
    shares: Math.round((2400 + f * f * 46000) * (0.003 + f * f * 0.048)),
    saves: Math.round((2400 + f * f * 46000) * (0.006 + f * 0.02)),
  }

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-3">
        <SectionLabel right="as it will appear">preview</SectionLabel>
        <PlatformPost platform={lab.platform} content={selected.content} projected={projected} />
        <p className="text-2xs leading-relaxed text-smoke">
          counts shown are the model's projection, not real engagement.
        </p>

        <div className="mt-1 flex flex-col gap-2 border-t border-hairline pt-3">
          <span className="lab-label">genome</span>
          {NUMERIC_TRAITS.map((t) => (
            <Meter
              key={t}
              label={t}
              value={selected.genome[t]}
              dense
              color={
                selected.mutations.some((m) => m.trait === t) ? C.acid : 'rgba(237,232,224,0.7)'
              }
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <SectionLabel right="step 4 of 5">assessment</SectionLabel>
        <ViralOdds exp={selected} corpus={corpus} />

        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <span className="lab-label">agent hypothesis</span>
          <blockquote className="border-l-2 border-acid/40 bg-graphite/50 py-2 pl-3">
            <p className="text-[0.78rem] italic leading-relaxed text-bone/85">
              {selected.hypothesis}
            </p>
          </blockquote>
        </div>

        {/* the gate */}
        <div className="flex flex-col gap-3 border border-rust/40 bg-rust/[0.035] p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} className="mt-px shrink-0 text-rust" />
            <div className="flex flex-col gap-1">
              <span className="font-display text-xs font-bold tracking-[0.16em] text-rust">
                THIS WILL POST TO A REAL ACCOUNT
              </span>
              <p className="text-2xs leading-relaxed text-bone/75">
                deployment publishes this artefact to a live {lab.platform} account under the
                agent's identity, where real people will see it. the agent selected it; a human
                authorises it. that boundary is deliberate and it does not move.
              </p>
              {USE_MOCK ? (
                <p className="mt-1 text-2xs leading-relaxed text-probe">
                  backend is MOCK — nothing leaves this machine. the gate is shown exactly as it
                  behaves against the live backend.
                </p>
              ) : null}
            </div>
          </div>

          <SlideToArm onArm={arm} armed={lab.armed} />

          <div className="flex items-center gap-3">
            <Button variant="danger" onClick={runDeploy} disabled={!lab.armed || lab.running}>
              {lab.running ? 'deploying…' : `deploy to ${lab.platform}`}
            </Button>
            <span className="text-2xs text-smoke">
              {lab.armed ? 'armed — this is the irreversible step.' : 'arm the control first.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── STAGE 5 · OBSERVE ───────────────────────────────────────────────────────
const SAT = (h: number) => 1 - Math.exp(-3.1 * (h / 24))

export function StageObserve() {
  const lab = useStore((s) => s.lab)
  const setObserveHours = useStore((s) => s.setObserveHours)
  const runEvolve = useStore((s) => s.runEvolve)
  const setView = useStore((s) => s.setView)
  const resetLab = useStore((s) => s.resetLab)
  const deployed = lab.deployed

  // On arrival, run the first six hours automatically so the panel is alive.
  useEffect(() => {
    if (!deployed || lab.observeHours > 0) return
    let h = 0
    const id = setInterval(() => {
      h += 0.5
      setObserveHours(h)
      if (h >= 6) clearInterval(id)
    }, 90)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployed?.id])

  if (!deployed) return null

  const f = deployed.observed.fitness ?? deployed.prediction.fitness
  const base = 2400 + f * f * 46000
  const s = SAT(Math.max(0.01, lab.observeHours))
  const live = {
    views: Math.round(base * s),
    likes: Math.round(base * s * (0.06 + f * 0.1)),
    comments: Math.round(base * s * (0.004 + f * 0.01)),
    shares: Math.round(base * s * (0.003 + f * f * 0.048)),
    saves: Math.round(base * s * (0.006 + f * 0.02)),
  }

  const curve = Array.from({ length: 25 }, (_, h) => ({
    h,
    views: h <= lab.observeHours ? Math.round(base * SAT(Math.max(0.01, h))) : null,
    shares:
      h <= lab.observeHours
        ? Math.round(base * SAT(Math.max(0.01, h)) * (0.003 + f * f * 0.048))
        : null,
  }))

  // Fitness converges toward the observed value as observations accumulate.
  const converging = deployed.observed.fitness ?? deployed.prediction.fitness * (0.72 + 0.28 * s)

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-5">
        <SectionLabel right="step 5 of 5">observation</SectionLabel>

        <div className="flex flex-wrap items-end gap-6 border border-hairline p-4">
          <div>
            <span className="lab-label">observed fitness</span>
            <div
              className="num font-display text-[3rem] font-bold leading-none"
              style={{ color: fitnessColor(converging) }}
            >
              {fit(converging)}
            </div>
            <span className="text-2xs text-smoke">
              predicted {fit(deployed.prediction.fitness)} ·{' '}
              <span style={{ color: converging >= deployed.prediction.fitness ? C.acid : C.rust }}>
                {delta(converging - deployed.prediction.fitness)}
              </span>
            </span>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <Ticker label="views" value={live.views} />
            <Ticker label="likes" value={live.likes} />
            <Ticker label="comments" value={live.comments} />
            <Ticker label="shares" value={live.shares} accent />
            <Ticker label="saves" value={live.saves} accent />
            <Ticker label="share rate" value={live.shares / Math.max(1, live.views)} rate />
          </div>
        </div>

        <div className="h-[190px] border border-hairline p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve} margin={{ top: 8, right: 10, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="propFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.acid} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={C.acid} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="h" {...AXIS} tickFormatter={(v) => `${v}h`} />
              <YAxis {...AXIS} tickFormatter={(v) => compact(Number(v))} width={44} />
              <Tooltip
                cursor={{ stroke: 'rgba(237,232,224,0.16)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <TooltipShell>
                      <div className="mb-1 text-2xs tracking-lab text-smoke">
                        {label}h after deploy
                      </div>
                      {payload.map((p) => (
                        <div
                          key={String(p.dataKey)}
                          className="flex justify-between gap-4 text-2xs"
                        >
                          <span className="text-smoke">{String(p.dataKey)}</span>
                          <span className="num text-bone">{full(Number(p.value))}</span>
                        </div>
                      ))}
                    </TooltipShell>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke={C.acid}
                strokeWidth={1.4}
                fill="url(#propFill)"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="shares"
                stroke={C.probe}
                strokeWidth={1.2}
                fill="transparent"
                connectNulls={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="lab-label">demo playback</span>
            <span className="num text-2xs text-smoke">t + {lab.observeHours.toFixed(1)}h</span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={0.5}
            value={lab.observeHours}
            onChange={(e) => setObserveHours(Number(e.target.value))}
            className="w-full accent-[#C7F04A]"
          />
          <div className="flex items-center gap-2">
            {[6, 12, 24].map((h) => (
              <Button key={h} onClick={() => setObserveHours(h)}>
                simulate {h}h
              </Button>
            ))}
            <span className="ml-1 text-2xs text-smoke">
              scrubbed playback of a projected propagation curve — not live data.
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionLabel>write back</SectionLabel>
        <p className="text-2xs leading-relaxed text-smoke">
          recording the observation is what closes the loop: the result updates the agent's beliefs,
          and the next generation is drawn from the updated strategy rather than the old one.
        </p>
        <Button variant="acid" onClick={runEvolve} disabled={lab.running || lab.evolved}>
          {lab.running ? 'evolving…' : lab.evolved ? 'evolved' : 'record & evolve'}
        </Button>

        {lab.evolved ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 border border-acid/40 bg-acid/[0.04] p-3"
          >
            <span className="font-display text-xs font-bold tracking-[0.16em] text-acid">
              GENERATION WRITTEN
            </span>
            <p className="text-2xs leading-relaxed text-bone/75">
              the new specimen is in the tree and the belief chart has moved.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setView('organism')}>see it in the tree</Button>
              <Button onClick={() => setView('mind')}>see what the agent learned</Button>
              <Button onClick={resetLab}>run another generation</Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}

function Ticker({
  label,
  value,
  accent,
  rate,
}: {
  label: string
  value: number
  accent?: boolean
  rate?: boolean
}) {
  const shown = useCountUp(value, 420, true)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="lab-label">{label}</span>
      <span className="num text-lg leading-none" style={{ color: accent ? C.acid : C.bone }}>
        {rate ? `${(shown * 100).toFixed(2)}%` : full(Math.round(shown))}
      </span>
    </div>
  )
}

export type { Experiment }
