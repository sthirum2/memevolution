import { memo } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { BAND_H } from '@/lib/layout'
import { C } from '@/lib/fitness'
import { fit } from '@/lib/format'

export type BandData = {
  generation: number
  width: number
  label: string
  count: number
  meanFitness: number
  dimmed: boolean
}
export type BandNodeType = Node<BandData, 'band'>

function BandNode({ data }: NodeProps<BandNodeType>) {
  const { width, label, count, meanFitness, dimmed } = data
  return (
    <div
      className="pointer-events-none relative transition-opacity duration-500"
      style={{ width, height: BAND_H, opacity: dimmed ? 0.16 : 1 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[rgba(237,232,224,0.09)]" />
      <div className="absolute left-0 top-2 flex items-baseline gap-3 whitespace-nowrap">
        <span className="text-2xs lowercase tracking-lab text-bone/45">{label}</span>
        <span className="num text-2xs text-smoke">
          {count} specimen{count === 1 ? '' : 's'}
        </span>
        {meanFitness > 0 ? (
          <span className="num text-2xs" style={{ color: C.smoke }}>
            mean {fit(meanFitness)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default memo(BandNode)
