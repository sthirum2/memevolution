import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { USE_MOCK } from '@/api/client'

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Hands-free run of the whole pipeline for the pitch: ?demo=1 or the D key.
 *
 * One deliberate exception — the authorization gate. Against the mock backend
 * nothing is published, so demo mode arms it automatically and says so on
 * screen. Against a real backend it stops and waits for a human, because a
 * demo flag is not consent.
 */
export function useDemo() {
  const running = useRef(false)

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    const s = useStore.getState()

    s.setDemo(true)
    s.setView('organism')
    s.pushLog('demo playback started', 'system')
    await wait(400)

    await s.replay()
    await wait(500)

    s.setView('lab')
    s.resetLab()
    s.setLab({ platform: 'tiktok', topic: 'bureaucracy', riskAppetite: 0.2 })
    await wait(700)

    await useStore.getState().runGenerate()
    await wait(500)

    await useStore.getState().runSelect()
    // Let the EXPLOIT/EXPLORE verdict land before moving to the gate.
    await wait(1700)

    useStore.getState().setLab({ stage: 'authorize' })
    await wait(900)

    if (!USE_MOCK) {
      useStore
        .getState()
        .pushLog(
          'demo paused at the authorization gate — live backend requires a human to arm and deploy',
          'bad',
        )
      useStore.getState().setDemo(false)
      running.current = false
      return
    }

    useStore
      .getState()
      .pushLog('demo: auto-arming against the mock backend — nothing is published', 'probe')
    useStore.getState().arm()
    await wait(800)

    await useStore.getState().runDeploy()
    await wait(2600)

    useStore.getState().setObserveHours(24)
    await wait(700)

    await useStore.getState().runEvolve()
    await wait(1100)

    useStore.getState().setView('mind')
    useStore.getState().pushLog('demo: beliefs updated — showing what changed', 'system')
    await wait(3000)

    useStore.getState().setView('organism')
    useStore.getState().setDemo(false)
    useStore.getState().pushLog('demo playback complete', 'system')
    running.current = false
  }, [])

  // ?demo=1 autostarts once the data has loaded.
  const loading = useStore((s) => s.loading)
  useEffect(() => {
    if (loading) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') === '1') void run()
  }, [loading, run])

  return run
}
