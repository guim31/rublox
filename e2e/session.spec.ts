import { expect, type Page, test } from '@playwright/test'
import { ADMIN, addComponent, signIn, unique, usePrefs } from './helpers.ts'

/** Every HTTP answer the page received, to prove that none is a 401 (SPEC § 6.9). */
function recordStatuses(page: Page) {
  const seen: { status: number; url: string }[] = []
  page.on('response', (response) => seen.push({ status: response.status(), url: response.url() }))
  return seen
}

test('a session revoked elsewhere is noticed without a single 401', async ({ browser }) => {
  const username = `sess-${unique()}`
  const password = 'session-password'

  // The admin creates a dedicated account (revoking its sessions touches no other test).
  const adminContext = await browser.newContext({ locale: 'fr-FR' })
  const admin = await adminContext.newPage()
  await usePrefs(admin, { locale: 'fr' })
  await signIn(admin, ADMIN.username, ADMIN.password)
  const created = await admin.request.post('/api/admin/users', {
    headers: { origin: new URL(admin.url()).origin },
    data: { username, displayName: 'Sam', password },
  })
  expect(created.status()).toBe(201)

  // Sam works on a project.
  const context = await browser.newContext({ locale: 'fr-FR' })
  const page = await context.newPage()
  const statuses = recordStatuses(page)
  await usePrefs(page, { locale: 'fr', mode: 'studio' })
  await signIn(page, username, password)
  await page
    .getByRole('button', { name: /Nouveau projet|C’est parti/ })
    .first()
    .click()
  await page.getByRole('dialog').getByRole('textbox').fill('Projet de Sam')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await addComponent(page, 'Button')
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')

  // From another device, Sam signs out everywhere else.
  const other = await (await browser.newContext({ locale: 'fr-FR' })).newPage()
  await usePrefs(other, { locale: 'fr' })
  await signIn(other, username, password)
  const revoked = await other.request.post('/api/auth/revoke-other-sessions', {
    headers: { origin: new URL(other.url()).origin },
    data: {},
  })
  expect(revoked.status()).toBe(200)

  // Back on the first tab: going on working, then back to the dashboard.
  await addComponent(page, 'Text')
  await page.getByRole('link', { name: 'Tableau de bord' }).click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Tu as été déconnecté·e. Reconnecte-toi.')).toBeVisible()

  // And when the tab comes back to the foreground, `/api/me` (200) is what tells.
  await signIn(page, username, password)
  await other.request.post('/api/auth/revoke-other-sessions', {
    headers: { origin: new URL(other.url()).origin },
    data: {},
  })
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect(page).toHaveURL(/\/login/)

  const unauthorized = statuses.filter((entry) => entry.status === 401)
  expect(unauthorized).toEqual([])
  expect(statuses.some((entry) => entry.url.endsWith('/api/me') && entry.status === 200)).toBe(true)
})
