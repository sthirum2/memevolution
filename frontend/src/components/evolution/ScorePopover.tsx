import { useEffect, useId, useRef, useState } from 'react'
import type { Experiment } from '@/types'
import { breakdown } from '@/lib/score'
import { cx } from '@/components/ui'

/**
 * Hover (or tap, or focus) the big score to see what it's made of.
 *
 * The rows are the actual sum the score is computed from — see src/lib/score.ts.
 * Each bar shows how much of that ingredient's available points were earned, so
 * "how it was calculated" is visible without writing out a formula.
 */
export default function ScorePopover({
  exp,
  children,
}: {
  exp: Experiment
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const hideTimer = useRef<number>()
  const id = useId()

  // Mount first, then animate in, so the transition actually runs.
  useEffect(() => {
    if (!open) {
      setMounted(false)
      return
    }
    const t = window.setTimeout(() => setMounted(true), 10)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const show = () => {
    window.clearTimeout(hideTimer.current)
    setOpen(true)
  }
  const hide = () => {
    hideTimer.current = window.setTimeout(() => setOpen(false), 90)
  }

  const m = exp.observed
  if (
    m.views === null ||
    m.shares === null ||
    m.saves === null ||
    m.comments === null ||
    m.likes === null
  ) {
    return <>{children}</>
  }

  const { rows, total } = breakdown({
    views: m.views,
    likes: m.likes,
    comments: m.comments,
    shares: m.shares,
    saves: m.saves,
  })

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        className="cursor-help rounded-lg text-left decoration-line decoration-dotted decoration-2 underline-offset-[6px] transition-colors hover:underline"
      >
        {children}
      </button>

      {open ? (
        <div
          id={id}
          role="tooltip"
          className={cx(
            'absolute left-0 top-full z-40 mt-3 w-[310px] origin-top-left rounded-2xl border border-line bg-card p-4 shadow-lift',
            'transition-all duration-150 ease-out',
            mounted
              ? 'translate-y-0 scale-100 opacity-100'
              : '-translate-y-1 scale-[0.97] opacity-0',
          )}
        >
          {/* arrow */}
          <span className="absolute -top-[6px] left-7 h-3 w-3 rotate-45 rounded-[3px] border-l border-t border-line bg-card" />

          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold">Spread score</span>
            <span className="num text-sm font-bold">
              {total}
              <span className="font-medium text-muted">/100</span>
            </span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            How often people passed this meme on, per person who saw it.
          </p>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-2.5">
                <span className="w-[62px] shrink-0 text-xs font-medium">{r.label}</span>
                <span className="num w-[44px] shrink-0 text-right text-xs text-muted">
                  {r.display}
                </span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-paper">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-win transition-[width] duration-500"
                    style={{ width: `${r.filled * 100}%` }}
                  />
                </span>
                <span className="num w-[38px] shrink-0 text-right text-xs">
                  <span className="font-semibold">{Math.round(r.points)}</span>
                  <span className="text-muted">/{Math.round(r.maxPoints)}</span>
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Shares and saves are worth the most, because passing a meme on is how it actually
            spreads. Views barely count.
          </p>
        </div>
      ) : null}
    </span>
  )
}
