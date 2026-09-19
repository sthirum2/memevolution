import { useEffect, useRef, useState } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animates a number up from 0 (or from its previous value) with an ease-out. */
export function useCountUp(target: number, duration = 900, active = true): number {
  const [value, setValue] = useState(active ? 0 : target)
  const from = useRef(0)
  const raf = useRef<number>()

  useEffect(() => {
    if (!active) {
      setValue(0)
      from.current = 0
      return
    }
    if (prefersReduced()) {
      setValue(target)
      from.current = target
      return
    }
    const start = performance.now()
    const a = from.current
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(a + (target - a) * eased)
      if (t < 1) raf.current = requestAnimationFrame(step)
      else from.current = target
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, duration, active])

  return value
}
