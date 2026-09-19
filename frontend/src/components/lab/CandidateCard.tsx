import { motion } from 'framer-motion'
import type { Experiment } from '@/types'
import { C, fitnessColor } from '@/lib/fitness'
import { fit, titleize, traitDelta } from '@/lib/format'
import { useCountUp } from '@/lib/useCountUp'
import { Chip, cx } from '@/components/common/ui'
import MediaFrame from '@/components/common/MediaFrame'

export default function CandidateCard({
  candidate,
  index,
  scored,
  rank,
  selected,
  mode,
  decayed,
}: {
  candidate: Experiment
  index: number
  scored: boolean
  rank?: number
  selected?: boolean
  mode?: 'exploit' | 'explore'
  decayed?: boolean
}) {
  const letter = String.fromCharCode(65 + index)
  const shown = useCountUp(candidate.prediction.fitness, 780, scored)
  const color = fitnessColor(candidate.prediction.fitness)
  const ci = (1 - candidate.prediction.confidence) * 0.22

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
      animate={{
        opacity: decayed ? 0.26 : 1,
        y: 0,
        filter: decayed ? 'blur(0.6px) grayscale(0.7)' : 'blur(0px)',
      }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1], layout: { duration: 0.5 } }}
      className={cx(
        'relative flex gap-3 border bg-carbon p-3 transition-colors',
        selected ? 'border-acid/70' : 'border-hairline',
      )}
      style={selected ? { boxShadow: `0 0 28px -12px ${C.acid}` } : undefined}
    >
      {selected ? (
        <span
          className="absolute -top-px left-0 h-px w-full"
          style={{ background: mode === 'explore' ? C.probe : C.acid }}
        />
      ) : null}

      <div className="w-[62px] shrink-0">
        <MediaFrame content={candidate.content} muted={decayed} size="xs" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="num text-2xs tracking-[0.18em] text-bone/60">CANDIDATE {letter}</span>
          {rank !== undefined && scored ? (
            <span className="num text-2xs text-smoke">rank {rank}</span>
          ) : null}
          {selected ? (
            <Chip tone={mode === 'explore' ? 'probe' : 'acid'}>
              {mode === 'explore' ? 'explore' : 'exploit'} · selected
            </Chip>
          ) : null}
        </div>

        <p
          className="truncate font-display text-[0.8rem] leading-snug text-bone"
          title={candidate.content.headline}
        >
          {candidate.content.headline}
        </p>

        <p className="line-clamp-2 text-2xs leading-relaxed text-smoke">
          {candidate.content.visual_description}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-2xs lowercase tracking-lab text-smoke">mutating</span>
          {candidate.mutations.slice(0, 3).map((m) => (
            <Chip key={m.trait} tone="acid" title={`${m.from} → ${m.to}`}>
              {titleize(m.trait)}
              {typeof m.from === 'number' && typeof m.to === 'number'
                ? ` ${traitDelta((m.to as number) - (m.from as number))}`
                : ''}
            </Chip>
          ))}
          {candidate.mutations.length > 3 ? (
            <span className="num text-2xs text-smoke">+{candidate.mutations.length - 3}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-0.5 text-2xs text-smoke">
          <span>
            caption · <span className="text-bone/70">{candidate.content.caption}</span>
          </span>
          <span>
            audio · <span className="text-bone/70">{candidate.content.audio}</span>
          </span>
        </div>
      </div>

      {/* score column */}
      <div className="flex w-[84px] shrink-0 flex-col items-end justify-center gap-1 border-l border-hairline pl-3">
        <span className="lab-label">predicted</span>
        <span
          className="num font-display text-[1.7rem] font-bold leading-none"
          style={{ color: scored ? color : C.smoke }}
        >
          {scored ? fit(shown) : '—'}
        </span>
        {scored ? (
          <>
            <span className="num text-2xs text-smoke">±{fit(ci)}</span>
            <span className="relative mt-1 h-[3px] w-full bg-[rgba(237,232,224,0.07)]">
              <span
                className="absolute inset-y-0"
                style={{
                  left: `${Math.max(0, candidate.prediction.fitness - ci) * 100}%`,
                  width: `${Math.min(1, ci * 2) * 100}%`,
                  background: `${color}44`,
                }}
              />
              <span
                className="absolute top-[-3px] h-[9px] w-[2px]"
                style={{ left: `${candidate.prediction.fitness * 100}%`, background: color }}
              />
            </span>
            <span className="num text-2xs text-smoke">
              conf {fit(candidate.prediction.confidence)}
            </span>
          </>
        ) : (
          <span className="animate-breathe text-2xs lowercase tracking-lab text-smoke">
            scoring…
          </span>
        )}
      </div>
    </motion.article>
  )
}
