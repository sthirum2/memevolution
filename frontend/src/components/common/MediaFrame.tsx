import type { Content } from '@/types'
import { cx } from './ui'

/**
 * The specimen as it actually reads: backdrop frame with the caption burned on
 * top the way a meme carries its text. Used by the specimen panel and by the
 * platform post previews in the Lab.
 */
export default function MediaFrame({
  content,
  ratio = 'tall',
  muted,
  className,
  showPunchline = true,
  size = 'md',
  raisePunchline,
}: {
  content: Content
  ratio?: 'tall' | 'wide' | 'square'
  muted?: boolean
  className?: string
  showPunchline?: boolean
  /** The frame is used at three very different widths — the burned-in caption
   *  has to shrink with it or it swallows the thumbnail. */
  size?: 'xs' | 'sm' | 'md'
  /** Platform chrome (TikTok's caption block) occupies the bottom of the
   *  frame — lift the burned-in punchline clear of it. */
  raisePunchline?: boolean
}) {
  const head =
    size === 'xs' ? 'text-[7px] leading-tight' : size === 'sm' ? 'text-[10px]' : 'text-[0.95rem]'
  const punch =
    size === 'xs' ? 'text-[5.5px] leading-tight' : size === 'sm' ? 'text-[7px]' : 'text-2xs'
  const pad = size === 'md' ? 'px-4' : 'px-1.5'
  const aspect =
    ratio === 'tall' ? 'aspect-[9/16]' : ratio === 'square' ? 'aspect-square' : 'aspect-[16/10]'
  return (
    <div className={cx('relative w-full overflow-hidden bg-void', aspect, className)}>
      <img
        src={content.media_url}
        alt={content.headline}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: muted ? 0.32 : 0.62 }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,9,10,0.32) 0%, rgba(8,9,10,0.1) 40%, rgba(8,9,10,0.88) 100%)',
        }}
      />

      {/* the caption, as the viewer would see it */}
      <div className={cx('absolute inset-x-0 top-[13%]', pad)}>
        <p
          className={cx(
            'text-center font-display font-medium leading-snug text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]',
            head,
          )}
        >
          {content.headline}
        </p>
      </div>

      {showPunchline && content.punchline && content.punchline !== '—' ? (
        <div
          className={cx('absolute inset-x-0', raisePunchline ? 'bottom-[26%]' : 'bottom-[8%]', pad)}
        >
          <p
            className={cx(
              'text-center uppercase leading-snug tracking-[0.1em] text-acid drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]',
              punch,
            )}
          >
            {content.punchline}
          </p>
        </div>
      ) : null}

      {/* frame furniture: this is a video still, not a photo */}
      <div className="pointer-events-none absolute inset-0 border border-[rgba(237,232,224,0.09)]" />
      {size === 'md' ? (
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 text-2xs tracking-lab text-bone/45">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rust" />
          rec
        </div>
      ) : null}
    </div>
  )
}
