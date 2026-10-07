import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { ADMIN, signIn, unique, usePrefs } from './helpers.ts'

test('RGPD: download my data, then delete my account', async ({ browser }) => {
  const username = `rgpd-${unique()}`
  const password = 'rgpd-password'
  const admin = await (await browser.newContext({ locale: 'fr-FR' })).newPage()
  await usePrefs(admin, { locale: 'fr' })
  await signIn(admin, ADMIN.username, ADMIN.password)
  const created = await admin.request.post('/api/admin/users', {
    headers: { origin: new URL(admin.url()).origin },
    data: { username, displayName: 'Alex', password },
  })
  expect(created.status()).toBe(201)

  const page = await (await browser.newContext({ locale: 'fr-FR' })).newPage()
  await usePrefs(page, { locale: 'fr', mode: 'studio' })
  await signIn(page, username, password)
  await page.goto('/account')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger mes données' }).click()
  const file = await (await download).path()
  const data = JSON.parse(await readFile(file, 'utf8'))
  expect(data.profile.username).toBe(username)

  await page.getByRole('button', { name: 'Supprimer mon compte' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Mot de passe actuel').fill('not-my-password')
  await dialog.getByRole('button', { name: 'Supprimer pour toujours' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Ce n’est pas le bon mot de passe.')
  await dialog.getByLabel('Mot de passe actuel').fill(password)
  await dialog.getByRole('button', { name: 'Supprimer pour toujours' }).click()
  await expect(page.getByText('Ton compte est supprimé.', { exact: false })).toBeVisible()
  await expect(page.getByTestId('user-menu')).toHaveCount(0)

  const again = await page.request.post('/api/auth/sign-in/username', {
    headers: { origin: new URL(page.url()).origin },
    data: { username, password },
  })
  expect(again.status()).toBe(401)
})
