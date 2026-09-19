import { useEffect } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Instagram,
  Music2,
  RefreshCw,
  RotateCcw,
  Twitter,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { LabStep } from '@/store/useStore'
import type { Platform } from '@/types'
import { USE_MOCK } from '@/api/client'
import { C, scoreColor } from '@/lib/fitness'
import { PLATFORM_NAMES, plainTrait } from '@/lib/plain'
import { useCountUp } from '@/lib/useCountUp'
import { Badge, Bar, Button, Spinner, cx } from '@/components/ui'
import MemePreview from '@/components/evolution/MemePreview'
import PhonePreview from './PhonePreview'
import EngagementHistory from './EngagementHistory'
import { countText, fitnessText, measuredMetrics } from '@/lib/evidence'

const STEPS: { key: LabStep; label: string }[] = [
  { key: 'setup', label: 'Choose' },
  { key: 'candidates', label: 'AI creates' },
  { key: 'review', label: 'You approve' },
  { key: 'results', label: 'Results' },
]

const PLATFORMS: { key: Platform; icon: typeof Music2; note: string }[] = [
  { key: 'tiktok', icon: Music2, note: 'Short video. Sound matters most.' },
  { key: 'instagram', icon: Instagram, note: 'Reels and carousels. Saves matter most.' },
  { key: 'x', icon: Twitter, note: 'Mostly text. Reposts matter most.' },
]

const TOPICS = [
  'bureaucracy',
  'cs major',
  'campus life',
  'dining hall',
  'group projects',
  'the gym',
]

export default function LabView() {
  const lab = useStore((s) => s.lab)
  const resetLab = useStore((s) => s.resetLab)
  const createMemes = useStore((s) => s.createMemes)
  const currentStep = STEPS.findIndex((s) => s.key === lab.step)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-bold">Run the next generation</h2>
        <p className="max-w-2xl text-[15px] text-muted">
          The agent mutates five candidate genomes, scores them, and selects one for a concept.
          Follow its prediction into a real-world experiment.
        </p>
      </div>

      {/* progress */}
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <span
                className={cx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  done
                    ? 'bg-win text-white'
                    : active
                      ? 'bg-ink text-white'
                      : 'bg-card text-muted ring-1 ring-line',
                )}
              >
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cx(
                  'hidden text-sm font-semibold sm:block',
                  active ? 'text-ink' : 'text-muted',
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 ? (
                <span
                  className={cx(
                    'h-0.5 flex-1 rounded transition-colors',
                    done ? 'bg-win' : 'bg-line',
                  )}
                />
              ) : null}
            </li>
          )
        })}
      </ol>

      {lab.error ? (
        <div className="rounded-2xl border-2 border-dead/40 bg-dead-soft/50 p-5">
          <h3 className="font-display font-bold text-dead">That step could not run</h3>
          <p className="mt-1.5 break-words text-sm leading-relaxed">{lab.error}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            No result was substituted. Retry when the service is available.
          </p>
        </div>
      ) : null}

      {lab.step === 'setup' ? <StepSetup /> : null}
      {lab.step === 'candidates' ? <StepCandidates /> : null}
      {lab.step === 'review' ? <StepReview /> : null}
      {lab.step === 'results' ? <StepResults /> : null}

      {lab.step !== 'setup' ? (
        <button
          type="button"
          onClick={resetLab}
          className="flex items-center gap-2 self-start text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <RotateCcw size={14} />
          Start over
        </button>
      ) : null}

      {/* keeps the primary action reachable even mid-flow */}
      {lab.step === 'setup' ? (
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
          <Button size="lg" onClick={createMemes} disabled={lab.busy}>
            {lab.busy ? <Spinner /> : null}
            Create 5 memes
          </Button>
          <span className="text-sm text-muted">
            Generation may take a moment. Nothing is posted at this step.
          </span>
        </div>
      ) : null}
    </div>
  )
}

