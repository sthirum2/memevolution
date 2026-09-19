import type { ReactNode } from 'react'
import { C } from '@/lib/fitness'

export const AXIS = {
  stroke: 'rgba(237,232,224,0.14)',
  tick: { fill: C.smoke, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' },
  tickLine: false,
  axisLine: { stroke: 'rgba(237,232,224,0.10)' },
} as const

export const GRID = {
  stroke: 'rgba(237,232,224,0.055)',
  strokeDasharray: '2 4',
} as const

export function Panel({
  title,
  right,
  children,
  className,
  subtitle,
}: {
  title: string
  right?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`flex min-h-0 flex-col border border-hairline bg-carbon ${className ?? ''}`}
    >
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-hairline px-3 py-2">
        <span className="lab-label">{title}</span>
        {right ? <span className="text-2xs tracking-lab text-smoke">{right}</span> : null}
      </div>
      {subtitle ? (
        <p className="shrink-0 border-b border-hairline px-3 py-1.5 text-2xs leading-relaxed text-smoke">
          {subtitle}
        </p>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

export function TooltipShell({ children }: { children: ReactNode }) {
  return (
    <div className="border border-hairline-strong bg-void/95 px-2.5 py-2 backdrop-blur-sm">
      {children}
    </div>
  )
}
