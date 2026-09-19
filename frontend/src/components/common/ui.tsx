import type { ReactNode, CSSProperties } from 'react'
import type { ExperimentStatus } from '@/types'
import { STATUS_LABEL, statusColor } from '@/lib/fitness'
import { fit, titleize } from '@/lib/format'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/** lowercase mono section heading with a hairline rule running to the edge */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 pt-1">
      <span className="lab-label whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-[rgba(237,232,224,0.08)]" />
      {right ? <span className="lab-label whitespace-nowrap text-smoke">{right}</span> : null}
    </div>
  )
}

export function Chip({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: 'neutral' | 'acid' | 'rust' | 'probe'
  title?: string
}) {
  const tones = {
    neutral: 'border-hairline text-smoke',
    acid: 'border-acid/40 text-acid',
    rust: 'border-rust/50 text-rust',
    probe: 'border-probe/40 text-probe',
  }
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-[2px] text-2xs lowercase tracking-lab',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function StatusChip({ status }: { status: ExperimentStatus }) {
  const tone =
    status === 'extinct'
      ? 'rust'
      : status === 'predicted'
        ? 'probe'
        : status === 'pending'
          ? 'neutral'
          : 'acid'
  return (
    <Chip tone={tone as 'neutral' | 'acid' | 'rust' | 'probe'}>
      {status === 'deployed' ? (
        <span className="mr-0.5 inline-block h-1.5 w-1.5 animate-blink rounded-full bg-acid" />
      ) : null}
      {STATUS_LABEL[status]}
    </Chip>
  )
}

/** Thin horizontal trait meter. Value sits at the right, always tabular. */
export function Meter({
  label,
  value,
  color = '#EDE8E0',
  max = 1,
  suffix,
  ghost,
  dense,
}: {
  label: string
  value: number
  color?: string
  max?: number
  suffix?: string
  ghost?: number // faint marker for the previous / reference value
  dense?: boolean
}) {
  const w = Math.max(0, Math.min(1, value / max)) * 100
  return (
    <div
      className={cx(
        'grid items-center gap-3',
        dense ? 'grid-cols-[92px_1fr_44px]' : 'grid-cols-[104px_1fr_48px]',
      )}
    >
      <span className="truncate text-2xs lowercase tracking-lab text-smoke" title={titleize(label)}>
        {titleize(label)}
      </span>
      <span className="relative h-[3px] w-full bg-[rgba(237,232,224,0.07)]">
        <span
          className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
          style={{ width: `${w}%`, backgroundColor: color }}
        />
        {ghost !== undefined ? (
          <span
            className="absolute -top-[3px] h-[9px] w-px bg-[rgba(237,232,224,0.34)]"
            style={{ left: `${Math.max(0, Math.min(1, ghost / max)) * 100}%` }}
            title={`previous ${fit(ghost)}`}
          />
        ) : null}
      </span>
      <span className="num text-right text-lab text-bone/90">
        {suffix ? `${value}${suffix}` : fit(value)}
      </span>
    </div>
  )
}

/** Big readout used for fitness numbers throughout the app. */
export function BigNum({
  value,
  label,
  color,
  sub,
  size = 'md',
}: {
  value: string
  label?: string
  color?: string
  sub?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'text-2xl', md: 'text-[2.1rem]', lg: 'text-[3.2rem]' }
  return (
    <div className="flex flex-col gap-1">
      {label ? <span className="lab-label">{label}</span> : null}
      <span
        className={cx('num font-display leading-none tracking-tight', sizes[size])}
        style={{ color: color ?? '#EDE8E0' }}
      >
        {value}
      </span>
      {sub ? <span className="text-2xs text-smoke">{sub}</span> : null}
    </div>
  )
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={cx('inline-block h-[6px] w-[6px] rounded-full', pulse && 'animate-blink')}
      style={{ backgroundColor: color }}
    />
  )
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  className,
  style,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'ghost' | 'acid' | 'danger' | 'solid'
  disabled?: boolean
  className?: string
  style?: CSSProperties
  title?: string
}) {
  const variants = {
    ghost: 'border-hairline text-bone/80 hover:border-hairline-strong hover:text-bone',
    acid: 'border-acid/60 text-acid hover:bg-acid hover:text-void',
    danger: 'border-rust/60 text-rust hover:bg-rust hover:text-void',
    solid: 'border-bone/80 bg-bone text-void hover:bg-acid hover:border-acid',
  }
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={cx(
        'border px-3 py-1.5 text-2xs lowercase tracking-lab transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent',
        variants[variant],
        variant === 'solid' && 'disabled:hover:bg-bone',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-[18px] justify-center border border-hairline px-1 py-px text-2xs text-bone/70">
      {children}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-2xs lowercase tracking-lab text-smoke">
      {children}
    </div>
  )
}

/** Diverging bar from a centre axis — used for feature attribution. */
export function DivergingBar({
  label,
  value,
  scale,
  positive = '#C7F04A',
  negative = '#C4502E',
}: {
  label: string
  value: number
  scale: number
  positive?: string
  negative?: string
}) {
  const half = Math.min(1, Math.abs(value) / scale) * 50
  const pos = value >= 0
  return (
    <div className="grid grid-cols-[132px_1fr_46px] items-center gap-3">
      <span className="truncate text-2xs lowercase tracking-lab text-smoke" title={titleize(label)}>
        {titleize(label)}
      </span>
      <span className="relative h-[9px] w-full">
        <span className="absolute inset-y-0 left-1/2 w-px bg-[rgba(237,232,224,0.16)]" />
        <span
          className="absolute top-[3px] h-[3px] transition-all duration-500"
          style={{
            left: pos ? '50%' : `${50 - half}%`,
            width: `${half}%`,
            backgroundColor: pos ? positive : negative,
          }}
        />
      </span>
      <span className="num text-right text-lab" style={{ color: pos ? positive : negative }}>
        {pos ? '+' : '−'}
        {fit(Math.abs(value))}
      </span>
    </div>
  )
}

export function StatusLegend() {
  const items: ExperimentStatus[] = ['survived', 'deployed', 'predicted', 'pending', 'extinct']
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((s) => (
        <span
          key={s}
          className="flex items-center gap-1.5 text-2xs lowercase tracking-lab text-smoke"
        >
          <Dot color={statusColor(s)} pulse={s === 'deployed'} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  )
}
