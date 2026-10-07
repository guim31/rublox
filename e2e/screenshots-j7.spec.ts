import { expect, test } from '@playwright/test'
import { openBlocks, openDemo, preview, usePrefs } from './helpers.ts'

/**
 * PR screenshots of J7 (SPEC § 7): the catch game demo in Junior and Studio, light and dark;
 * the designer with a sprite selected (free placement, size and rotation handles), the blocks
 * with the game running in the preview, and English. `pnpm screenshots` writes them to
 * docs/screenshots/j7/.
 */
const DIR = 'docs/screenshots/j7'

for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`game ${mode} ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await usePrefs(page, { mode, theme, locale: 'fr' })
      await openDemo(page, /Attrape les fruits/)
      await page.getByTestId('layer-Panier').click()
      await expect(page.getByTestId('selection-box')).toBeVisible()
      await page.mouse.move(0, 0)
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${DIR}/${mode}-${theme}-design.png` })

      await openBlocks(page)
      await expect(preview(page).locator('[data-rx-stage] [data-rx-clone]').first()).toBeAttached({
        timeout: 5_000,
      })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${DIR}/${mode}-${theme}-blocks.png` })
    })
  }
}

test('game in English, costumes editor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, { mode: 'studio', theme: 'light', locale: 'en' })
  await openDemo(page, /Catch the fruit/, 'game demo')
  await page.getByTestId('layer-Fruit').click()
  await page.getByRole('button', { name: 'Add a costume' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${DIR}/studio-light-en-costumes.png` })
})
