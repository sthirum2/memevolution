// ─────────────────────────────────────────────────────────────────────────────
// Deterministic mock-data generator for MEMEVOLUTION.
//   node scripts/generate-mock.mjs
// Writes src/data/*.json and public/specimens/*.svg
//
// The NARRATIVE is hand-authored; only the numbers are generated. The agent's
// arc across 6 generations:
//   G1  absurdist framing beats sincere vlogging (model underpredicts it)
//   G2  short + trending audio compounds        (exp_006 overperforms by +.18)
//   G3  the irony branch collapses              (exp_012 overpredicted by -.33)
//   G4  "speedrun" framing generalises          (exp_014 = best ever, .91)
//   G5  live generation, one post deployed and still accumulating
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260919)
const jitter = (n, amt) => round2(n + (rnd() - 0.5) * amt)
const round2 = (n) => Math.round(n * 100) / 100
const T0 = new Date('2026-09-18T09:00:00Z').getTime()
const HOUR = 3600_000
const iso = (h) => new Date(T0 + h * HOUR).toISOString()

// ── Hand-authored specimen table ────────────────────────────────────────────
const SPEC = [
  {
    id: 'exp_000', gen: 0, parent: null, status: 'survived',
    g: { topic: 'campus', humor: 'observational', format: 'talking_head', hook: 'text_overlay',
         absurdity: 0.40, irony: 0.72, relatability: 0.70, trend_relevance: 0.50,
         text_density: 0.60, caption_length: 24, video_length: 18, audio_strategy: 'original' },
    mut: [],
    hyp: 'Seeded from the historical corpus. Before any experiment of its own the agent believes campus content propagates through relatability and a moderately ironic register.',
    pred: 0.50, conf: 0.30, obs: 0.52,
    c: { headline: 'HISTORICAL PRIOR',
         visual: 'Not a generated post. The centroid genome of 41,206 sampled campus-niche videos that cleared the corpus engagement floor.',
         punch: '—',
         caption: 'the median thing that works, before anyone tried anything',
         audio: 'corpus median · original audio' },
    attr: [['relatability', 0.18], ['trend_relevance', 0.09], ['irony', 0.06], ['text_density', -0.04]],
  },
  // ── GENERATION 1 ──────────────────────────────────────────────────────────
  {
    id: 'exp_001', gen: 1, parent: 'exp_000', status: 'extinct',
    g: { topic: 'campus', humor: 'observational', format: 'talking_head', hook: 'text_overlay',
         absurdity: 0.38, irony: 0.70, relatability: 0.84, trend_relevance: 0.48,
         text_density: 0.66, caption_length: 31, video_length: 19, audio_strategy: 'original' },
    mut: [['relatability', 0.70, 0.84]],
    hyp: 'Pushing relatability above the corpus median should widen the audience that recognises itself in the post.',
    pred: 0.48, conf: 0.61, obs: 0.31,
    c: { headline: 'when the syllabus says no extensions',
         visual: 'Static talking-head to camera, dorm room, overhead light. Text banner pinned top-third for the full run.',
         punch: 'and the due date is during the career fair',
         caption: 'genuinely who approved this academic calendar',
         audio: 'original audio — room tone' },
    attr: [['relatability', 0.21], ['text_density', -0.07], ['trend_relevance', -0.05], ['video_length', -0.06]],
  },
  {
    id: 'exp_002', gen: 1, parent: 'exp_000', status: 'extinct',
    g: { topic: 'campus', humor: 'observational', format: 'pov', hook: 'unexpected_text',
         absurdity: 0.52, irony: 0.68, relatability: 0.74, trend_relevance: 0.55,
         text_density: 0.54, caption_length: 19, video_length: 14, audio_strategy: 'original' },
    mut: [['format', 'talking_head', 'pov'], ['hook', 'text_overlay', 'unexpected_text']],
    hyp: 'A POV frame makes the viewer a participant rather than an audience, which should raise the share rate.',
    pred: 0.52, conf: 0.58, obs: 0.59,
    c: { headline: "POV: you're the only one who did the reading",
         visual: 'Handheld POV walking into a seminar room. Slow pan across eleven closed laptops.',
         punch: 'the professor makes eye contact. you are the seminar now.',
         caption: 'i will not be doing this again',
         audio: 'original audio — hallway' },
    attr: [['format_pov', 0.14], ['relatability', 0.11], ['irony', 0.04], ['video_length', -0.03]],
  },
  {
    id: 'exp_003', gen: 1, parent: 'exp_000', status: 'survived',
    g: { topic: 'campus', humor: 'absurdist', format: 'pov', hook: 'unexpected_text',
         absurdity: 0.66, irony: 0.61, relatability: 0.72, trend_relevance: 0.58,
         text_density: 0.48, caption_length: 16, video_length: 12, audio_strategy: 'trending' },
    mut: [['humor', 'observational', 'absurdist'], ['absurdity', 0.40, 0.66], ['audio_strategy', 'original', 'trending']],
    hyp: 'Absurdist framing of an ordinary campus grievance should travel further than a sincere account of the same grievance.',
    pred: 0.55, conf: 0.52, obs: 0.73,
    c: { headline: 'explaining my 4-hour gap between classes to my parents',
         visual: 'POV across a kitchen table. Subject gestures at a hand-drawn schedule taped to the wall as if briefing a war room.',
         punch: '"so from 11 to 3 I simply cease to exist"',
         caption: 'the gap is load-bearing',
         audio: 'trending — sped-up orchestral swell' },
    attr: [['absurdity', 0.19], ['audio_trending', 0.12], ['format_pov', 0.09], ['caption_length', 0.03]],
  },
  {
    id: 'exp_004', gen: 1, parent: 'exp_000', status: 'extinct',
    g: { topic: 'campus', humor: 'sincere', format: 'vlog', hook: 'slow_build',
         absurdity: 0.22, irony: 0.31, relatability: 0.79, trend_relevance: 0.41,
         text_density: 0.35, caption_length: 42, video_length: 34, audio_strategy: 'original' },
    mut: [['humor', 'observational', 'sincere'], ['format', 'talking_head', 'vlog'], ['video_length', 18, 34]],
    hyp: 'A sincere day-in-the-life may build a stronger parasocial bond and convert to follows even if it shares less.',
    pred: 0.44, conf: 0.66, obs: 0.27,
    c: { headline: 'day in my life as a pre-med',
         visual: 'Morning-to-night vlog. Six a.m. alarm, library, cadaver lab exterior, 1am walk home.',
         punch: '(there is no punchline. that is the point.)',
         caption: 'romanticising it because the alternative is thinking about it',
         audio: 'original audio — ambient + lo-fi bed' },
    attr: [['relatability', 0.13], ['video_length', -0.19], ['absurdity', -0.11], ['trend_relevance', -0.08]],
  },
  // ── GENERATION 2 ──────────────────────────────────────────────────────────
  {
    id: 'exp_005', gen: 2, parent: 'exp_003', status: 'extinct',
    g: { topic: 'campus', humor: 'absurdist', format: 'mockumentary', hook: 'unexpected_text',
         absurdity: 0.84, irony: 0.58, relatability: 0.55, trend_relevance: 0.54,
         text_density: 0.44, caption_length: 15, video_length: 21, audio_strategy: 'original' },
    mut: [['absurdity', 0.66, 0.84], ['format', 'pov', 'mockumentary'], ['video_length', 12, 21]],
    hyp: 'If absurdity is the active ingredient, more of it inside a longer mockumentary frame should compound the effect.',
    pred: 0.58, conf: 0.55, obs: 0.44,
    c: { headline: 'the 4-hour gap, but it is a nature documentary',
         visual: 'Handheld long-lens shots of a student asleep across three library chairs. Whispered narration over the top.',
         punch: '"the specimen has selected its nesting site. it will not move until 3pm."',
         caption: 'observed in its natural habitat',
         audio: 'original audio — whispered VO' },
    attr: [['absurdity', 0.16], ['video_length', -0.14], ['relatability', -0.12], ['audio_original', -0.07]],
  },
  {
    id: 'exp_006', gen: 2, parent: 'exp_003', status: 'survived',
    g: { topic: 'cs_major', humor: 'absurdist', format: 'pov', hook: 'unexpected_text',
         absurdity: 0.76, irony: 0.61, relatability: 0.72, trend_relevance: 0.67,
         text_density: 0.31, caption_length: 11, video_length: 7, audio_strategy: 'trending' },
    mut: [['absurdity', 0.66, 0.76], ['video_length', 12, 7], ['text_density', 0.48, 0.31], ['topic', 'campus', 'cs_major']],
    hyp: 'Increasing absurdity while cutting time-to-punchline to under eight seconds should raise the share rate, because a meme has to be re-tellable before it can be re-posted.',
    pred: 0.63, conf: 0.64, obs: 0.81,
    c: { headline: 'when you said one quick LeetCode problem',
         visual: 'Hard cut from a lit desk at 7pm to the same desk at 4am, same posture, forty-one browser tabs, sun coming up behind the blinds.',
         punch: 'the problem was rated EASY',
         caption: 'see you tomorrow',
         audio: 'trending — pitched-up sample, 7s loop' },
    attr: [['video_length_short', 0.22], ['absurdity', 0.17], ['audio_trending', 0.13], ['text_density', 0.08], ['topic_niche', -0.04]],
  },
  {
    id: 'exp_007', gen: 2, parent: 'exp_003', status: 'extinct',
    g: { topic: 'campus', humor: 'absurdist', format: 'group_chat', hook: 'unexpected_text',
         absurdity: 0.71, irony: 0.64, relatability: 0.81, trend_relevance: 0.61,
         text_density: 0.78, caption_length: 14, video_length: 11, audio_strategy: 'trending' },
    mut: [['format', 'pov', 'group_chat'], ['text_density', 0.48, 0.78]],
    hyp: 'Rendering the joke as a readable group chat should raise saves, because text is re-readable in a way that performance is not.',
    pred: 0.60, conf: 0.59, obs: 0.62,
    c: { headline: 'the group chat at 3am before the deadline',
         visual: 'Screen recording of a five-person thread. Typing indicators start and stop. Nobody sends anything for nine seconds.',
         punch: '"has anyone started" (4 likes)',
         caption: 'we are a team',
         audio: 'trending — muffled bass, notification stabs' },
    attr: [['relatability', 0.15], ['text_density', -0.11], ['audio_trending', 0.10], ['absurdity', 0.07]],
  },
  {
    id: 'exp_008', gen: 2, parent: 'exp_003', status: 'extinct',
    g: { topic: 'campus', humor: 'deadpan', format: 'explainer', hook: 'slow_build',
         absurdity: 0.58, irony: 0.74, relatability: 0.66, trend_relevance: 0.44,
         text_density: 0.69, caption_length: 27, video_length: 24, audio_strategy: 'original' },
    mut: [['humor', 'absurdist', 'deadpan'], ['format', 'pov', 'explainer'], ['irony', 0.61, 0.74]],
    hyp: 'A deadpan explainer register lets the absurdity land without being announced, which should read as wittier and travel through quote-shares.',
    pred: 0.51, conf: 0.57, obs: 0.38,
    c: { headline: 'library seat ownership law, explained',
         visual: 'Whiteboard diagram with legal citations to statutes that do not exist. Laser pointer. Absolutely straight face.',
         punch: 'a water bottle establishes possession for ninety minutes. a laptop charger is adverse possession.',
         caption: 'precedent is precedent',
         audio: 'original audio — lecture hall' },
    attr: [['irony', 0.09], ['video_length', -0.15], ['trend_relevance', -0.12], ['text_density', -0.08]],
  },
  // ── GENERATION 3 ──────────────────────────────────────────────────────────
  {
    id: 'exp_009', gen: 3, parent: 'exp_006', status: 'extinct',
    g: { topic: 'gym', humor: 'absurdist', format: 'pov', hook: 'unexpected_text',
         absurdity: 0.76, irony: 0.58, relatability: 0.69, trend_relevance: 0.66,
         text_density: 0.30, caption_length: 10, video_length: 7, audio_strategy: 'trending' },
    mut: [['topic', 'cs_major', 'gym']],
    hyp: 'If the winning structure is the structure and not the subject, transplanting it onto an unrelated topic should hold most of its fitness.',
    pred: 0.70, conf: 0.68, obs: 0.55,
    c: { headline: 'when you said one quick gym session',
         visual: 'Same hard-cut structure as exp_006. 6pm lit gym, 9pm empty gym, identical posture on the same bench.',
         punch: 'it was leg day. it is still leg day.',
         caption: 'see you tomorrow',
         audio: 'trending — pitched-up sample, 7s loop' },
    attr: [['video_length_short', 0.21], ['absurdity', 0.16], ['audio_trending', 0.12], ['topic_transfer', -0.09]],
  },
  {
    id: 'exp_010', gen: 3, parent: 'exp_006', status: 'survived',
    g: { topic: 'cs_major', humor: 'absurdist', format: 'speedrun', hook: 'unexpected_text',
         absurdity: 0.81, irony: 0.55, relatability: 0.74, trend_relevance: 0.79,
         text_density: 0.28, caption_length: 9, video_length: 6, audio_strategy: 'trending' },
    mut: [['format', 'pov', 'speedrun'], ['trend_relevance', 0.67, 0.79], ['absurdity', 0.76, 0.81]],
    hyp: 'Borrowing the speedrun frame imports an entire existing grammar — timer, split, category name — so the viewer already knows how to read the joke and can re-tell it in four words.',
    pred: 0.74, conf: 0.71, obs: 0.86,
    c: { headline: 'the 11:59pm submission speedrun, any%',
         visual: 'Split-screen with a live millisecond timer. Green split text pops on every completed step. Final upload confirmation at 23:59:47.',
         punch: 'NEW PERSONAL BEST — 13 seconds remaining',
         caption: 'any% no-sleep category',
         audio: 'trending — speedrun timer sting' },
    attr: [['format_speedrun', 0.24], ['trend_relevance', 0.16], ['video_length_short', 0.14], ['absurdity', 0.09], ['text_density', 0.05]],
  },
  {
    id: 'exp_011', gen: 3, parent: 'exp_006', status: 'extinct',
    g: { topic: 'cs_major', humor: 'absurdist', format: 'pov', hook: 'cold_open',
         absurdity: 0.78, irony: 0.60, relatability: 0.83, trend_relevance: 0.68,
         text_density: 0.33, caption_length: 12, video_length: 8, audio_strategy: 'trending' },
    mut: [['hook', 'unexpected_text', 'cold_open'], ['relatability', 0.72, 0.83]],
    hyp: 'Opening mid-sentence with no setup should cut the scroll-past window to almost nothing.',
    pred: 0.69, conf: 0.66, obs: 0.79,
    c: { headline: "when the TA says 'this will be on the exam'",
         visual: 'Opens already mid-panic. Forty students turning to the same page in unison, filmed from the back row.',
         punch: 'she said it about slide 4 of 212',
         caption: 'the whole room heard it',
         audio: 'trending — pitched-up sample, 7s loop' },
    attr: [['hook_cold_open', 0.17], ['relatability', 0.14], ['video_length_short', 0.13], ['absurdity', 0.08]],
  },
  {
    id: 'exp_012', gen: 3, parent: 'exp_006', status: 'extinct',
    g: { topic: 'campus', humor: 'ironic', format: 'pov', hook: 'unexpected_text',
         absurdity: 0.74, irony: 0.91, relatability: 0.48, trend_relevance: 0.62,
         text_density: 0.35, caption_length: 13, video_length: 9, audio_strategy: 'trending' },
    mut: [['irony', 0.61, 0.91], ['humor', 'absurdist', 'ironic'], ['relatability', 0.72, 0.48]],
    hyp: 'The historical corpus scores irony highly, so maximising it on top of the winning structure should be the single largest available gain.',
    pred: 0.74, conf: 0.62, obs: 0.41,
    c: { headline: 'a deeply ironic meditation on the attendance policy',
         visual: 'Slow push-in on an empty lecture hall. Layered irony: the video is about not attending, filmed by someone attending.',
         punch: 'the policy is the performance and we are all complicit, etc.',
         caption: 'anyway',
         audio: 'trending — melancholy piano edit' },
    attr: [['irony', 0.23], ['video_length_short', 0.12], ['absurdity', 0.08], ['relatability', -0.14]],
  },
  // ── GENERATION 4 ──────────────────────────────────────────────────────────
  {
    id: 'exp_013', gen: 4, parent: 'exp_010', status: 'extinct',
    g: { topic: 'campus', humor: 'absurdist', format: 'speedrun', hook: 'unexpected_text',
         absurdity: 0.80, irony: 0.50, relatability: 0.77, trend_relevance: 0.76,
         text_density: 0.27, caption_length: 9, video_length: 6, audio_strategy: 'trending' },
    mut: [['topic', 'cs_major', 'campus']],
    hyp: 'Widening the topic from one major to the whole campus should grow the addressable audience without touching the structure that is working.',
    pred: 0.78, conf: 0.74, obs: 0.68,
    c: { headline: 'the 8am lecture speedrun, glitchless',
         visual: 'Timer starts at the alarm. Splits for teeth, bus, coffee, door. Runner arrives as the slide deck opens.',
         punch: 'GLITCHLESS — showered, technically',
         caption: 'glitchless category is harder',
         audio: 'trending — speedrun timer sting' },
    attr: [['format_speedrun', 0.22], ['trend_relevance', 0.14], ['video_length_short', 0.13], ['topic_broad', -0.06]],
  },
  {
    id: 'exp_014', gen: 4, parent: 'exp_010', status: 'survived',
    g: { topic: 'bureaucracy', humor: 'absurdist', format: 'speedrun', hook: 'cold_open',
         absurdity: 0.86, irony: 0.49, relatability: 0.88, trend_relevance: 0.81,
         text_density: 0.24, caption_length: 8, video_length: 6, audio_strategy: 'trending' },
    mut: [['topic', 'cs_major', 'bureaucracy'], ['hook', 'unexpected_text', 'cold_open'], ['relatability', 0.74, 0.88], ['absurdity', 0.81, 0.86]],
    hyp: 'Pointing the speedrun frame at a shared institutional enemy rather than a personal habit should let the joke be re-told by people it did not happen to.',
    pred: 0.81, conf: 0.78, obs: 0.91,
    c: { headline: 'financial aid portal speedrun (world record attempt)',
         visual: 'Cold open on a 2003-era portal already mid-session. Timer running. Two password resets, one PDF that opens in a new tab and immediately expires.',
         punch: 'RUN VOIDED — session timed out at 4:51',
         caption: 'attempt 6',
         audio: 'trending — speedrun timer sting' },
    attr: [['format_speedrun', 0.23], ['relatability', 0.19], ['shared_antagonist', 0.15], ['trend_relevance', 0.11], ['video_length_short', 0.09]],
  },
  {
    id: 'exp_015', gen: 4, parent: 'exp_010', status: 'extinct',
    g: { topic: 'dining', humor: 'absurdist', format: 'speedrun', hook: 'unexpected_text',
         absurdity: 0.79, irony: 0.52, relatability: 0.81, trend_relevance: 0.74,
         text_density: 0.29, caption_length: 10, video_length: 7, audio_strategy: 'trending' },
    mut: [['topic', 'cs_major', 'dining']],
    hyp: 'Dining hall content has the widest possible campus overlap, so the same structure should reach more people per share.',
    pred: 0.76, conf: 0.72, obs: 0.72,
    c: { headline: 'the dining hall swipe speedrun',
         visual: 'Timer from door to table. Split for the omelette line. Runner loses eleven seconds to a friend who wants to catch up.',
         punch: 'SOCIAL PENALTY — +11s',
         caption: 'the line is RNG',
         audio: 'trending — speedrun timer sting' },
    attr: [['format_speedrun', 0.21], ['relatability', 0.16], ['trend_relevance', 0.10], ['topic_saturation', -0.08]],
  },
  {
    id: 'exp_016', gen: 4, parent: 'exp_010', status: 'extinct',
    g: { topic: 'group_work', humor: 'absurdist', format: 'speedrun', hook: 'unexpected_text',
         absurdity: 0.83, irony: 0.53, relatability: 0.76, trend_relevance: 0.70,
         text_density: 0.41, caption_length: 14, video_length: 12, audio_strategy: 'trending' },
    mut: [['topic', 'cs_major', 'group_work'], ['video_length', 6, 12], ['text_density', 0.28, 0.41]],
    hyp: 'A four-player co-op framing needs more seconds to establish, and the payoff should justify the extra length.',
    pred: 0.72, conf: 0.69, obs: 0.59,
    c: { headline: 'group project speedrun, 4 players',
         visual: 'Four-way split screen. Three panels idle for the entire run. One panel does everything.',
         punch: 'CO-OP RUN — 1 player active',
         caption: 'i did not consent to this category',
         audio: 'trending — speedrun timer sting' },
    attr: [['format_speedrun', 0.19], ['relatability', 0.13], ['video_length', -0.16], ['text_density', -0.07]],
  },
  // ── GENERATION 5 — LIVE ───────────────────────────────────────────────────
  {
    id: 'exp_017', gen: 5, parent: 'exp_014', status: 'predicted',
    g: { topic: 'bureaucracy', humor: 'absurdist', format: 'speedrun', hook: 'cold_open',
         absurdity: 0.87, irony: 0.47, relatability: 0.85, trend_relevance: 0.78,
         text_density: 0.23, caption_length: 8, video_length: 6, audio_strategy: 'trending' },
    mut: [['absurdity', 0.86, 0.87], ['trend_relevance', 0.81, 0.78]],
    hyp: 'Holding the winning genome nearly fixed gives a clean control against which the three mutated siblings can be read.',
    pred: 0.74, conf: 0.76, obs: null,
    c: { headline: 'the parking permit speedrun',
         visual: 'Cold open on a permit queue at 6:40am. Timer. Runner reaches the window as the lot fills.',
         punch: 'RUN FAILED — lot full at 6:52',
         caption: 'attempt 3',
         audio: 'trending — speedrun timer sting' },
    attr: [['format_speedrun', 0.22], ['relatability', 0.17], ['shared_antagonist', 0.13], ['topic_repeat', -0.09]],
  },
  {
    id: 'exp_018', gen: 5, parent: 'exp_014', status: 'deployed',
    g: { topic: 'bureaucracy', humor: 'absurdist', format: 'speedrun', hook: 'cold_open',
         absurdity: 0.89, irony: 0.46, relatability: 0.91, trend_relevance: 0.86,
         text_density: 0.22, caption_length: 7, video_length: 5, audio_strategy: 'trending' },
    mut: [['relatability', 0.88, 0.91], ['trend_relevance', 0.81, 0.86], ['video_length', 6, 5], ['absurdity', 0.86, 0.89]],
    hyp: 'The housing lottery is the single most widely shared institutional grievance on campus, and framing it as RNG manipulation gives strangers a reason to send it to each other rather than merely recognise it.',
    pred: 0.88, conf: 0.81, obs: 'partial',
    c: { headline: 'housing lottery speedrun (RNG manipulation)',
         visual: 'Cold open on a countdown already at 00:04. Lottery number reveal. Runner attempts four documented RNG-manipulation strategies, all superstition.',
         punch: 'SEED WAS SET AT BIRTH',
         caption: 'rng is rigged',
         audio: 'trending — speedrun timer sting' },
    attr: [['relatability', 0.21], ['format_speedrun', 0.20], ['shared_antagonist', 0.18], ['trend_relevance', 0.14], ['video_length_short', 0.08]],
  },
  {
    id: 'exp_019', gen: 5, parent: 'exp_014', status: 'predicted',
    g: { topic: 'bureaucracy', humor: 'deadpan', format: 'speedrun', hook: 'cold_open',
         absurdity: 0.72, irony: 0.61, relatability: 0.83, trend_relevance: 0.75,
         text_density: 0.26, caption_length: 11, video_length: 8, audio_strategy: 'original' },
    mut: [['humor', 'absurdist', 'deadpan'], ['audio_strategy', 'trending', 'original'], ['irony', 0.49, 0.61]],
    hyp: 'An exploration probe. Both the deadpan register and original audio were pruned in earlier generations, but never together and never on top of the speedrun frame — the agent has low confidence here and wants the measurement.',
    pred: 0.69, conf: 0.44, obs: null,
    c: { headline: 'course registration speedrun, co-op run',
         visual: 'Two roommates, two laptops, one shared schedule. Deadpan narration of a plan that survives four seconds of contact with the registrar.',
         punch: 'DESYNC — both runners in the same section',
         caption: 'we practised this for a week',
         audio: 'original audio — keyboard, two people not talking' },
    attr: [['format_speedrun', 0.20], ['relatability', 0.15], ['audio_original', -0.11], ['irony', -0.06]],
  },
  {
    id: 'exp_020', gen: 5, parent: 'exp_014', status: 'pending',
    g: { topic: 'bureaucracy', humor: 'absurdist', format: 'speedrun', hook: 'cold_open',
         absurdity: 0.84, irony: 0.48, relatability: 0.86, trend_relevance: 0.80,
         text_density: 0.25, caption_length: 9, video_length: 7, audio_strategy: 'trending' },
    mut: [['hook', 'cold_open', 'cold_open'], ['caption_length', 8, 9]],
    hyp: 'Awaiting a fitness estimate from the historical model.',
    pred: null, conf: null, obs: null,
    c: { headline: 'office hours speedrun',
         visual: 'Cold open on a corridor queue. Timer. Eleven minutes of waiting compressed to three seconds.',
         punch: 'BOSS NOT SPAWNED — door locked, sign says back in 5',
         caption: 'attempt 2',
         audio: 'trending — speedrun timer sting' },
    attr: [],
  },
]

