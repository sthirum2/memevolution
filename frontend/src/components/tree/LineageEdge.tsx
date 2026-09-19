import { memo, useId } from 'react'
import { getBezierPath, type Edge, type EdgeProps } from '@xyflow/react'
import { C } from '@/lib/fitness'

export type LineageKind = 'spine' | 'probe' | 'dead'
export type LineageData = { kind: LineageKind; fitness: number; hidden: boolean }
export type LineageEdgeType = Edge<LineageData, 'lineage'>

/**
 * Three kinds of ancestry:
 *   spine — a surviving parent to a surviving/live child. Thick, acid,
 *           with particles flowing down it. This is the line of descent.
 *   probe — parent to an unobserved child. Thin cyan dashes; a guess, not a fact.
 *   dead  — parent to an extinct child. The stroke frays out toward the child
 *           via a gradient rather than simply disappearing.
 */
function LineageEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<LineageEdgeType>) {
  const uid = useId().replace(/:/g, '')
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.42,
  })

  const kind = data?.kind ?? 'dead'
  const hidden = data?.hidden ?? false
  const fitness = data?.fitness ?? 0.5

  if (kind === 'dead') {
    return (
      <g style={{ opacity: hidden ? 0 : 1, transition: 'opacity 500ms ease' }}>
        <defs>
          <linearGradient
            id={`fray-${uid}`}
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
          >
            <stop offset="0%" stopColor={C.rust} stopOpacity="0.5" />
            <stop offset="55%" stopColor={C.rust} stopOpacity="0.16" />
            <stop offset="100%" stopColor={C.rust} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          id={id}
          d={path}
          fill="none"
          stroke={`url(#fray-${uid})`}
          strokeWidth={1}
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
      </g>
    )
  }

  if (kind === 'probe') {
    return (
      <g style={{ opacity: hidden ? 0 : 1, transition: 'opacity 500ms ease' }}>
        <path
          id={id}
          d={path}
          fill="none"
          stroke={C.probe}
          strokeOpacity={0.42}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </g>
    )
  }

  // spine — carries particles, faster the fitter the descendant
  const dur = 3.4 - Math.min(0.95, fitness) * 1.7
  return (
    <g style={{ opacity: hidden ? 0 : 1, transition: 'opacity 500ms ease' }}>
      <path id={id} d={path} fill="none" stroke={C.acid} strokeOpacity={0.14} strokeWidth={6} />
      <path d={path} fill="none" stroke={C.acid} strokeOpacity={0.85} strokeWidth={1.6} />
      {[0, 1, 2].map((i) => (
        <circle key={i} r={2.1} fill={C.acid} className="motion-particle">
          <animateMotion
            dur={`${dur}s`}
            begin={`${(dur / 3) * i}s`}
            repeatCount="indefinite"
            path={path}
            keyPoints="0;1"
            keyTimes="0;1"
            calcMode="linear"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.12;0.8;1"
            dur={`${dur}s`}
            begin={`${(dur / 3) * i}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  )
}

export default memo(LineageEdge)
