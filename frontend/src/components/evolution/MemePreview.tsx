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
  faded,
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

  return (
    <div className={cx('relative overflow-hidden bg-ink', aspect, className)}>
      <img
        src={content.media_url}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: faded ? 0.35 : 0.7, filter: faded ? 'grayscale(0.8)' : 'none' }}
      />
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
