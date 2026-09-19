import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Plus,
  Repeat2,
  Send,
  Share2,
  BarChart3,
} from 'lucide-react'
import type { Content, Platform } from '@/types'
import MediaFrame from '@/components/common/MediaFrame'
import { compact } from '@/lib/format'

const HANDLE = 'memevolution'
const DISPLAY = 'Memevolution'

/**
 * Faithful-enough post chrome for each platform, so the reviewer sees the
 * artefact the way its audience would rather than as a row in a table.
 * Counts are the model's projection, clearly framed as such by the caller.
 */
export default function PlatformPost({
  platform,
  content,
  projected,
}: {
  platform: Platform
  content: Content
  projected: { views: number; likes: number; comments: number; shares: number; saves: number }
}) {
  if (platform === 'tiktok') return <TikTok content={content} projected={projected} />
  if (platform === 'instagram') return <Instagram content={content} projected={projected} />
  return <XPost content={content} projected={projected} />
}

type Props = {
  content: Content
  projected: { views: number; likes: number; comments: number; shares: number; saves: number }
}

function Avatar({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-acid/80 to-probe/70 font-display font-bold text-void"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      M
    </span>
  )
}

function TikTok({ content, projected }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-[268px] overflow-hidden border border-hairline bg-black">
      <MediaFrame content={content} ratio="tall" raisePunchline />

      {/* right action rail */}
      <div className="absolute bottom-16 right-2 flex flex-col items-center gap-4 text-white">
        <div className="relative mb-1">
          <Avatar size={36} />
          <span className="absolute -bottom-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55]">
            <Plus size={10} strokeWidth={3} />
          </span>
        </div>
        {[
          { icon: <Heart size={22} fill="white" />, n: projected.likes },
          { icon: <MessageCircle size={21} fill="white" />, n: projected.comments },
          { icon: <Bookmark size={21} fill="white" />, n: projected.saves },
          { icon: <Share2 size={21} fill="white" />, n: projected.shares },
        ].map((a, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            {a.icon}
            <span className="num text-[9px] font-semibold drop-shadow">{compact(a.n)}</span>
          </div>
        ))}
        <span className="mt-1 flex h-7 w-7 animate-[spin_5s_linear_infinite] items-center justify-center rounded-full bg-neutral-800 ring-2 ring-neutral-700">
          <Music2 size={12} className="text-white" />
        </span>
      </div>

      {/* bottom meta */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5 pr-14 text-white">
        <p className="text-[11px] font-semibold">@{HANDLE}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-white/90">{content.caption}</p>
        <p className="mt-1 flex items-center gap-1 text-[9px] text-white/70">
          <Music2 size={9} />
          <span className="truncate">{content.audio}</span>
        </p>
      </div>
    </div>
  )
}

function Instagram({ content, projected }: Props) {
  return (
    <div className="mx-auto w-full max-w-[300px] border border-hairline bg-black text-white">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <Avatar size={26} />
        <span className="text-[11px] font-semibold">{HANDLE}</span>
        <MoreHorizontal size={14} className="ml-auto text-white/60" />
      </div>
      <MediaFrame content={content} ratio="square" />
      <div className="flex items-center gap-3.5 px-2.5 py-2">
        <Heart size={18} />
        <MessageCircle size={18} />
        <Send size={17} />
        <Bookmark size={17} className="ml-auto" />
      </div>
      <div className="px-2.5 pb-2.5">
        <p className="num text-[11px] font-semibold">{compact(projected.likes)} likes</p>
        <p className="mt-1 text-[11px] leading-snug">
          <span className="font-semibold">{HANDLE}</span>{' '}
          <span className="text-white/85">{content.caption}</span>
        </p>
        <p className="num mt-1 text-[10px] text-white/45">
          view all {compact(projected.comments)} comments
        </p>
      </div>
    </div>
  )
}

function XPost({ content, projected }: Props) {
  return (
    <div className="mx-auto w-full max-w-[340px] border border-hairline bg-black p-3 text-white">
      <div className="flex gap-2.5">
        <Avatar size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="font-bold">{DISPLAY}</span>
            <span className="text-white/45">@{HANDLE} · 2h</span>
            <MoreHorizontal size={13} className="ml-auto text-white/45" />
          </div>
          <p className="mt-1 whitespace-pre-line text-[12px] leading-snug">{content.caption}</p>

          {content.media_url &&
          content.visual_description.toLowerCase().includes('text post') === false ? (
            <div className="mt-2 overflow-hidden rounded-sm">
              <MediaFrame content={content} ratio="wide" showPunchline={false} />
            </div>
          ) : null}

          <div className="mt-2.5 flex items-center justify-between pr-4 text-white/45">
            {[
              { icon: <MessageCircle size={14} />, n: projected.comments },
              { icon: <Repeat2 size={15} />, n: projected.shares },
              { icon: <Heart size={14} />, n: projected.likes },
              { icon: <BarChart3 size={14} />, n: projected.views },
            ].map((a, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px]">
                {a.icon}
                <span className="num">{compact(a.n)}</span>
              </span>
            ))}
            <Bookmark size={13} />
          </div>
        </div>
      </div>
    </div>
  )
}
