import type { Content } from '@/types'
import { cx } from '@/components/ui'

/**
 * The meme as it actually reads: the video still with its caption burned on.
 * Used in cards, the detail modal and the phone preview.
 */
export default function MemePreview({
  content,
  ratio = 'square',
  size = 'md',
  faded: _faded,
  className,
  showPunchline = true,
}: {
  content: Content
  ratio?: 'square' | 'tall' | 'wide' | 'card'
  size?: 'sm' | 'md' | 'lg'
  faded?: boolean
  className?: string
  /** Off for thumbnails too small to hold both lines of text. */
  showPunchline?: boolean
}) {
  const aspect =
    ratio === 'tall'
      ? 'aspect-[9/16]'
      : ratio === 'wide'
        ? 'aspect-[16/10]'
        : ratio === 'card'
          ? 'aspect-[5/4]'
          : 'aspect-square'
  const head =
    size === 'sm' ? 'text-[11px] leading-snug' : size === 'lg' ? 'text-xl' : 'text-sm leading-snug'
  const punch = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-sm' : 'text-[10px]'

  if (content.media_url) return <img src={content.media_url} alt={content.headline} loading="lazy" className={cx('w-full object-contain', aspect, className)} />
  return (
    <div className={cx('relative overflow-hidden bg-ink', aspect, className)}>
      <span className="absolute bottom-1 left-2 text-[10px] text-white/60">Concept only · image not generated</span>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,10,12,0.42) 0%, rgba(10,10,12,0.15) 45%, rgba(10,10,12,0.8) 100%)',
        }}
      />
      <div className="absolute inset-x-0 top-[10%] px-3">
        <p
          className={cx(
            'line-clamp-3 text-center font-display font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]',
            head,
          )}
        >
          {content.headline}
        </p>
      </div>
      {showPunchline && content.punchline && content.punchline !== '—' ? (
        <div className="absolute inset-x-0 bottom-[7%] px-3">
          <p
            className={cx(
              'text-center font-semibold uppercase tracking-wide text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]',
              punch,
            )}
          >
            {content.punchline}
          </p>
        </div>
      ) : null}
    </div>
  )
}