// ── Derive engagement consistent with fitness ───────────────────────────────
// Fitness is a normalised propagation score, weighted toward shares/saves —
// it is NOT views. A small account with a high share rate outranks a big
// account coasting on reach.
function engagementFor(fitness, seedScale = 1) {
  const base = 2400 + fitness * fitness * 46000 * seedScale
  const views = Math.round(base * (0.85 + rnd() * 0.3))
  const likeRate = 0.058 + fitness * 0.11 + (rnd() - 0.5) * 0.012
  const commentRate = 0.004 + fitness * 0.011 + (rnd() - 0.5) * 0.002
  const shareRate = 0.003 + fitness * fitness * 0.049 + (rnd() - 0.5) * 0.002
  const saveRate = 0.006 + fitness * 0.021 + (rnd() - 0.5) * 0.003
  return {
    views,
    likes: Math.round(views * likeRate),
    comments: Math.round(views * commentRate),
    shares: Math.round(views * shareRate),
    saves: Math.round(views * saveRate),
  }
}

// Saturating propagation curve: fast early lift, decelerating tail.
function timeseries(final, hoursList) {
  const span = hoursList[hoursList.length - 1]
  return hoursList.map((h) => {
    const p = 1 - Math.exp(-3.1 * (h / span))
    const n = p * (0.97 + rnd() * 0.05)
    return {
      t: iso(h),
      views: Math.round(final.views * n),
      likes: Math.round(final.likes * n),
      shares: Math.round(final.shares * Math.min(1, n * 0.93)),
    }
  })
}

