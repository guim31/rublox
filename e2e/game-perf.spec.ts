import type { CDPSession, Frame, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { newProject, openBlocks, openDemo } from './helpers.ts'

/**
 * Performance of the game mode (SPEC § 8, J7): 50 sprites that bounce and collide, in the
 * live preview.
 *
 * Two numbers, because a container without a GPU draws every moving pixel in software:
 * - the frame rate, next to the ceiling of the machine (one moving square in the same preview);
 * - the main-thread JavaScript of the game per frame (physics, collisions, events, DOM
 *   writes), with the CPU slowed down 4× (Chrome's "mid-tier mobile" preset) to stand for an
 *   average phone. A frame lasts 16.7 ms at 60 frames per second.
 * The numbers are printed and attached to the report; the PR quotes them.
 */

async function previewFrame(page: Page): Promise<Frame> {
  const handle = await page.getByTestId('preview-frame').elementHandle()
  const frame = await handle?.contentFrame()
  if (!frame) throw new Error('no preview frame')
  return frame
}

/** Frames per second over `seconds`, and the 95th percentile of the frame time. */
function frameRate(frame: Frame, seconds: number) {
  return frame.evaluate(async (duration) => {
    const intervals: number[] = []
    let last = performance.now()
    const end = last + duration * 1000
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        intervals.push(now - last)
        last = now
        if (now < end) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    intervals.shift()
    const sorted = [...intervals].sort((a, b) => a - b)
    const total = intervals.reduce((sum, value) => sum + value, 0)
    return {
      fps: Math.round((intervals.length / total) * 10000) / 10,
      p95: Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) / 10,
    }
  }, seconds)
}

/** Milliseconds of JavaScript per frame spent in `World.frame` (sampled by the profiler). */
async function gameScriptPerFrame(session: CDPSession, frame: Frame, seconds: number) {
  await session.send('Profiler.enable')
  await session.send('Profiler.setSamplingInterval', { interval: 100 })
  await session.send('Profiler.start')
  const rate = await frameRate(frame, seconds)
  const { profile } = await session.send('Profiler.stop')
  const samples = profile.samples ?? []
  const interval = (profile.endTime - profile.startTime) / 1000 / Math.max(1, samples.length)
  const hits = new Map<number, number>()
  for (const id of samples) hits.set(id, (hits.get(id) ?? 0) + 1)
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]))
  const subtree = (id: number): number =>
    (hits.get(id) ?? 0) +
    (nodes.get(id)?.children ?? []).reduce((sum, child) => sum + subtree(child), 0)
  let game = 0
  for (const node of profile.nodes) {
    // `World.frame` keeps its name in the build (class methods are not renamed).
    if (node.callFrame.functionName === 'frame') game += subtree(node.id)
  }
  const frames = rate.fps * seconds
  return { ...rate, gameMs: Math.round(((game * interval) / Math.max(1, frames)) * 100) / 100 }
}

test('50 sprites stay well within the frame budget', async ({ page }, testInfo) => {
  test.setTimeout(120_000)

  // The machine's ceiling: one square moving in an otherwise empty preview.
  await newProject(page, 'Plafond')
  await openBlocks(page)
  const empty = await previewFrame(page)
  await expect(empty.locator('[data-rx-type="Screen"]')).toBeVisible()
  await empty.evaluate(() => {
    const square = document.createElement('div')
    square.style.cssText = 'position:fixed;left:0;top:0;width:40px;height:40px;background:red'
    document.body.append(square)
    let x = 0
    const move = () => {
      x = (x + 2) % 300
      square.style.transform = `translate(${x}px, 100px)`
      requestAnimationFrame(move)
    }
    requestAnimationFrame(move)
  })
  const ceiling = await frameRate(empty, 3)

  await openDemo(page, /50 lutins/)
  await openBlocks(page)
  const frame = await previewFrame(page)
  await expect(frame.locator('[data-rx-stage] [data-rx-type="Sprite"]')).toHaveCount(50, {
    timeout: 15_000,
  })
  await page.waitForTimeout(1500)
  const session = await page.context().newCDPSession(frame)
  const normal = await gameScriptPerFrame(session, frame, 4)
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const phone = await gameScriptPerFrame(session, frame, 4)
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  const report = { sprites: 50, ceiling, normal, cpuSlowedDown4x: phone }
  console.log(`Game performance: ${JSON.stringify(report)}`)
  await testInfo.attach('game-performance.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  })
  // The game keeps up with whatever the machine can draw…
  expect(normal.fps).toBeGreaterThan(ceiling.fps * 0.8)
  // …and its own work fits a third of a 60 fps frame on a slowed-down CPU.
  expect(phone.gameMs).toBeLessThan(16.7 / 3)
})
