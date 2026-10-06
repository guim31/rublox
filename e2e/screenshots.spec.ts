import { expect, type Page, test } from '@playwright/test'
import {
  addComponent,
  buildHelloBlocks,
  newProject,
  openBlocks,
  preview,
  usePrefs,
} from './helpers.ts'

/**
 * PR screenshots (SPEC § 7): Junior and Studio, light and dark, Design and Blocks.
 * `pnpm screenshots` writes them to docs/screenshots/j0/.
 */
const DIR = 'docs/screenshots/j0'

async function demoProject(page: Page) {
  await newProject(page, 'Le dé magique')
  await addComponent(page, 'Text')
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Le dé magique 🎲')
  await page.getByRole('spinbutton', { name: 'taille', exact: true }).fill('30')
  await page.getByRole('switch', { name: 'gras' }).click()
  await addComponent(page, 'Image')
  await addComponent(page, 'TextInput')
  await addComponent(page, 'Button')
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Lancer le dé')
  await addComponent(page, 'Text')
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Appuie sur le bouton !')
  await page.getByTestId('layer-Texte2').click()
}

for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${mode} ${theme}`, async ({ page }) => {
      await usePrefs(page, { mode, theme, locale: 'fr' })
      if (mode === 'junior' && theme === 'light') {
        await page.goto('/')
        await page.screenshot({ path: `${DIR}/dashboard-empty.png` })
      }
      await demoProject(page)
      await page.mouse.move(0, 0)
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${DIR}/${mode}-${theme}-design.png` })

      await openBlocks(page)
      await page.getByRole('button', { name: 'Masquer la console' }).click()
      // Blocks for the second text: "when Bouton1 is clicked, set Texte2.text to …".
      await buildHelloBlocks(page, 'Tu as fait un 6 !', 'Texte2')
      await page.locator('.blocklyMainBackground').click({ position: { x: 600, y: 420 } })
      const app = preview(page)
      await expect(async () => {
        await app.locator('[data-rx-name="Bouton1"]').dispatchEvent('click')
        await expect(app.locator('[data-rx-name="Texte2"]')).toHaveText('Tu as fait un 6 !', {
          timeout: 500,
        })
      }).toPass({ timeout: 10_000 })
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${DIR}/${mode}-${theme}-blocks.png` })

      if (mode === 'junior' && theme === 'light') {
        await page.goto('/')
        await page.waitForTimeout(500)
        await page.screenshot({ path: `${DIR}/dashboard.png` })
      }
    })
  }
}
