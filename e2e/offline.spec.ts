import { expect, test } from '@playwright/test'
import { ADMIN, addComponent, signIn, unique, usePrefs } from './helpers.ts'

test('edits made without a connection are kept, then reach the server', async ({
  page,
  context,
}) => {
  await usePrefs(page, { locale: 'fr', mode: 'studio' })
  await signIn(page, ADMIN.username, ADMIN.password)
  const name = `Hors ligne ${unique()}`
  await page
    .getByRole('button', { name: /Nouveau projet|C’est parti/ })
    .first()
    .click()
  await page.getByRole('dialog').getByRole('textbox').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')

  await context.setOffline(true)
  await addComponent(page, 'Button')
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'offline', {
    timeout: 20_000,
  })
  await context.setOffline(false)
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved', {
    timeout: 20_000,
  })
  await page.reload()
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
})
