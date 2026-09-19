import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { Experiment } from '@/types'
import {
  ANOMALY_THRESHOLD,
  C,
  CATEGORICAL_TRAITS,
  NUMERIC_TRAITS,
  effectiveFitness,
  fitnessColor,
  surprise,
} from '@/lib/fitness'
import { compact, delta, elapsed, fit, full, titleize, traitDelta, traitNum } from '@/lib/format'
import {
  BigNum,
  Chip,
  DivergingBar,
  Meter,
  SectionLabel,
  StatusChip,
  cx,
} from '@/components/common/ui'
import MediaFrame from '@/components/common/MediaFrame'

const PLATFORM_LABEL: Record<string, string> = { tiktok: 'tiktok', instagram: 'instagram', x: 'x' }

export default function SpecimenPanel() {
  const selectedId = useStore((s) => s.selectedId)
  const experiments = useStore((s) => s.experiments)
  const select = useStore((s) => s.select)
  const exp = experiments.find((e) => e.id === selectedId) ?? null

  return (
    <AnimatePresence mode="wait">
      {exp ? (
        <motion.aside
          key={exp.id}
          initial={{ x: 34, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 34, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          /* Below lg the panel floats over the canvas. Letting it sit in flow
             on a narrow screen leaves the tree with almost nothing. */
          className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[420px] flex-col border-l border-hairline bg-carbon shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.9)] lg:relative lg:z-20 lg:w-[420px] lg:shrink-0 lg:shadow-none"
        >
          <Header exp={exp} onClose={() => select(null)} />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            <Body exp={exp} onNavigate={select} />
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}

function Header({ exp, onClose }: { exp: Experiment; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="num text-2xs tracking-[0.16em] text-smoke">
          GENERATION {exp.generation} · EXPERIMENT {exp.id.replace('exp_', '#')}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip status={exp.status} />
          {exp.deployment.platform ? (
            <Chip>{PLATFORM_LABEL[exp.deployment.platform]}</Chip>
          ) : (
            <Chip>not deployed</Chip>
          )}
          {exp.deployment.timestamp ? <Chip>{elapsed(exp.deployment.timestamp)} ago</Chip> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 border border-hairline p-1 text-smoke transition-colors hover:border-hairline-strong hover:text-bone"
        title="close (esc)"
      >
        <X size={12} />
      </button>
    </div>
  )
}

function Body({ exp, onNavigate }: { exp: Experiment; onNavigate: (id: string) => void }) {
  const s = surprise(exp)
  const anomaly = s !== null && Math.abs(s) >= ANOMALY_THRESHOLD
  const f = effectiveFitness(exp)
  const attrScale = Math.max(
    0.1,
    ...exp.prediction.feature_attribution.map((a) => Math.abs(a.contribution)),
  )

  return (
    <div className="flex flex-col gap-5 pt-4">
      {/* the specimen itself */}
      <div className="flex gap-3">
        <div className="w-[38%] shrink-0">
          <MediaFrame content={exp.content} muted={exp.status === 'extinct'} size="sm" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-display text-sm leading-snug text-bone">{exp.content.headline}</p>
          <p className="text-2xs leading-relaxed text-smoke">{exp.content.visual_description}</p>
          <div className="mt-auto flex flex-col gap-1 pt-1">
            <span className="text-2xs text-bone/60">
              <span className="text-smoke">caption · </span>
              {exp.content.caption}
            </span>
            <span className="text-2xs text-bone/60">
              <span className="text-smoke">audio · </span>
              {exp.content.audio}
            </span>
          </div>
        </div>
      </div>

      {/* ancestor */}
      <div className="flex flex-col gap-2">
        <SectionLabel>ancestor</SectionLabel>
        {exp.parent_id ? (
          <button
            type="button"
            onClick={() => onNavigate(exp.parent_id!)}
            className="group flex w-full items-center justify-between border border-hairline px-3 py-2 transition-colors hover:border-hairline-strong hover:bg-graphite"
          >
            <span className="num text-2xs tracking-[0.12em] text-bone/80">
              {exp.parent_id.replace('exp_', '#')}
            </span>
            <span className="flex items-center gap-1 text-2xs lowercase tracking-lab text-smoke group-hover:text-acid">
              inspect lineage
              <ArrowUpRight size={11} />
            </span>
          </button>
        ) : (
          <p className="text-2xs text-smoke">none — seeded directly from the historical corpus.</p>
        )}
      </div>

      {/* genome */}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>genome</SectionLabel>
        <div className="flex flex-col gap-2">
          {NUMERIC_TRAITS.map((t) => {
            const mutated = exp.mutations.find((m) => m.trait === t)
            return (
              <Meter
                key={t}
                label={t}
                value={exp.genome[t]}
                color={mutated ? C.acid : 'rgba(237,232,224,0.72)'}
                ghost={mutated && typeof mutated.from === 'number' ? mutated.from : undefined}
              />
            )
          })}
          <div className="grid grid-cols-[104px_1fr_48px] items-center gap-3">
            <span className="text-2xs lowercase tracking-lab text-smoke">caption len</span>
            <span className="h-px w-full bg-[rgba(237,232,224,0.07)]" />
            <span className="num text-right text-lab text-bone/90">
              {exp.genome.caption_length}w
            </span>
          </div>
          <div className="grid grid-cols-[104px_1fr_48px] items-center gap-3">
            <span className="text-2xs lowercase tracking-lab text-smoke">video len</span>
            <span className="h-px w-full bg-[rgba(237,232,224,0.07)]" />
            <span className="num text-right text-lab text-bone/90">{exp.genome.video_length}s</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {CATEGORICAL_TRAITS.map((t) => {
            const mutated = exp.mutations.some((m) => m.trait === t)
            return (
              <Chip key={t} tone={mutated ? 'acid' : 'neutral'} title={titleize(t)}>
                {titleize(String(exp.genome[t]))}
              </Chip>
            )
          })}
        </div>
      </div>

      {/* mutations */}
      <div className="flex flex-col gap-2">
        <SectionLabel right={`${exp.mutations.length} changed`}>mutations</SectionLabel>
        {exp.mutations.length === 0 ? (
          <p className="text-2xs text-smoke">no change from the ancestor genome.</p>
        ) : (
          <div className="flex flex-col">
            {exp.mutations.map((m) => {
              const numeric = typeof m.from === 'number' && typeof m.to === 'number'
              const d = numeric ? (m.to as number) - (m.from as number) : null
              const up = d !== null && d > 0
              // For text_density and video_length, lower is what the agent wants —
              // colour by direction of change, not by desirability.
              const color = d === null ? C.probe : up ? C.acid : C.rust
              return (
                <div
                  key={m.trait}
                  className="grid grid-cols-[104px_1fr_auto] items-baseline gap-3 border-b border-hairline py-1.5 last:border-b-0"
                >
                  <span className="truncate text-2xs lowercase tracking-lab text-smoke">
                    {titleize(m.trait)}
                  </span>
                  <span className="num text-lab text-bone/80">
                    {numeric ? traitNum(m.from as number) : titleize(String(m.from))}
                    <span className="mx-1.5 text-smoke">→</span>
                    <span className="text-bone">
                      {numeric ? traitNum(m.to as number) : titleize(String(m.to))}
                    </span>
                  </span>
                  <span className="num text-right text-lab" style={{ color }}>
                    {d === null ? '↻' : `${up ? '▲' : '▼'} ${traitDelta(d)}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* hypothesis — the agent thinking out loud */}
      <div className="flex flex-col gap-2">
        <SectionLabel>agent hypothesis</SectionLabel>
        <blockquote className="border-l-2 border-acid/40 bg-graphite/50 py-2 pl-3 pr-2">
          <p className="text-[0.78rem] italic leading-relaxed text-bone/85">{exp.hypothesis}</p>
        </blockquote>
      </div>

      {/* predicted vs observed */}
      <div className="flex flex-col gap-3">
        <SectionLabel right={anomaly ? undefined : 'calibration'}>
          predicted vs observed
        </SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-hairline p-3">
            <BigNum
              label="predicted"
              value={exp.status === 'pending' ? '—' : fit(exp.prediction.fitness)}
              color={C.probe}
              sub={
                exp.status === 'pending'
                  ? 'awaiting model'
                  : `confidence ${fit(exp.prediction.confidence)}`
              }
            />
          </div>
          <div
            className="border p-3"
            style={{ borderColor: anomaly ? 'rgba(196,80,46,0.42)' : 'rgba(237,232,224,0.08)' }}
          >
            <BigNum
              label="observed"
              value={exp.observed.fitness === null ? '—' : fit(exp.observed.fitness)}
              color={exp.observed.fitness === null ? C.smoke : fitnessColor(f, exp.status)}
              sub={
                exp.observed.fitness === null
                  ? exp.status === 'deployed'
                    ? 'still accumulating'
                    : 'not deployed'
                  : `${compact(exp.observed.views)} views`
              }
            />
          </div>
        </div>

        {s !== null ? (
          <div
            className={cx(
              'flex items-center justify-between border px-3 py-2',
              anomaly ? 'bg-rust/5' : '',
            )}
            style={{ borderColor: anomaly ? 'rgba(196,80,46,0.42)' : 'rgba(237,232,224,0.08)' }}
          >
            <div className="flex items-center gap-2">
              {anomaly ? (
                <span className="border border-rust/60 px-1.5 py-px text-2xs tracking-[0.18em] text-rust">
                  ANOMALY
                </span>
              ) : (
                <span className="lab-label">delta</span>
              )}
              <span className="text-2xs text-smoke">
                {s >= 0 ? 'reality beat the model' : 'the model was too optimistic'}
              </span>
            </div>
            <span
              className="num font-display text-lg font-bold leading-none"
              style={{ color: s >= 0 ? C.acid : C.rust }}
            >
              {delta(s)}
            </span>
          </div>
        ) : null}
      </div>

      {/* raw metrics */}
      <div className="flex flex-col gap-2">
        <SectionLabel right={exp.deployment.post_id ? `post ${exp.deployment.post_id}` : undefined}>
          observed
        </SectionLabel>
        {exp.observed.views === null ? (
          <p className="text-2xs text-smoke">
            no engagement recorded — this specimen has not been deployed.
          </p>
        ) : (
          <div className="flex flex-col">
            {(
              [
                ['views', exp.observed.views],
                ['likes', exp.observed.likes],
                ['comments', exp.observed.comments],
                ['shares', exp.observed.shares],
                ['saves', exp.observed.saves],
              ] as [string, number | null][]
            ).map(([k, v]) => {
              const rate = v !== null && exp.observed.views ? v / exp.observed.views : null
              const propagation = k === 'shares' || k === 'saves'
              return (
                <div
                  key={k}
                  className="grid grid-cols-[1fr_auto_86px] items-baseline gap-3 border-b border-hairline py-1.5 last:border-b-0"
                >
                  <span
                    className={cx(
                      'text-2xs lowercase tracking-lab',
                      propagation ? 'text-bone/70' : 'text-smoke',
                    )}
                  >
                    {k}
                    {propagation ? <span className="ml-1 text-acid/60">·</span> : null}
                  </span>
                  <span className="num text-2xs text-smoke">
                    {k !== 'views' && rate !== null ? `${(rate * 100).toFixed(1)}%` : ''}
                  </span>
                  <span className="num text-right text-lab text-bone">{full(v)}</span>
                </div>
              )
            })}
            <p className="pt-2 text-2xs leading-relaxed text-smoke">
              fitness is propagation-weighted, not reach-weighted — shares and saves carry most of
              the score, so a small account that gets re-sent outranks a large one that merely gets
              seen.
            </p>
          </div>
        )}
      </div>

      {/* attribution */}
      {exp.prediction.feature_attribution.length ? (
        <div className="flex flex-col gap-2.5">
          <SectionLabel>why the model liked this</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {exp.prediction.feature_attribution.map((a) => (
              <DivergingBar
                key={a.feature}
                label={a.feature}
                value={a.contribution}
                scale={attrScale}
              />
            ))}
          </div>
          <p className="text-2xs leading-relaxed text-smoke">
            contributions to the predicted fitness, relative to the corpus baseline.
          </p>
        </div>
      ) : null}
    </div>
  )
}
