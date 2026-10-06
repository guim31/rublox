import { expect, test } from '@playwright/test'
import { addComponent, buildHelloBlocks, newProject, openBlocks, preview } from './helpers.ts'

test('guest: Button + Text, "when Bouton1 is clicked set Texte1.text to Bonjour", click in the preview', async ({
  page,
}) => {
  await newProject(page, 'Bonjour')
  await addComponent(page, 'Button')
  await addComponent(page, 'Text')
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  await expect(page.getByTestId('layer-Texte1')).toBeVisible()

  await openBlocks(page)
  await buildHelloBlocks(page, 'Bonjour')

  const app = preview(page)
  await expect(app.locator('[data-rx-name="Texte1"]')).toHaveText('Texte')
  // The preview receives the new code ~150 ms after the last change.
  await expect(async () => {
    await app.locator('[data-rx-name="Bouton1"]').click()
    await expect(app.locator('[data-rx-name="Texte1"]')).toHaveText('Bonjour', { timeout: 500 })
  }).toPass({ timeout: 10_000 })
})