const FULL_HOURS = [0, 1, 3, 6, 12, 24, 48, 72]
const LIVE_HOURS = [0, 1, 2, 3, 4, 6]

const experiments = SPEC.map((s, idx) => {
  const finished = s.obs !== null && s.obs !== 'partial'
  const live = s.obs === 'partial'
  const deployHour = 6 + idx * 7

  let observed = { views: null, likes: null, comments: null, shares: null, saves: null, fitness: null, timeseries: [] }
  if (finished) {
    const e = engagementFor(s.obs)
    observed = { ...e, fitness: round2(s.obs), timeseries: timeseries(e, FULL_HOURS) }
  } else if (live) {
    // Deployed 6h ago and still climbing — partial numbers, provisional fitness.
    const projected = 0.84
    const e = engagementFor(projected, 0.42)
    observed = { ...e, fitness: 0.79, timeseries: timeseries(e, LIVE_HOURS) }
  }

  const deployed = finished || live
  return {
    id: s.id,
    generation: s.gen,
    parent_id: s.parent,
    status: s.status,
    genome: {
      topic: s.g.topic, humor: s.g.humor, format: s.g.format, hook: s.g.hook,
      absurdity: s.g.absurdity, irony: s.g.irony, relatability: s.g.relatability,
      trend_relevance: s.g.trend_relevance, text_density: s.g.text_density,
      caption_length: s.g.caption_length, video_length: s.g.video_length,
      audio_strategy: s.g.audio_strategy,
    },
    mutations: s.mut.map(([trait, from, to]) => ({ trait, from, to })),
    hypothesis: s.hyp,
    prediction: {
      fitness: s.pred === null ? 0 : round2(s.pred),
      confidence: s.conf === null ? 0 : round2(s.conf),
      feature_attribution: s.attr.map(([feature, contribution]) => ({ feature, contribution: round2(contribution) })),
    },
    content: {
      headline: s.c.headline,
      visual_description: s.c.visual,
      punchline: s.c.punch,
      caption: s.c.caption,
      audio: s.c.audio,
      media_url: `/specimens/${s.id}.svg`,
    },
    deployment: {
      platform: deployed ? 'tiktok' : null,
      timestamp: deployed ? iso(live ? 96 : deployHour) : null,
      post_id: deployed ? `7${(4218830000000000000n + BigInt(idx * 733717)).toString().slice(1, 19)}` : null,
    },
    observed,
  }
})

