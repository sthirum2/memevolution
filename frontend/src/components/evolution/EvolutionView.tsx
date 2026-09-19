import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Trophy } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { Experiment } from '@/types'
import { effectiveFitness, scoreColor, surprise } from '@/lib/fitness'
import { oneIn, score, shareRate } from '@/lib/plain'
import { Button, Section, cx } from '@/components/ui'
import LineageRibbon from './LineageRibbon'
import MemeCard from './MemeCard'
import MemeDetail from './MemeDetail'

/** One plain sentence describing what happened in a generation. */
function summarise(rows: Experiment[], gen: number): string {
  if (gen === 0) {
    return 'Before it ran any experiments of its own, the AI started from what already worked in millions of real posts.'
  }
  const done = rows.filter((e) => e.observed.fitness !== null)
  const winner = rows.find((e) => e.status === 'survived')
  const live = rows.find((e) => e.status === 'deployed')

  if (!done.length) {
    return `The AI wrote ${rows.length} new memes. None have been posted yet.`
  }
  if (live && !winner) {
    return `The AI wrote ${rows.length} new memes and posted one. Results are still coming in.`
  }
  if (!winner) return `The AI tried ${rows.length} memes in this round.`

  const shock = done.reduce<Experiment | null>((acc, e) => {
    const s = Math.abs(surprise(e) ?? 0)
    return s > Math.abs(surprise(acc ?? e) ?? 0) || !acc ? e : acc
  }, null)
  const shockAmount = shock ? surprise(shock) : null

  let sentence = `The AI tried ${rows.length} memes. "${winner.content.headline}" spread furthest with a score of ${score(effectiveFitness(winner))}, so it became the parent of the next round.`

  if (shock && shockAmount !== null && Math.abs(shockAmount) >= 0.15) {
    sentence +=
      shockAmount > 0
        ? ` "${shock.content.headline}" did ${Math.round(shockAmount * 100)} points better than the AI expected.`
        : ` "${shock.content.headline}" did ${Math.abs(Math.round(shockAmount * 100))} points worse than the AI expected — its biggest miss.`
  }
  return sentence
}

/** How much more often people re-send its memes now than at the start. */
function passOnGain(first: Experiment, best: Experiment): string | null {
  const a = shareRate(first)
  const b = shareRate(best)
  if (!a || !b || a <= 0) return null
  const x = b / a
  return x < 1.1 ? null : x.toFixed(1).replace(/\.0$/, '')
}

function HeroStat({
  label,
  value,
  color,
  caption,
}: {
  label: string
  value: number | null
  color: string
  caption: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <span className="num font-display text-5xl font-bold leading-none" style={{ color }}>
        {value ?? '–'}
      </span>
      <span className="text-sm leading-snug text-muted">{caption}</span>
    </div>
  )
}

