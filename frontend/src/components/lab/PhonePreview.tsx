import { Bookmark, Heart, MessageCircle, Music2, Repeat2, Send, Share2 } from 'lucide-react'
import type { Content, Platform } from '@/types'
import { PLATFORM_NAMES } from '@/lib/plain'
import MemePreview from '@/components/evolution/MemePreview'

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

/** A phone mock-up so you see the meme the way its audience would. */
export default function PhonePreview({
  platform,
  content,
  projected,
}: {
  platform: Platform
  content: Content
  projected: { views: number; likes: number; comments: number; shares: number; saves: number }
}) {
  const isX = platform === 'x'
  const isInsta = platform === 'instagram'

  return (
    <div className="mx-auto w-full max-w-[290px]">
      <div className="rounded-[2rem] border-[7px] border-ink bg-ink p-0 shadow-lift">
        <div className="overflow-hidden rounded-[1.5rem] bg-white">
          {/* app bar */}
          <div className="flex items-center gap-2 bg-white px-3 py-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-agent text-xs font-bold text-white">
              M
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-bold">memevolution</p>
              <p className="text-[10px] text-muted">{PLATFORM_NAMES[platform]}</p>
            </div>
          </div>

          {isX ? (
            <div className="px-3 pb-3">
              <p className="mb-2 text-[13px] leading-snug">{content.caption}</p>
              <MemePreview content={content} ratio="wide" size="sm" className="rounded-lg" />
            </div>
          ) : (
            <MemePreview content={content} ratio={isInsta ? 'square' : 'tall'} size="md" />
          )}

          {/* actions */}
          <div className="flex items-center gap-4 px-3 py-2.5 text-ink/70">
            {isX ? (
              <>
                <Action icon={<MessageCircle size={16} />} n={projected.comments} />
                <Action icon={<Repeat2 size={17} />} n={projected.shares} />
                <Action icon={<Heart size={16} />} n={projected.likes} />
              </>
            ) : (
              <>
                <Action icon={<Heart size={17} />} n={projected.likes} />
                <Action icon={<MessageCircle size={17} />} n={projected.comments} />
                <Action
                  icon={isInsta ? <Send size={16} /> : <Share2 size={16} />}
                  n={projected.shares}
                />
                <span className="ml-auto">
                  <Bookmark size={16} />
                </span>
              </>
            )}
          </div>

          {!isX ? (
            <div className="px-3 pb-3">
              <p className="text-[12px] leading-snug">
                <span className="font-bold">memevolution</span> {content.caption}
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted">
                <Music2 size={10} />
                <span className="truncate">{content.audio}</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Numbers are the AI&rsquo;s estimate, not real engagement.
      </p>
    </div>
  )
}

function Action({ icon, n }: { icon: React.ReactNode; n: number }) {
  return (
    <span className="num flex items-center gap-1 text-[11px] font-medium">
      {icon}
      {compact(n)}
    </span>
  )
}
