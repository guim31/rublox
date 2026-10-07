import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { ADMIN, addComponent, newProject, signIn, usePrefs } from './helpers.ts'

async function check(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('[data-testid=preview-frame]')
    .exclude('[data-testid=canvas-screen]')
    .analyze()
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}

/** Axe on the Data tab (J5): a table, an API connection, the secrets, a binding. */
for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe, data: ${mode}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await usePrefs(page, { mode, theme, locale: 'fr' })
      await signIn(page, ADMIN.username, ADMIN.password)
      await newProject(page, 'Données')
      await addComponent(page, 'Chart')
      await page.getByRole('button', { name: /^Données$/ }).click()
      await check(page)
      await page.getByRole('button', { name: 'Nouvelle table' }).click()
      await page.getByRole('button', { name: 'Ajouter une ligne' }).click()
      await expect(page.getByLabel('Colonne, ligne 1')).toBeVisible()
      await check(page)
      await page.getByRole('button', { name: 'Nouvelle connexion' }).click()
      await page.getByRole('button', { name: 'Ajouter un paramètre' }).click()
      await check(page)
      await page.getByRole('button', { name: 'Secrets' }).click()
      await check(page)
      await page.getByRole('button', { name: /^Design$/ }).click()
      await page.getByTestId('layer-Graphique1').click()
      const more = page.getByRole('button', { name: 'Plus d’options' })
      if (await more.isVisible()) await more.click()
      await page.getByLabel('source (table)').selectOption({ label: 'Table' })
      await check(page)
    })
  }
}
