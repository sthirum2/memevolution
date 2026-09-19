import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { Experiment } from '@/types'
import {
  C,
  effectiveFitness,
  fitnessColor,
  isAnomaly,
  nodeScale,
  opacityFor,
  pulseSeconds,
  surprise,
} from '@/lib/fitness'
import { fit, delta } from '@/lib/format'
import { NODE_H, NODE_W } from '@/lib/layout'
import { useStore } from '@/store/useStore'
import { cx } from '@/components/common/ui'

export type SpecimenData = { exp: Experiment }
export type SpecimenNodeType = Node<SpecimenData, 'specimen'>

function SpecimenNode({ data }: NodeProps<SpecimenNodeType>) {
  const { exp } = data
  const selectedId = useStore((s) => s.selectedId)
  const replayGen = useStore((s) => s.replayGen)

  const f = effectiveFitness(exp)
  const color = fitnessColor(f, exp.status)
  const isSelected = selectedId === exp.id
  const scale = nodeScale(f)
  const dead = exp.status === 'extinct'
  const live = exp.status === 'deployed'
  const unscored = exp.status === 'pending'
  const guess = exp.status === 'predicted'
  const anomaly = isAnomaly(exp)
  const s = surprise(exp)

  // During replay, generations that have not arrived yet are simply absent.
  const revealed = replayGen === null || exp.generation <= replayGen
  const lineage = exp.status === 'survived' || live

  return (
    <div
      className="transition-all duration-500 ease-out"
      style={{
        width: NODE_W,
        height: NODE_H,
        transform: `scale(${revealed ? scale : scale * 0.86})`,
        opacity: revealed ? opacityFor(exp.status) : 0,
        filter: revealed ? 'none' : 'blur(5px)',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      {/* living glow — faster pulse the fitter the specimen */}
      {!dead && !unscored ? (
        <div
          className="pointer-events-none absolute -inset-[7px] animate-specimen-pulse"
          style={{
            background: `radial-gradient(ellipse at center, ${color}2E 0%, transparent 68%)`,
            animationDuration: `${pulseSeconds(f)}s`,
          }}
          aria-hidden
        />
      ) : null}

      <div
        className={cx(
          'relative flex h-full w-full flex-col overflow-hidden bg-carbon transition-all duration-300',
          isSelected && 'ring-1 ring-offset-0',
        )}
        style={{
          border: `${lineage ? 2 : 1}px ${unscored ? 'dashed' : 'solid'} ${
            isSelected
              ? C.bone
              : guess
                ? C.probe
                : dead
                  ? 'rgba(196,80,46,0.45)'
                  : `${color}${lineage ? 'CC' : '55'}`
          }`,
          boxShadow: isSelected
            ? `0 0 0 3px rgba(237,232,224,0.09)`
            : lineage
              ? `0 0 22px -8px ${color}`
              : 'none',
        }}
      >
        {/* specimen backdrop */}
        <img
          src={exp.content.media_url}
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ opacity: dead ? 0.1 : 0.26, filter: dead ? 'grayscale(1)' : 'none' }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,9,10,0.55) 0%, rgba(8,9,10,0.9) 62%, #08090A 100%)',
          }}
        />

        {/* scanline on the live specimen */}
        {live ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div
              className="motion-particle absolute inset-x-0 h-6 animate-scan"
              style={{
                background: `linear-gradient(180deg, transparent, ${C.acid}1A, transparent)`,
              }}
            />
          </div>
        ) : null}

        <div className="relative flex h-full flex-col justify-between p-2">
          <div className="flex items-start justify-between">
            <span className="num text-2xs tracking-[0.12em] text-bone/75">
              {exp.id.replace('exp_', '#')}
            </span>
            {live ? (
              <span className="flex items-center gap-1 text-2xs tracking-lab text-acid">
                <span className="inline-block h-1.5 w-1.5 animate-blink rounded-full bg-acid" />
                live
              </span>
            ) : unscored ? (
              <span className="animate-breathe text-2xs tracking-lab text-smoke">…</span>
            ) : guess ? (
              <span className="text-2xs tracking-lab text-probe">est</span>
            ) : null}
          </div>

          <div className="flex items-end justify-between gap-1">
            <span
              className="num font-display text-[2.05rem] font-bold leading-none tracking-tight"
              style={{ color: unscored ? C.smoke : color }}
            >
              {unscored ? '—' : fit(f)}
            </span>
            {anomaly && s !== null ? (
              <span
                className="mb-1 border px-1 text-2xs leading-tight tracking-lab"
                style={{
                  color: s >= 0 ? C.acid : C.rust,
                  borderColor: s >= 0 ? 'rgba(199,240,74,0.4)' : 'rgba(196,80,46,0.5)',
                }}
                title={`observed ${delta(s)} against prediction`}
              >
                {delta(s)}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-2xs lowercase tracking-lab text-smoke">
            <span className="truncate">{exp.genome.format.replace(/_/g, ' ')}</span>
            <span className="num shrink-0">{exp.genome.video_length}s</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(SpecimenNode)
