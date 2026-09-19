import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

type Tone = 'win' | 'dead' | 'guess' | 'muted' | 'agent'

const TONES: Record<Tone, string> = {
  win: 'bg-win-soft text-win-deep',
  dead: 'bg-dead-soft text-dead',
  guess: 'bg-guess-soft text-guess',
  muted: 'bg-paper text-muted',
  agent: 'bg-agent-soft text-agent',
}

export function Badge({
  children,
  tone = 'muted',
  dot,
}: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        TONES[tone],
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  const variants = {
    primary: 'bg-ink text-white hover:bg-black disabled:hover:bg-ink',
    secondary: 'bg-white text-ink border border-line hover:bg-paper disabled:hover:bg-white',
    ghost: 'text-muted hover:text-ink hover:bg-paper',
    danger: 'bg-win text-white hover:bg-win-deep disabled:hover:bg-win',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-xl',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Big number with a caption. The main way results are shown. */
export function Stat({
  value,
  label,
  color,
  sub,
  size = 'md',
}: {
  value: ReactNode
  label: string
  color?: string
  sub?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl' }
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span
        className={cx('num font-display font-bold leading-none', sizes[size])}
        style={{ color: color ?? '#17171A' }}
      >
        {value}
      </span>
      {sub ? <span className="text-sm text-muted">{sub}</span> : null}
    </div>
  )
}

/** Labelled progress bar, used for every 0–100 trait in the app. */
export function Bar({
  label,
  value,
  color = '#6D4AFF',
  right,
  ghost,
  help,
}: {
  label: string
  value: number
  color?: string
  right?: ReactNode
  /** Faint marker for a previous / reference value */
  ghost?: number
  help?: string
}) {
  return (
    <div className="flex items-center gap-3" title={help}>
      <span className="w-32 shrink-0 truncate text-sm text-muted">{label}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-paper">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{
            width: `${Number.isFinite(value) ? Math.max(0, Math.min(1, value)) * 100 : 0}%`,
            background: color,
          }}
        />
        {ghost !== undefined ? (
          <span
            className="absolute inset-y-[-3px] w-0.5 rounded bg-ink/25"
            style={{ left: `${Math.max(0, Math.min(1, ghost)) * 100}%` }}
          />
        ) : null}
      </span>
      <span className="num w-10 shrink-0 text-right text-sm font-semibold">
        {right ?? (Number.isFinite(value) ? Math.round(value * 100) : '—')}
      </span>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-3xl animate-pop-in rounded-2xl bg-card shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Section({
  title,
  subtitle,
  children,
  right,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          {subtitle ? <p className="max-w-2xl text-sm text-muted">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}