export default function EvolutionView() {
  const experiments = useStore((s) => s.experiments)
  const selectedGen = useStore((s) => s.selectedGen)
  const setSelectedGen = useStore((s) => s.setSelectedGen)
  const openId = useStore((s) => s.openId)
  const open = useStore((s) => s.open)
  const setView = useStore((s) => s.setView)

  const [playing, setPlaying] = useState(false)
  const timer = useRef<number>()

  const gens = useMemo(
    () => [...new Set(experiments.map((e) => e.generation))].sort((a, b) => a - b),
    [experiments],
  )
  const rows = useMemo(
    () =>
      experiments
        .filter((e) => e.generation === selectedGen)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [experiments, selectedGen],
  )

  // Autoplay walks through the generations so the story tells itself.
  useEffect(() => {
    if (!playing) return
    timer.current = window.setInterval(() => {
      const current = useStore.getState().selectedGen
      const i = gens.indexOf(current)
      if (i >= gens.length - 1) {
        setPlaying(false)
        return
      }
      setSelectedGen(gens[i + 1])
    }, 2600)
    return () => window.clearInterval(timer.current)
  }, [playing, gens, setSelectedGen])

  const startPlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    setSelectedGen(gens[0])
    open(null)
    setPlaying(true)
  }

  const openExp = experiments.find((e) => e.id === openId) ?? null
  const parent = openExp?.parent_id
    ? (experiments.find((e) => e.id === openExp.parent_id) ?? null)
    : null

  const best = useMemo(
    () =>
      [...experiments]
        .filter((e) => e.observed.fitness !== null)
        .sort((a, b) => (b.observed.fitness ?? 0) - (a.observed.fitness ?? 0))[0],
    [experiments],
  )
  const first = experiments.find((e) => e.generation === 0)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      {/* headline result — the one thing a judge should leave with */}
      {best && first ? (
        <section className="card flex flex-col gap-5 p-6">
          <div>
            <h2 className="font-display text-2xl font-bold leading-snug">
              {passOnGain(first, best)
                ? `After ${gens.length - 1} rounds, its memes get passed on ${passOnGain(first, best)}\u00d7 more often.`
                : `The AI ran ${gens.length - 1} rounds of experiments.`}
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
              Every meme gets a{' '}
              <strong className="font-semibold text-ink">spread score out of 100</strong>. It
              measures how often people <em>pass a meme on</em> — not how many people see it.
            </p>
          </div>

          <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <HeroStat
              label="Where it started"
              value={score(first.observed.fitness ?? first.prediction.fitness)}
              color="#71716B"
              caption={
                oneIn(first.observed.shares, first.observed.views)
                  ? `${oneIn(first.observed.shares, first.observed.views)} people who saw it shared it`
                  : 'Copying what already worked'
              }
            />
            <HeroStat
              label="Where it got to"
              value={score(best.observed.fitness)}
              color="#15A34A"
              caption={
                oneIn(best.observed.shares, best.observed.views)
                  ? `${oneIn(best.observed.shares, best.observed.views)} people who saw it shared it`
                  : `After ${gens.length - 1} rounds`
              }
            />
            <div className="flex flex-col gap-1.5">
              <span className="label">Its best meme</span>
              <span className="font-display text-base font-bold leading-snug">
                &ldquo;{best.content.headline}&rdquo;
              </span>
              <button
                type="button"
                onClick={() => open(best.id)}
                className="self-start text-sm font-semibold text-agent underline-offset-2 hover:underline"
              >
                See why it worked →
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <Section
        title="Every meme it has ever made"
        subtitle="Each round the AI writes new memes, posts the most promising one, and keeps whichever spread furthest. That winner becomes the parent of the next round."
        right={
          <Button variant={playing ? 'secondary' : 'primary'} onClick={startPlay}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? 'Pause' : 'Play the whole story'}
          </Button>
        }
      >
        <div className="card p-3">
          <LineageRibbon
            experiments={experiments}
            generations={gens}
            selected={selectedGen}
            onSelect={(g) => {
              setPlaying(false)
              setSelectedGen(g)
            }}
          />
        </div>
      </Section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-2xl font-bold">
              {selectedGen === 0 ? 'Starting point' : `Round ${selectedGen}`}
            </h3>
            {rows.some((e) => e.status === 'survived') ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-win-soft px-3 py-1 text-xs font-semibold text-win-deep">
                <Trophy size={13} />
                Winner shown in green
              </span>
            ) : null}
          </div>
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            {summarise(rows, selectedGen)}
          </p>
        </div>

        <div
          key={selectedGen}
          className="grid animate-pop-in gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {rows.map((e) => (
            <MemeCard key={e.id} exp={e} onOpen={() => open(e.id)} />
          ))}
        </div>

        {/* colour key only — the hero above already explains the score */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          <span className="font-semibold text-ink">Spread score</span>
          {(
            [
              [80, 'got passed around'],
              [55, 'did okay'],
              [25, 'nobody shared it'],
            ] as [number, string][]
          ).map(([v, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: scoreColor(v / 100) }}
              />
              {l}
            </span>
          ))}
        </div>
      </section>

      <div
        className={cx(
          'card flex flex-col items-start gap-3 bg-agent-soft/50 p-6 sm:flex-row sm:items-center',
        )}
      >
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold">Want to run the next round yourself?</h3>
          <p className="text-sm text-muted">
            Pick a platform and watch the AI write five new memes, score them, and choose one.
          </p>
        </div>
        <Button onClick={() => setView('lab')}>Try it →</Button>
      </div>

      <MemeDetail
        exp={openExp}
        parent={parent}
        onClose={() => open(null)}
        onOpenParent={(id) => open(id)}
      />
    </div>
  )
}