// ── Agent belief trajectory ────────────────────────────────────────────────
const agentStates = [
  { generation: 0,
    beliefs: { absurdity: 0.40, irony: 0.72, relatability: 0.70, trend_relevance: 0.50, text_density: 0.60, short_video: 0.45, trending_audio: 0.50, short_caption: 0.42 },
    confidence: { absurdity: 0.30, irony: 0.34, relatability: 0.44, trend_relevance: 0.28, text_density: 0.31, short_video: 0.26, trending_audio: 0.29, short_caption: 0.24 },
    note: 'Priors read straight off the historical corpus. Nothing here has been tested by this agent — the corpus rewards relatability and a moderately ironic register, and the agent has no reason yet to doubt either.' },
  { generation: 1,
    beliefs: { absurdity: 0.51, irony: 0.64, relatability: 0.68, trend_relevance: 0.58, text_density: 0.52, short_video: 0.54, trending_audio: 0.62, short_caption: 0.51 },
    confidence: { absurdity: 0.44, irony: 0.38, relatability: 0.52, trend_relevance: 0.41, text_density: 0.36, short_video: 0.40, trending_audio: 0.45, short_caption: 0.33 },
    note: 'exp_003 beat its prediction by +.18 while the sincere vlog (exp_004) came in .17 under. Absurdity is doing work the corpus did not price in. First real downgrade of the inherited belief that sincerity converts.' },
  { generation: 2,
    beliefs: { absurdity: 0.63, irony: 0.55, relatability: 0.71, trend_relevance: 0.61, text_density: 0.45, short_video: 0.69, trending_audio: 0.70, short_caption: 0.58 },
    confidence: { absurdity: 0.58, irony: 0.42, relatability: 0.56, trend_relevance: 0.49, text_density: 0.47, short_video: 0.61, trending_audio: 0.57, short_caption: 0.44 },
    note: 'exp_006 overperformed by +.18 at seven seconds; exp_005 underperformed by -.14 at twenty-one. Duration separates them more cleanly than absurdity does. Short video is now the strongest single belief the agent holds.' },
  { generation: 3,
    beliefs: { absurdity: 0.74, irony: 0.71, relatability: 0.76, trend_relevance: 0.67, text_density: 0.38, short_video: 0.78, trending_audio: 0.74, short_caption: 0.66 },
    confidence: { absurdity: 0.69, irony: 0.29, relatability: 0.63, trend_relevance: 0.58, text_density: 0.55, short_video: 0.72, trending_audio: 0.64, short_caption: 0.52 },
    note: 'OVER-CORRECTION. The corpus scores irony highly and the agent raised it to .71 before exp_012 reported back. exp_012 was overpredicted by -.33 — the largest miss of the run. Irony confidence collapses to .29 pending the next generation.' },
  { generation: 4,
    beliefs: { absurdity: 0.79, irony: 0.52, relatability: 0.80, trend_relevance: 0.72, text_density: 0.31, short_video: 0.84, trending_audio: 0.79, short_caption: 0.74 },
    confidence: { absurdity: 0.76, irony: 0.61, relatability: 0.74, trend_relevance: 0.69, text_density: 0.66, short_video: 0.81, trending_audio: 0.73, short_caption: 0.63 },
    note: 'Irony backs off hard, from .71 to .52, and confidence recovers now that the miss is explained: what the corpus read as irony was borrowed structure. exp_010 and exp_014 both beat prediction using an imported frame the viewer already knows how to read.' },
  { generation: 5,
    beliefs: { absurdity: 0.81, irony: 0.49, relatability: 0.86, trend_relevance: 0.74, text_density: 0.28, short_video: 0.86, trending_audio: 0.81, short_caption: 0.79 },
    confidence: { absurdity: 0.82, irony: 0.68, relatability: 0.84, trend_relevance: 0.75, text_density: 0.71, short_video: 0.86, trending_audio: 0.78, short_caption: 0.72 },
    note: 'Absurdity has plateaued around .80 — pushing it further stopped paying at exp_005. The live belief is that propagation comes from a shared antagonist plus a borrowed frame, held under six seconds. exp_018 is deployed and testing exactly that.' },
]