/* ── Step 1 ─────────────────────────────────────────────────────────────── */
function StepSetup() {
  const lab = useStore((s) => s.lab)
  const setLab = useStore((s) => s.setLab)

  if (!USE_MOCK)
    return (
      <div className="card grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <h3 className="font-display text-lg font-bold">Five candidate genomes</h3>
          <p className="mt-1 text-sm text-muted">
            The agent controls topic and exploration from its current strategy. Inspect its
            mutations and predictions before approving a concept.
          </p>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">TikTok experiment</h3>
          <p className="mt-1 text-sm text-muted">
            The backend prepares and uploads the selected media. Publication and engagement remain
            pending until confirmed.
          </p>
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">Where should it post?</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLATFORMS.map((p) => {
            const active = lab.platform === p.key
            const Icon = p.icon
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setLab({ platform: p.key })}
                className={cx(
                  'flex flex-col gap-2 rounded-2xl border-2 p-5 text-left transition-all duration-150',
                  active
                    ? 'border-agent bg-agent-soft'
                    : 'border-line bg-card hover:border-ink/20 hover:shadow-card',
                )}
              >
                <Icon size={22} className={active ? 'text-agent' : 'text-muted'} />
                <span className="font-display text-lg font-bold">{PLATFORM_NAMES[p.key]}</span>
                <span className="text-sm leading-snug text-muted">{p.note}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">What should it be about?</h3>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLab({ topic: t })}
              className={cx(
                'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                lab.topic === t
                  ? 'border-agent bg-agent text-white'
                  : 'border-line bg-card text-muted hover:border-ink/20 hover:text-ink',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold">How adventurous should it be?</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              on: false,
              title: 'Play it safe',
              body: 'Stick close to what has already worked. Higher scores, less learned.',
            },
            {
              on: true,
              title: 'Take a risk',
              body: 'Try something it is unsure about. Lower scores, but it learns more.',
            },
          ].map((o) => (
            <button
              key={o.title}
              type="button"
              onClick={() => setLab({ adventurous: o.on })}
              className={cx(
                'rounded-2xl border-2 p-4 text-left transition-all duration-150',
                lab.adventurous === o.on
                  ? 'border-agent bg-agent-soft'
                  : 'border-line bg-card hover:border-ink/20',
              )}
            >
              <span className="font-semibold">{o.title}</span>
              <p className="mt-1 text-sm leading-snug text-muted">{o.body}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Step 2 ─────────────────────────────────────────────────────────────── */
function StepCandidates() {
  const lab = useStore((s) => s.lab)
  const setLab = useStore((s) => s.setLab)

  const ordered = [...lab.candidates].sort((a, b) => {
    const sa = lab.scored.includes(a.id) ? a.prediction.fitness : -1
    const sb = lab.scored.includes(b.id) ? b.prediction.fitness : -1
    return sb - sa
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-bold">
          {lab.busy
            ? `Generating candidates… ${lab.candidates.length} received`
            : lab.selection
              ? 'The agent scored the candidates and selected a winner'
              : 'Awaiting agent selection'}
        </h3>
        <p className="text-sm text-muted">
          Each one changes exactly one thing, so the AI can tell what caused what.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {ordered.map((c) => {
          const isScored = lab.scored.includes(c.id)
          const isPick = lab.selection?.selectedId === c.id
          const beaten = Boolean(lab.selection) && !isPick
          return (
            <div
              key={c.id}
              className={cx(
                'flex animate-pop-in items-center gap-4 rounded-2xl border-2 bg-card p-3 transition-all duration-300',
                isPick ? 'border-win shadow-win' : 'border-line',
                beaten && 'border-line',
              )}
            >
              <MemePreview
                content={c.content}
                ratio="card"
                size="sm"
                faded={beaten}
                showPunchline={false}
                className="w-24 shrink-0 rounded-lg sm:w-28"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="font-semibold leading-snug">{c.content.headline}</p>
                  {isPick ? (
                    <Badge tone="win">
                      {lab.selection?.mode === 'explore' ? 'Chosen — the risky one' : 'Chosen'}
                    </Badge>
                  ) : null}
                </div>
                <p className="mb-1.5 text-sm text-muted">
                  Changed:{' '}
                  <span className="font-medium text-ink">
                    {c.mutations
                      .slice(0, 3)
                      .map((m) => plainTrait(m.trait))
                      .join(', ') || 'nothing'}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {isPick
                    ? c.content.caption
                    : 'Candidate genome · concept generated for the selected candidate only'}
                </p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer font-semibold">View genome</summary>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(c.genome).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-muted">{plainTrait(key)}</dt>
                        <dd className="break-words font-medium">
                          {typeof value === 'number' ? fitnessText(value) : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>
              <ScoreChip fitness={c.prediction.fitness} revealed={isScored} />
            </div>
          )
        })}
        {lab.busy && lab.candidates.length < 5 ? (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line p-6 text-muted">
            <Spinner />
            <span className="text-sm font-medium">Writing the next one…</span>
          </div>
        ) : null}
      </div>

      {lab.selection ? (
        <div className="flex flex-col gap-4 rounded-2xl bg-agent-soft p-5">
          <div>
            <p className="label mb-1 text-agent">Why it picked this one</p>
            <p className="text-[15px] leading-relaxed">
              {USE_MOCK ? plainReason(lab.selection.reasoning) : lab.selection.reasoning}
            </p>
          </div>
          <Button size="lg" className="self-start" onClick={() => setLab({ step: 'review' })}>
            Review it before posting
            <ArrowRight size={16} />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/** The mock writes for a technical reader; soften it for a general one. */
function plainReason(reason: string): string {
  return reason
    .replace(
      /^Exploiting: the leader scores highest at \.?(\d+)/,
      'This scored highest ($1 out of 100)',
    )
    .replace(
      /^Exploring: this candidate scores \.?(\d+) lower than the leader/,
      'This scored a bit lower than the top one',
    )
    .replace(/with \.?(\d+) confidence/, 'and the AI is fairly confident about it')
    .replace(/\(\.?(\d+)\)/, '')
    .replace(/forgone fitness/, 'the points it would give up')
}

function ScoreChip({ fitness, revealed }: { fitness: number; revealed: boolean }) {
  const shown = useCountUp(Number.isFinite(fitness) ? fitness : 0, 700, revealed)
  return (
    <div className="w-28 shrink-0 text-right">
      <p className="text-[11px] font-medium text-muted">Predicted fitness</p>
      <p
        className="num font-display text-3xl font-bold leading-none"
        style={{ color: revealed ? scoreColor(fitness) : '#C9C6BE' }}
      >
        {revealed
          ? Number.isFinite(fitness)
            ? (USE_MOCK ? shown : fitness).toFixed(4)
            : 'Pending'
          : '–'}
      </p>
    </div>
  )
}

/* ── Step 3 ─────────────────────────────────────────────────────────────── */
function StepReview() {
  const lab = useStore((s) => s.lab)
  const setLab = useStore((s) => s.setLab)
  const postIt = useStore((s) => s.postIt)

  const chosen = lab.candidates.find((c) => c.id === lab.selection?.selectedId)
  if (!chosen) return null

  const f = chosen.prediction.fitness
  return (
    <div className="grid gap-8 lg:grid-cols-[290px_1fr]">
      <PhonePreview platform={lab.platform} content={chosen.content} />

      <div className="flex flex-col gap-6">
        <div className="card p-5">
          <Badge tone="win">Selected candidate · {chosen.id}</Badge>
          <p className="label mt-4">Predicted fitness</p>
          <p className="num mt-1 font-display text-4xl font-bold text-guess">{fitnessText(f)}</p>
          <p className="mt-2 text-sm text-muted">
            {USE_MOCK
              ? 'Demo scorer'
              : `Model: ${chosen.prediction.model_version ?? 'not reported by backend'}`}{' '}
            · Confidence {fitnessText(chosen.prediction.confidence)}
          </p>
          <p className="mt-2 text-sm text-muted">
            Model estimate, not a probability or observed engagement.
          </p>
        </div>
        <div className="card p-5">
          <h3 className="font-display text-lg font-bold">Selected concept</h3>
          <p className="mt-2 font-semibold">{chosen.content.headline}</p>
          <p className="mt-2 text-sm">{chosen.content.visual_description}</p>
          <p className="mt-2 text-sm text-muted">Caption: {chosen.content.caption}</p>
          <p className="mt-2 text-sm text-muted">
            {USE_MOCK ? 'Demo concept' : 'Generator provenance not reported by backend'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-bold">Why the AI likes it</h3>
          <div className="rounded-xl border-l-4 border-agent bg-agent-soft/60 px-4 py-3">
            <p className="text-sm leading-relaxed">{chosen.hypothesis}</p>
          </div>
          <div className="flex flex-col gap-2.5 pt-1">
            {(['absurdity', 'relatability', 'trend_relevance'] as const).map((t) => (
              <Bar key={t} label={plainTrait(t)} value={chosen.genome[t]} color={C.agent} />
            ))}
          </div>
        </div>

        {/* the gate */}
        <div className="rounded-2xl border-2 border-dead/40 bg-dead-soft/50 p-5">
          <div className="mb-3 flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-dead" />
            <div>
              <h3 className="font-display text-lg font-bold text-dead">
                Approve the selected concept
              </h3>
              <p className="mt-1 text-sm leading-relaxed">
                Save the candidates and prepare the selected concept for{' '}
                {PLATFORM_NAMES[lab.platform]}. Publishing is a separate step.
              </p>
              {USE_MOCK ? (
                <p className="mt-2 text-sm font-medium text-guess">
                  Right now this is a demo — nothing actually gets posted.
                </p>
              ) : null}
            </div>
          </div>

          <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl bg-white/70 p-3">
            <input
              type="checkbox"
              checked={lab.approved}
              onChange={(e) => setLab({ approved: e.target.checked })}
              className="checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.5l3.5 3.5L13 5%22/></svg>')] mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none rounded border-2 border-ink/30 bg-white transition-colors checked:border-win checked:bg-win checked:bg-center checked:bg-no-repeat"
            />
            <span className="text-sm font-medium">
              I&rsquo;ve read this meme and I approve posting it.
            </span>
          </label>

          <Button
            variant="danger"
            size="lg"
            onClick={postIt}
            disabled={!lab.approved || lab.busy}
            className="w-full sm:w-auto"
          >
            {lab.busy ? <Spinner /> : null}
            Save and review deployment
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Step 4 ─────────────────────────────────────────────────────────────── */
const SAT = (h: number) => 1 - Math.exp(-3.1 * (h / 24))

function StepResults() {
  const lab = useStore((s) => s.lab)
  const setHours = useStore((s) => s.setHours)
  const finish = useStore((s) => s.finish)
  const setView = useStore((s) => s.setView)
  const posted = lab.posted

  // Let the first few hours run on their own so the panel feels alive.
  useEffect(() => {
    if (!USE_MOCK || !posted || lab.hours > 0) return
    let h = 0
    const id = window.setInterval(() => {
      h += 1
      setHours(h)
      if (h >= 8) window.clearInterval(id)
    }, 110)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posted?.id])

  if (!posted) return null

  // A record coming back from the live API can be missing either of these -
  // an experiment stored before a prediction was attached, or one never
  // observed. Reading straight through them white-screens the whole tab.
  const predicted = posted.prediction?.fitness ?? Number.NaN
  const observedFitness = posted.observed?.fitness ?? null
  const f = observedFitness ?? predicted
  const base = 2400 + f * f * 46000
  const s = SAT(Math.max(0.01, lab.hours))
  const simulated = {
    views: Math.round(base * s),
    likes: Math.round(base * s * (0.06 + f * 0.1)),
    comments: Math.round(base * s * (0.004 + f * 0.01)),
    shares: Math.round(base * s * (0.003 + f * f * 0.048)),
    saves: Math.round(base * s * (0.006 + f * 0.02)),
  }
  const live = USE_MOCK ? (lab.live ?? simulated) : (lab.live ?? posted.observed)
  const running = USE_MOCK
    ? (observedFitness ?? predicted * (0.72 + 0.28 * s))
    : (lab.live?.fitness ?? observedFitness)
  const canLearn = USE_MOCK || measuredMetrics(lab.live) !== null
  const diff = running === null ? null : running - predicted
  const done = Boolean(lab.evolveResult)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={done || lab.published?.status === 'live' ? 'win' : 'muted'}>
          {done
            ? 'Learning complete'
            : USE_MOCK
              ? 'Demo simulation'
              : lab.published?.status === 'live'
                ? 'Published'
                : lab.published
                  ? 'Awaiting publication'
                  : 'Not deployed yet'}
        </Badge>
        <h3 className="font-display text-lg font-bold">&ldquo;{posted.content.headline}&rdquo;</h3>
      </div>

      <PublishPanel />

      <div className="card flex flex-wrap items-end gap-8 p-6">
        <div>
          <p className="label">{USE_MOCK ? 'Simulated fitness' : 'Observed fitness'}</p>
          <p
            className="num font-display text-6xl font-bold leading-none"
            style={{ color: running === null ? C.muted : C.ink }}
          >
            {running === null ? 'Pending' : fitnessText(running)}
          </p>
          <p className="mt-1.5 text-sm text-muted">
            Predicted {fitnessText(predicted)}
            {diff !== null && Number.isFinite(diff) ? (
              <span>
                {' '}
                · Difference {diff >= 0 ? '+' : ''}
                {diff.toFixed(4)}
              </span>
            ) : (
              ' · Awaiting engagement'
            )}
          </p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          {(
            [
              ['Views', live.views, false],
              ['Likes', live.likes, false],
              ['Comments', live.comments, false],
              ['Shares', live.shares, true],
              ['Saves', live.saves, true],
            ] as [string, number | null, boolean][]
          ).map(([k, v, hot]) => (
            <Ticker key={k} label={k} value={v} hot={hot} />
          ))}
        </div>
      </div>

      {USE_MOCK ? (
        <div className="card flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <p className="label">Fast-forward the results</p>
            <span className="num text-sm font-semibold">{lab.hours} hours after posting</span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={lab.hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-full accent-[#6D4AFF]"
          />
          <p className="text-xs text-muted">
            A demo fast-forward through a projected 24 hours, not live data.
          </p>
        </div>
      ) : null}

      <EngagementHistory id={posted.id} />

      {!done ? (
        <div className="card flex flex-col items-start gap-3 bg-agent-soft/50 p-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Teach the AI what happened</h3>
            <p className="text-sm text-muted">
              {USE_MOCK
                ? 'This updates demo beliefs using simulated observations.'
                : canLearn
                  ? 'Use the retrieved engagement to update agent beliefs.'
                  : 'Awaiting all five engagement counts. Missing measurements remain pending.'}
            </p>
          </div>
          <Button size="lg" onClick={finish} disabled={lab.busy || !canLearn}>
            {lab.busy ? <Spinner /> : null}
            Update the AI
          </Button>
        </div>
      ) : (
        <div className="card flex flex-col gap-4 border-win bg-win-soft/50 p-6">
          <h3 className="font-display text-lg font-bold text-win-deep">The AI updated itself</h3>
          <div className="flex flex-col gap-2.5">
            {lab.evolveResult!.shifts.slice(0, 4).map((sh) => (
              <div key={sh.trait} className="flex items-center gap-3 text-sm">
                <span
                  className="w-5 shrink-0 text-center font-bold"
                  style={{ color: sh.delta > 0 ? C.win : C.dead }}
                >
                  {sh.delta > 0 ? '↑' : '↓'}
                </span>
                <span className="w-32 shrink-0 font-medium">{plainTrait(sh.trait)}</span>
                <span className="num text-muted">
                  {Math.round(sh.from * 100)} →{' '}
                  <strong className="text-ink">{Math.round(sh.to * 100)}</strong>
                </span>
              </div>
            ))}
          </div>
          {!lab.evolveResult!.shifts.length ? (
            <p className="text-sm">No belief changes reported.</p>
          ) : null}
          <p className="text-sm">{lab.evolveResult!.next.note}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button onClick={() => useStore.getState().createMemes()}>
              Generate the next candidates
            </Button>
            <Button onClick={() => setView('learned')}>See everything it has learned</Button>
            <Button variant="secondary" onClick={() => setView('evolution')}>
              See it in the family tree
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Publishing and metric retrieval are performed by the backend. */
function PublishPanel() {
  const lab = useStore((s) => s.lab)
  const publishForReal = useStore((s) => s.publishForReal)
  const refreshLive = useStore((s) => s.refreshLive)
  const live = lab.live

  if (!lab.published) {
    return (
      <div className="card flex flex-col gap-3 border-agent/40 bg-agent-soft/40 p-5">
        <div>
          <h3 className="font-display text-lg font-bold">Put it on a real account</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Nothing has been published yet. The backend prepares the media and sends it to the
            connected {PLATFORM_NAMES[lab.platform]} account. Await its response for upload status.
          </p>
        </div>

        {lab.platform === 'tiktok' ? (
          <div className="rounded-xl bg-mid-soft px-3 py-2.5 text-sm leading-relaxed">
            <strong>TikTok inbox upload.</strong> After upload, follow the backend instructions to
            finish publishing in TikTok. An upload ID alone does not confirm a public post.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="danger" onClick={publishForReal} disabled={lab.busy}>
            {lab.busy ? <Spinner /> : null}
            Publish to {PLATFORM_NAMES[lab.platform]}
          </Button>
          {USE_MOCK ? (
            <span className="text-sm text-muted">
              Demo mode — this simulates a publish, nothing is posted anywhere.
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  const waiting = lab.published.status === 'awaiting_user'

  return (
    <div
      className={cx(
        'card flex flex-col gap-4 p-5',
        waiting ? 'border-mid bg-mid-soft/50' : 'border-win bg-win-soft/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className={cx('font-display text-lg font-bold', waiting ? 'text-ink' : 'text-win-deep')}
          >
            {waiting
              ? `Waiting in your ${PLATFORM_NAMES[lab.published.platform]} drafts`
              : `Published to ${PLATFORM_NAMES[lab.published.platform]}`}
          </h3>
          <p className="num mt-1 text-sm text-muted">
            {waiting ? 'upload' : 'post'} {lab.published.post_id}
          </p>
        </div>
        {lab.published.permalink ? (
          <a
            href={lab.published.permalink}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold transition-colors hover:bg-paper"
          >
            View the live post
            <ExternalLink size={14} />
          </a>
        ) : null}
      </div>

      {waiting && lab.published.instructions ? (
        <p className="rounded-xl bg-white/70 p-3 text-sm leading-relaxed">
          {lab.published.instructions}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line/60 pt-3">
        <Button variant="secondary" onClick={refreshLive} disabled={lab.fetching}>
          {lab.fetching ? <Spinner /> : <RefreshCw size={14} />}
          Pull the real numbers
        </Button>
        {live ? (
          <span className="text-sm text-muted">
            Checked {new Date(live.fetched_at).toLocaleTimeString()} ·{' '}
            <strong className="text-ink">{countText(live.views)}</strong> views,{' '}
            <strong className="text-ink">{countText(live.shares)}</strong> shares
          </span>
        ) : (
          <span className="text-sm text-muted">
            {waiting
              ? 'Once you have tapped Post, give it a few hours and then pull the counts.'
              : 'Give it a few hours, then pull the counts the platform reports.'}
          </span>
        )}
      </div>

      {live ? (
        <p className="text-sm leading-relaxed text-muted">
          {USE_MOCK
            ? 'These are simulated demo measurements.'
            : 'These measurements were returned by the backend. Learning waits until all required counts are available.'}
        </p>
      ) : null}
    </div>
  )
}

function Ticker({ label, value, hot }: { label: string; value: number | null; hot?: boolean }) {
  const shown = useCountUp(value ?? 0, 400, true)
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="num font-display text-xl font-bold" style={{ color: hot ? C.win : C.ink }}>
        {value === null
          ? 'Pending'
          : USE_MOCK
            ? Math.round(shown).toLocaleString()
            : countText(value)}
      </p>
    </div>
  )
}
