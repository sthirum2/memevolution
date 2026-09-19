import { C } from '@/lib/fitness'

export default function Sparkline({
  values,
  width = 86,
  height = 20,
  color = C.acid,
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length < 2) return <span className="text-2xs text-smoke">—</span>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 2) + 1
    const y = height - 2 - ((v - min) / span) * (height - 4)
    return [x, y] as const
  })
  const d = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1" opacity="0.75" />
      <circle cx={last[0]} cy={last[1]} r="1.8" fill={color} />
    </svg>
  )
}
