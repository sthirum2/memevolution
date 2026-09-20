import type { Content } from '@/types'
import MemePreview from '@/components/evolution/MemePreview'
export default function PhonePreview({ content }: { content: Content }) {
  return <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border-8 border-ink bg-white">
    <p className="px-4 py-3 font-bold">Instagram preview</p>
    <MemePreview content={content} />
    <p className="px-4 py-3 text-sm">{content.caption}</p>
  </div>
}
