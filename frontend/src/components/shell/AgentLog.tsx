import { useEffect, useRef } from 'react'
import { ChevronDown, Terminal } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { C } from '@/lib/fitness'
import { cx } from '@/components/common/ui'
import type { LogKind } from '@/store/useStore'

const KIND_COLOR: Record<LogKind, string> = {
  info: 'rgba(237,232,224,0.62)',
  good: C.acid,
  bad: C.rust,
  probe: C.probe,
  system: C.smoke,
}

export default function AgentLog() {
  const log = useStore((s) => s.log)
  const open = useStore((s) => s.logOpen)
  const toggle = useStore((s) => s.toggleLog)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [log.length, open])

  const last = log[log.length - 1]

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 z-40 w-full max-w-[min(560px,94vw)] p-3">
      <div className="bg-void/92 pointer-events-auto border border-hairline backdrop-blur-sm">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-2 border-b border-hairline px-3 py-1.5 text-left transition-colors hover:bg-graphite/60"
        >
          <Terminal size={11} className="shrink-0 text-smoke" />
          <span className="lab-label">agent log</span>
          {!open && last ? (
            <span
              className="min-w-0 flex-1 truncate text-2xs"
              style={{ color: KIND_COLOR[last.kind] }}
            >
              {last.text}
            </span>
          ) : (
            <span className="flex-1" />
          )}
          <span className="num text-2xs text-smoke">{log.length}</span>
          <ChevronDown
            size={12}
            className={cx(
              'shrink-0 text-smoke transition-transform duration-200',
              !open && 'rotate-180',
            )}
          />
        </button>

        {open ? (
          <div className="max-h-[27vh] overflow-y-auto px-3 py-2">
            {log.map((e) => (
              <div key={e.id} className="flex gap-2 py-[1px] text-2xs leading-[1.45]">
                <span className="num shrink-0 text-smoke/60">{e.t}</span>
                <span className="shrink-0 text-smoke/40">│</span>
                <span className="min-w-0 break-words" style={{ color: KIND_COLOR[e.kind] }}>
                  {e.text}
                </span>
              </div>
            ))}
            <div ref={bottom} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
