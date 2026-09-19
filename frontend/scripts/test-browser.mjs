// Browser fixtures are test-only. The application never falls back to them.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH })
const output = new URL('../.demo-check/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
await mkdir(output, { recursive: true })
const errors = []
async function page() {
  const p = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  })
  p.on('pageerror', (error) => errors.push(error.message))
  return p
}
try {
  const mock = await page()
  await mock.goto('http://127.0.0.1:5175')
  await mock.getByRole('button', { name: 'Try it', exact: true }).click()
  await mock.getByRole('button', { name: 'Create 5 memes' }).click()
  await mock.getByRole('button', { name: 'Review it before posting' }).click({ timeout: 30000 })
  assert.equal(await mock.getByText('Chance of spreading', { exact: true }).count(), 0)
  await mock.getByRole('checkbox').check()
  await mock.getByRole('button', { name: 'Save and review deployment' }).click()
  await mock.getByRole('button', { name: 'Publish to TikTok', exact: true }).click()
  await mock.getByRole('button', { name: 'Pull the real numbers' }).click()
  await mock.getByText('These are simulated demo measurements.').waitFor()
  await mock.getByRole('button', { name: 'Update the AI', exact: true }).click()
  await mock.getByText('The AI updated itself', { exact: true }).waitFor()
  await mock.evaluate(() => window.scrollTo(0, 0))
  await mock.screenshot({ path: `${output}/mock-learning.png`, fullPage: true })
  await mock.getByRole('button', { name: 'Generate the next candidates' }).click()
  await mock.getByRole('button', { name: 'Review it before posting' }).waitFor({ timeout: 30000 })
  console.log(
    'PASS mock generation → selection → approval → simulated publish → metrics → learning → next generation',
  )

  const live = await page()
  await live.goto('http://127.0.0.1:5176')
  await live.getByRole('heading', { name: 'Could not load' }).waitFor()
  console.log('PASS unavailable local backend shows load error, without mock fallback')

  const fixture = {
    id: 'fixture_1',
    generation: 1,
    parent_id: null,
    status: 'predicted',
    genome: {
      topic: 'college',
      humor: 'absurdist',
      format: 'pov',
      hook: 'unexpected_text',
      absurdity: 0.5,
      irony: 0.5,
      relatability: 0.5,
      trend_relevance: 0.5,
      text_density: 0.2,
      caption_length: 80,
      video_length: 10,
      audio_strategy: 'original_sound',
    },
    mutations: [{ trait: 'irony', from: 0.4, to: 0.5 }],
    hypothesis: 'Test a different degree of irony.',
    prediction: { fitness: 0.023066, confidence: null, model_version: 'fixture-xgboost' },
    content: {
      headline: 'Fixture concept',
      visual_description: 'A test-only concept.',
      caption: 'Fixture caption',
      punchline: '',
      audio: 'Original',
      media_url: '',
    },
    deployment: { platform: 'tiktok', timestamp: null, post_id: null },
    observed: {
      views: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      fitness: null,
    },
  }
  const state = {
    generation: 1,
    beliefs: { irony: 0.5 },
    confidence: {},
    note: 'Current fixture strategy',
  }
  const requests = []
  let completeMetrics = false
  await live.route('http://127.0.0.1:8000/**', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    requests.push({ path: url.pathname, method })
    let body
    if (url.pathname === '/experiments') body = method === 'POST' ? fixture : [fixture]
    else if (url.pathname === '/agent-states') body = [state]
    else if (url.pathname === '/generations') body = [{ generation: 1, experiments: [fixture] }]
    else if (url.pathname === '/generation') body = [fixture]
    else if (url.pathname === '/select')
      body = {
        selectedId: fixture.id,
        mode: 'exploit',
        reasoning: 'Selected by the fixture agent.',
        ranking: [{ id: fixture.id, fitness: 0.023066, confidence: null }],
      }
    else if (url.pathname.endsWith('/publish'))
      body = {
        experiment_id: fixture.id,
        platform: 'tiktok',
        post_id: 'fixture_upload',
        published_at: '2026-09-19T15:00:00Z',
        status: 'awaiting_user',
        permalink: null,
        instructions: 'Fixture instruction: finish publishing in TikTok.',
      }
    else if (url.pathname.endsWith('/live-metrics'))
      body = {
        experiment_id: fixture.id,
        fetched_at: '2026-09-19T16:00:00Z',
        views: 123,
        likes: 12,
        comments: 1,
        shares: 2,
        saves: completeMetrics ? 0 : null,
        fitness: completeMetrics ? 0.02 : null,
      }
    else if (url.pathname === '/evolve')
      body = {
        generation: 1,
        previous: state,
        next: { ...state, beliefs: { irony: 0.6 }, note: 'Updated from fixture observation' },
        shifts: [{ trait: 'irony', from: 0.5, to: 0.6, delta: 0.1 }],
        driverId: fixture.id,
      }
    else if (url.pathname.endsWith('/snapshots'))
      body = [
        {
          timestamp: '2026-09-19T16:00:00Z',
          views: 123,
          likes: 12,
          comments: 1,
          shares: 2,
          saves: null,
          fitness: null,
        },
      ]
    else body = fixture
    await route.fulfill({ json: body, headers: { 'Access-Control-Allow-Origin': '*' } })
  })
  await live.reload()
  await live.getByRole('button', { name: 'Try it', exact: true }).click()
  await live.getByRole('button', { name: 'Create 5 memes' }).click()
  await live.getByRole('button', { name: 'Review it before posting' }).click()
  await live.getByText('0.0231', { exact: true }).waitFor()
  assert.ok((await live.locator('body').innerText()).includes('Confidence Not available'))
  await live.getByRole('checkbox').check()
  await live.getByRole('button', { name: 'Save and review deployment' }).click()
  await live.getByRole('button', { name: 'Refresh history' }).waitFor()
  await live.getByRole('cell', { name: '123', exact: true }).waitFor()
  assert.ok(await live.getByRole('button', { name: 'Update the AI', exact: true }).isDisabled())
  assert.equal(await live.getByRole('slider').count(), 0)
  assert.ok(!requests.some((r) => r.path.endsWith('/deploy')))
  assert.ok(!requests.some((r) => r.path.endsWith('/metrics') || r.path === '/evolve'))
  await live.evaluate(() => window.scrollTo(0, 0))
  await live.screenshot({ path: `${output}/live-pending.png`, fullPage: true })
  await live.evaluate(() => window.__mv.getState().finish())
  assert.ok(!requests.some((r) => r.path.endsWith('/metrics') || r.path === '/evolve'))
  await live.getByRole('button', { name: 'What it learned', exact: true }).click()
  await live
    .getByText(
      'Awaiting an observation and agent update. Historical belief snapshots are not available.',
    )
    .waitFor()
  console.log(
    'PASS live contract fixtures: exact fitness, missing confidence, snapshots, pending counts, no fake deployment/learning, no invented historical beliefs',
  )
  await live.getByRole('button', { name: 'Try it', exact: true }).click()
  await live.getByRole('button', { name: 'Publish to TikTok', exact: true }).click()
  await live.getByText('Fixture instruction: finish publishing in TikTok.').waitFor()
  await live.getByRole('button', { name: 'Pull the real numbers' }).click()
  await live.waitForFunction(() => window.__mv.getState().lab.live !== null)
  assert.ok(await live.getByRole('button', { name: 'Update the AI', exact: true }).isDisabled())
  completeMetrics = true
  await live.getByRole('button', { name: 'Pull the real numbers' }).click()
  await live.waitForFunction(() => window.__mv.getState().lab.live?.saves === 0)
  await live.getByRole('button', { name: 'Update the AI', exact: true }).click()
  await live.getByText('The AI updated itself', { exact: true }).waitFor()
  assert.equal(requests.filter((r) => r.path === '/evolve').length, 1)
  console.log(
    'PASS live fixtures: awaiting-user status, partial counts blocked, measured zero accepted, backend belief changes rendered',
  )

  // Hold the media response while checking the player, then test a failed URL.
  let releaseVideo
  const videoResponse = new Promise((resolve) => { releaseVideo = resolve })
  await live.route('**/media/fixture.mp4', async (route) => {
    await videoResponse
    await route.fulfill({ status: 404, body: '' })
  })
  await live.evaluate(() => {
    const store = window.__mv.getState()
    store.setLab({
      step: 'review',
      candidates: store.lab.candidates.map((c) => ({
        ...c, content: { ...c.content, media_url: 'http://127.0.0.1:8000/media/fixture.mp4' },
      })),
    })
  })
  await live.locator('video').waitFor()
  assert.equal(await live.locator('video').getAttribute('controls'), '')
  assert.equal(await live.locator('video').getAttribute('src'), 'http://127.0.0.1:8000/media/fixture.mp4')
  releaseVideo()
  await live.getByText('Media not available', { exact: true }).waitFor()
  console.log('PASS backend video URL uses a controlled player; failed media shows an explicit unavailable state')
  await live.setViewportSize({ width: 390, height: 844 })
  assert.ok(await live.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await live.screenshot({ path: `${output}/live-mobile.png`, fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS mobile overview fits viewport; no browser runtime errors')
} finally {
  await browser.close()
}
