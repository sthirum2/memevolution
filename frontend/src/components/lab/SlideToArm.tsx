import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsRight, Lock, Unlock } from 'lucide-react'
import { C } from '@/lib/fitness'
import { cx } from '@/components/common/ui'

/**
 * Step one of the two-step authorization gate. Deliberately physical: you have
 * to drag it the whole way. Nothing is posted by arming — arming only unlocks
 * the DEPLOY button next to it.
 */
export default function SlideToArm({
  onArm,
  armed,
  disabled,
}: {
  onArm: () => void
  armed: boolean
  disabled?: boolean
}) {
  const track = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  const dragging = useRef(false)

  const move = useCallback(
    (clientX: number) => {
      const el = track.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const knob = 44
      const next = Math.max(0, Math.min(1, (clientX - r.left - knob / 2) / (r.width - knob)))
      setP(next)
      if (next >= 0.97) {
        dragging.current = false
        setP(1)
        onArm()
      }
    },
    [onArm],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => dragging.current && move(e.clientX)
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      setP((v) => (v >= 0.97 ? 1 : 0))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [move])

  useEffect(() => {
    if (armed) setP(1)
  }, [armed])

  const done = armed || p >= 0.97

  return (
    <div
      ref={track}
      className={cx(
        'relative h-11 w-full select-none overflow-hidden border transition-colors',
        disabled ? 'cursor-not-allowed border-hairline opacity-40' : 'cursor-grab',
        done ? 'border-acid/60' : 'border-hairline-strong',
      )}
      style={{ background: done ? 'rgba(199,240,74,0.07)' : 'rgba(18,21,23,0.9)' }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width]"
        style={{
          width: `${p * 100}%`,
          background: done ? 'rgba(199,240,74,0.14)' : 'rgba(237,232,224,0.05)',
        }}
      />
      <span
        className={cx(
          'pointer-events-none absolute inset-0 flex items-center justify-center text-2xs lowercase tracking-lab transition-opacity',
          done ? 'text-acid' : 'text-smoke',
        )}
        style={{ opacity: p > 0.08 && !done ? 0.3 : 1 }}
      >
        {done ? 'armed — deploy is now enabled' : 'slide to arm deployment'}
      </span>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="slide to arm deployment"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={p}
        onPointerDown={(e) => {
          if (disabled || done) return
          dragging.current = true
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        }}
        onKeyDown={(e) => {
          // Keyboard route: hold → to arm, for the demo and for accessibility.
          if (disabled || done) return
          if (e.key === 'ArrowRight') {
            const next = Math.min(1, p + 0.2)
            setP(next)
            if (next >= 0.97) onArm()
          }
          if (e.key === 'ArrowLeft') setP((v) => Math.max(0, v - 0.2))
        }}
        className={cx(
          'absolute top-1/2 flex h-[38px] w-[42px] -translate-y-1/2 items-center justify-center transition-colors',
          done ? 'bg-acid text-void' : 'bg-bone/90 text-void active:cursor-grabbing',
        )}
        style={{ left: `calc(${p} * (100% - 44px) + 1px)` }}
      >
        {done ? <Unlock size={14} /> : p > 0.05 ? <Lock size={14} /> : <ChevronsRight size={16} />}
      </div>
      {!done ? (
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-2xs"
          style={{ color: C.smoke }}
        >
          →
        </span>
      ) : null}
    </div>
  )
}
