import { expect, test } from '@playwright/test'
import { gameScriptPerFrame, openBlocks, previewFrame, usePrefs } from './helpers.ts'

/**
 * Performance of the game templates (SPEC § 8, J10): each game, being played in the live
 * preview, keeps its JavaScript within a 60 fps frame on a CPU slowed down 4× (an average
 * phone). Same measure as `game-perf.spec.ts`; `scriptMs` counts all the preview's
 * JavaScript, the blocks' code included. The numbers are printed; the PR quotes them.
 */

/** Each game, and what a player keeps doing during the measure (inside the preview). */
const GAMES = [
  ['buzzy-bee', 'tap'],
  ['cloud-hopper', 'none'],
  ['wiggle-snake', 'turn'],
  ['robo-dash', 'jump'],
  ['galaxy-patrol', 'none'],
  ['puck-clash', 'none'],
] as const

for (const [game, player] of GAMES) {
  test(`game template ${game} fits a frame`, async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    await usePrefs(page, { mode: 'studio', theme: 'light', locale: 'fr' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
    await page.getByRole('dialog').getByTestId(`template-${game}`).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Créer depuis ce modèle' }).click()
    await page.waitForURL(/\/p\/[^/]+/)
    await openBlocks(page)
    const frame = await previewFrame(page)
    const play = frame.locator('[data-rx-stage] [data-rx-name="BoutonJouer"]:not([data-rx-clone])')
    await expect(play.locator('img')).toHaveJSProperty('complete', true)
    await play.dispatchEvent('pointerdown', { pointerId: 1, bubbles: true })
    await play.dispatchEvent('pointerup', { pointerId: 1, bubbles: true })
    // The player, played by the page itself (no round trip through Playwright).
    await frame.evaluate((player) => {
      const stage = document.querySelector('[data-rx-stage]')
      const keys = ['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']
      let turn = 0
      setInterval(
        () => {
          if (player === 'tap') {
            stage?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }))
            stage?.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }))
          } else if (player === 'turn' || player === 'jump') {
            const key = player === 'jump' ? ' ' : (keys[turn++ % 4] ?? ' ')
            window.dispatchEvent(new KeyboardEvent('keydown', { key }))
            window.dispatchEvent(new KeyboardEvent('keyup', { key }))
          }
        },
        player === 'turn' ? 700 : player === 'jump' ? 500 : 330,
      )
    }, player)
    await page.waitForTimeout(500)
    const session = await page
      .context()
      .newCDPSession(frame)
      .catch(() => page.context().newCDPSession(page))
    const normal = await gameScriptPerFrame(session, frame, 3)
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const phone = await gameScriptPerFrame(session, frame, 3)
    await session.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    const report = { game, normal, cpuSlowedDown4x: phone }
    console.log(`Template performance: ${JSON.stringify(report)}`)
    await testInfo.attach(`${game}-performance.json`, {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    })
    // All the game's JavaScript fits half a 60 fps frame on a slowed-down CPU.
    expect(phone.scriptMs).toBeLessThan(16.7 / 2)
  })
}
