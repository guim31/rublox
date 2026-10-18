import { expect, test } from '@playwright/test'
import {
  frameRate,
  gameScriptPerFrame,
  newProject,
  openBlocks,
  openDemo,
  previewFrame,
} from './helpers.ts'

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
  // The preview is on the other origin: its own process when the browser isolates sites,
  // otherwise the page's (then throttling and profiling the page covers it too).
  const session = await page
    .context()
    .newCDPSession(frame)
    .catch(() => page.context().newCDPSession(page))
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
  // The game keeps up with what the machine can draw (without a GPU, drawing 50 moving
  // sprites costs more than one square: a loose guard)…
  expect(normal.fps).toBeGreaterThan(ceiling.fps * 0.6)
  // …and its own work fits a third of a 60 fps frame on a slowed-down CPU.
  expect(phone.gameMs).toBeLessThan(16.7 / 3)
})
