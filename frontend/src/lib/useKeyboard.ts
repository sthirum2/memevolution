import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import type { ViewKey } from '@/types'

const VIEW_KEYS: Record<string, ViewKey> = {
  '1': 'organism',
  '2': 'specimen',
  '3': 'mind',
  '4': 'lab',
  '5': 'corpus',
}

export function useKeyboard(runDemo: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // Never hijack a key the user is typing into a field.
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const s = useStore.getState()

      if (e.key === 'Escape') {
        if (s.shortcutsOpen) s.toggleShortcuts()
        else if (s.selectedId) s.select(null)
        return
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        s.toggleShortcuts()
        return
      }

      const view = VIEW_KEYS[e.key]
      if (view) {
        if (view === 'specimen') {
          // Open the best-performing specimen if nothing is selected yet.
          if (!s.selectedId) {
            const best = [...s.experiments]
              .filter((x) => x.observed.fitness !== null)
              .sort((a, b) => (b.observed.fitness ?? 0) - (a.observed.fitness ?? 0))[0]
            if (best) s.select(best.id)
          }
        }
        s.setView(view)
        return
      }

      const k = e.key.toLowerCase()
      if (k === 'r') void s.replay()
      if (k === 'd') runDemo()
      if (k === 'l') s.toggleLog()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runDemo])
}