// ── Corpus (historical grounding for the CORPUS view) ──────────────────────
const corpus = {
  datasets: [
    { name: 'TikTok videos', scale: '4.5B videos', source: 'kuben-developer/tiktok-videos-4b',
      description: 'One row per video: caption, sound id as a join key, play/like/comment/share/save counts, duration, country, language, post time.',
      rowsSampled: 41206 },
    { name: 'Twitter firehose', scale: '395M tweets', source: 'calcifer-hot/twitter-firehose-last-month',
      description: 'Trailing month across X, all languages, with repeat snapshots per tweet so engagement is a time series rather than a single count.',
      rowsSampled: 18400 },
    { name: 'Parkour Instagram niche', scale: '451k posts · 10.8M observations',
      source: 'calcifer-hot/parkour-instagram-niche',
      description: 'A single dense niche with a 595,730-edge account graph — used to calibrate what follower-normalised propagation looks like inside a closed community.',
      rowsSampled: 12950 },
  ],
  fitnessDistribution: [
    { bucket: '0.0–0.1', count: 7412 }, { bucket: '0.1–0.2', count: 9831 },
    { bucket: '0.2–0.3', count: 8204 }, { bucket: '0.3–0.4', count: 5967 },
    { bucket: '0.4–0.5', count: 4118 }, { bucket: '0.5–0.6', count: 2644 },
    { bucket: '0.6–0.7', count: 1489 }, { bucket: '0.7–0.8', count: 834 },
    { bucket: '0.8–0.9', count: 512 }, { bucket: '0.9–1.0', count: 195 },
  ],
  traitCorrelation: [
    { trait: 'short_video', correlation: 0.41 },
    { trait: 'trending_audio', correlation: 0.34 },
    { trait: 'absurdity', correlation: 0.29 },
    { trait: 'relatability', correlation: 0.22 },
    { trait: 'borrowed_frame', correlation: 0.19 },
    { trait: 'irony', correlation: 0.07 },
    { trait: 'caption_length', correlation: -0.14 },
    { trait: 'text_density', correlation: -0.26 },
  ],
  propagationByFormat: [
    { format: 'speedrun', medianShareRate: 0.041, n: 1206 },
    { format: 'pov', medianShareRate: 0.028, n: 8944 },
    { format: 'group_chat', medianShareRate: 0.024, n: 3117 },
    { format: 'mockumentary', medianShareRate: 0.019, n: 902 },
    { format: 'talking_head', medianShareRate: 0.013, n: 11408 },
    { format: 'explainer', medianShareRate: 0.011, n: 4288 },
    { format: 'vlog', medianShareRate: 0.007, n: 6741 },
  ],
}

