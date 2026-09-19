// ─────────────────────────────────────────────────────────────────────────────
// Plain-English names for everything the agent works with.
// The data contract keeps its machine names; the UI never shows them.
// ─────────────────────────────────────────────────────────────────────────────

export const TRAIT_NAMES: Record<string, string> = {
  absurdity: 'Weirdness',
  irony: 'Irony',
  relatability: 'Relatable',
  trend_relevance: 'On-trend',
  text_density: 'Text on screen',
  short_video: 'Short videos',
  trending_audio: 'Trending sound',
  short_caption: 'Short captions',
  caption_length: 'Caption length',
  video_length: 'Video length',
  topic: 'Topic',
  humor: 'Humour',
  format: 'Format',
  hook: 'Opening',
  audio_strategy: 'Sound',
}

export const TRAIT_HELP: Record<string, string> = {
  absurdity: 'How strange or surreal the joke is',
  irony: 'How much it means the opposite of what it says',
  relatability: 'How many people recognise themselves in it',
  trend_relevance: 'How closely it rides something already popular',
  text_density: 'How much text is burned onto the video',
  short_videos: 'Preference for very short videos',
  short_video: 'Preference for very short videos',
  trending_audio: 'Preference for sounds that are already popular',
  short_caption: 'Preference for very short captions',
}

/** Feature names the model reports, made readable. */
export const FEATURE_NAMES: Record<string, string> = {
  video_length_short: 'Kept it short',
  format_speedrun: 'Speedrun format',
  format_pov: 'POV format',
  audio_trending: 'Trending sound',
  audio_original: 'Original sound',
  hook_cold_open: 'Jumps straight in',
  shared_antagonist: 'A shared enemy',
  topic_niche: 'Narrow topic',
  topic_transfer: 'Reused on a new topic',
  topic_broad: 'Broad topic',
  topic_repeat: 'Repeated topic',
  topic_saturation: 'Topic already saturated',
  caption_length: 'Caption length',
  video_length: 'Video length',
}

export function plainTrait(key: string): string {
  return TRAIT_NAMES[key] ?? titleCase(key)
}

export function plainFeature(key: string): string {
  return FEATURE_NAMES[key] ?? TRAIT_NAMES[key] ?? titleCase(key)
}

export function titleCase(s: string): string {
  const t = s.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Fitness is 0–1 in the data. Nobody reads ".73" quickly — show 73. */
export function score(f: number | null | undefined): number | null {
  if (f === null || f === undefined || !Number.isFinite(f)) return null
  return Math.round(f * 100)
}

export const PLATFORM_NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  x: 'X',
}

/**
 * "1 in 59 people" — the concrete version of a share rate.
 * Far easier to hold in your head than "1.7%", and it says what the spread
 * score is actually made of without showing anyone a formula.
 */
export function oneIn(part: number | null, whole: number | null): string | null {
  if (!part || !whole || part <= 0 || whole <= 0) return null
  return `1 in ${Math.round(whole / part).toLocaleString()}`
}

export function shareRate(exp: {
  observed: { shares: number | null; views: number | null }
}): number | null {
  const { shares, views } = exp.observed
  if (!shares || !views) return null
  return shares / views
}
