import type { Experiment } from '@/types'
import { STATUS, effectiveFitness, scoreColor, surprise } from '@/lib/fitness'
import { score } from '@/lib/plain'
import { Badge, cx } from '@/components/ui'
import MemePreview from './MemePreview'
import { USE_MOCK } from '@/api/client'
import { fitnessText } from '@/lib/evidence'

export default function MemeCard({ exp, onOpen }: { exp: Experiment; onOpen: () => void }) {
  const status = STATUS[exp.status]
  const isWinner = exp.status === 'survived'
  const isDead = exp.status === 'extinct'
  const isLive = exp.status === 'deployed'
  const f = effectiveFitness(exp)
  const s = score(f)
  const surp = surprise(exp)
  const unscored = exp.status === 'pending'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'group flex flex-col overflow-hidden rounded-2xl border bg-card text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lift',
        isWinner ? 'border-win shadow-win' : 'border-line shadow-card',
        isDead && 'opacity-75 hover:opacity-100',
      )}
    >
      <MemePreview content={exp.content} ratio="card" faded={isDead} size="sm" />

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <Badge tone={status.tone} dot={isLive}>
            {USE_MOCK
              ? status.label
              : exp.deployment.post_id && !exp.deployment.post_id.startsWith('pending_')
                ? 'Deployment recorded'
                : 'Not deployed yet'}
          </Badge>
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">
          {exp.content.headline}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-muted">
              {unscored
                ? 'No score yet'
                : exp.observed.fitness !== null
                  ? 'Spread score'
                  : 'AI predicts'}
            </span>
            <span
              className="num font-display text-3xl font-bold leading-none"
              style={{ color: unscored ? '#A9A7A0' : scoreColor(f) }}
            >
              {unscored ? '–' : USE_MOCK ? s : fitnessText(f)}
            </span>
          </div>

          {USE_MOCK && surp !== null ? (
            <span
              className={cx(
                'num rounded-lg px-2 py-1 text-xs font-bold',
                surp >= 0 ? 'bg-win-soft text-win-deep' : 'bg-dead-soft text-dead',
              )}
              title={
                surp >= 0 ? 'Did better than the AI expected' : 'Did worse than the AI expected'
              }
            >
              {surp >= 0 ? '▲' : '▼'} {Math.abs(Math.round(surp * 100))}
            </span>
          ) : null}
        </div>

        {exp.observed.fitness !== null ? (
          <p className="num text-[11px] text-muted">
            Predicted{' '}
            {USE_MOCK ? score(exp.prediction.fitness) : fitnessText(exp.prediction.fitness)} ·
            observed {USE_MOCK ? s : fitnessText(exp.observed.fitness)}
          </p>
        ) : exp.status === 'predicted' ? (
          <p className="text-[11px] text-muted">Waiting to be posted</p>
        ) : null}
      </div>
    </button>
  )
}