// ── Specimen backdrops: offline, deterministic, no network at demo time ────
const HUES = { tiktok: 188, instagram: 318, x: 210 }
function specimenSvg(exp, i) {
  const r = mulberry32(1000 + i * 77)
  const dead = exp.status === 'extinct'
  const hue = (HUES.tiktok + i * 23) % 360
  const sat = dead ? 8 : 34
  const bars = Array.from({ length: 26 }, (_, k) => {
    const y = 40 + k * 52
    const w = 120 + r() * 700
    const x = 60 + r() * 180
    const o = (0.04 + r() * 0.13).toFixed(3)
    return `<rect x="${x.toFixed(0)}" y="${y}" width="${w.toFixed(0)}" height="${(6 + r() * 16).toFixed(0)}" fill="hsl(${hue} ${sat}% 70%)" opacity="${o}"/>`
  }).join('')
  const arcs = Array.from({ length: 5 }, (_, k) => {
    const rad = 180 + k * 115
    return `<circle cx="540" cy="760" r="${rad}" fill="none" stroke="hsl(${hue} ${sat}% 62%)" stroke-width="1" opacity="${(0.16 - k * 0.025).toFixed(3)}"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} ${sat}% 12%)"/>
      <stop offset="58%" stop-color="#0B0D0E"/>
      <stop offset="100%" stop-color="hsl(${hue} ${sat}% 7%)"/>
    </linearGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${i * 13}"/>
      <feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
  ${arcs}
  ${bars}
  <g opacity="0.5">
    <line x1="0" y1="640" x2="1080" y2="640" stroke="hsl(${hue} ${sat}% 60%)" stroke-width="1" opacity="0.18"/>
    <line x1="0" y1="1280" x2="1080" y2="1280" stroke="hsl(${hue} ${sat}% 60%)" stroke-width="1" opacity="0.18"/>
    <line x1="360" y1="0" x2="360" y2="1920" stroke="hsl(${hue} ${sat}% 60%)" stroke-width="1" opacity="0.12"/>
    <line x1="720" y1="0" x2="720" y2="1920" stroke="hsl(${hue} ${sat}% 60%)" stroke-width="1" opacity="0.12"/>
  </g>
  <rect width="1080" height="1920" filter="url(#n)" opacity="0.055"/>
  <text x="60" y="130" font-family="monospace" font-size="38" letter-spacing="10"
        fill="#EDE8E0" opacity="0.5">${exp.id.toUpperCase()}</text>
  <text x="60" y="1860" font-family="monospace" font-size="30" letter-spacing="6"
        fill="#EDE8E0" opacity="0.28">GEN ${exp.generation} · ${exp.genome.format.toUpperCase()}</text>
</svg>`
}

mkdirSync(resolve(ROOT, 'src/data'), { recursive: true })
mkdirSync(resolve(ROOT, 'public/specimens'), { recursive: true })
writeFileSync(resolve(ROOT, 'src/data/experiments.json'), JSON.stringify(experiments, null, 2))
writeFileSync(resolve(ROOT, 'src/data/agentStates.json'), JSON.stringify(agentStates, null, 2))
writeFileSync(resolve(ROOT, 'src/data/corpus.json'), JSON.stringify(corpus, null, 2))
experiments.forEach((e, i) => {
  writeFileSync(resolve(ROOT, `public/specimens/${e.id}.svg`), specimenSvg(e, i))
})
console.log(`wrote ${experiments.length} experiments, ${agentStates.length} agent states, ${experiments.length} specimen frames`)
