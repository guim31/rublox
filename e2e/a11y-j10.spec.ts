import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { openBlocks, settled, usePrefs } from './helpers.ts'

/**
 * Axe on what J10 adds (SPEC § 5.1): the "New project" dialog on its games category, Junior and
 * Studio, light and dark, and the title screen of each game template, light and dark.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const GAMES = [
  'buzzy-bee',
  'cloud-hopper',
  'wiggle-snake',
  'robo-dash',
  'galaxy-patrol',
  'puck-clash',
]

async function violations(page: Page, include: string, where: string) {
  await settled(page)
  const results = await new AxeBuilder({ page }).withTags(TAGS).include(include).analyze()
  return results.violations.map(
    (v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
}

for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe, new project dialog on games: ${mode}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
      await usePrefs(page, { mode, theme, locale: 'fr' })
      await page.goto('/')
      await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
      const dialog = page.getByRole('dialog')
      await dialog.getByTestId('template-category-games').click()
      await expect(dialog.getByTestId('template-category-games')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await dialog.getByTestId('template-puck-clash').click()
      expect(await violations(page, '[role=dialog]', 'dialog')).toEqual([])
    })
  }
}

for (const game of GAMES) {
  test(`axe, game template title screen: ${game}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await usePrefs(page, { mode: 'studio', theme: 'light', locale: 'fr' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
    await page.getByRole('dialog').getByTestId(`template-${game}`).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Créer depuis ce modèle' }).click()
    await page.waitForURL(/\/p\/[^/]+/)
    await openBlocks(page)
    const app = page.frameLocator('[data-testid=preview-frame]')
    await expect(app.locator('[data-rx-name="BoutonJouer"] img')).toHaveJSProperty('complete', true)
    for (const scheme of ['light', 'dark'] as const) {
      if (scheme === 'dark') {
        await page.getByRole('button', { name: 'Appli en sombre' }).first().click()
        await expect(app.locator('.rx-app[data-scheme=dark]').first()).toBeVisible()
      }
      expect(await violations(page, '[data-testid=preview-frame]', scheme)).toEqual([])
    }
  })
}
