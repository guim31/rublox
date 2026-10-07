import { type Browser, expect, type Page, test } from '@playwright/test'
import { ADMIN, addComponent, signIn, unique, usePrefs } from './helpers.ts'

/**
 * Editing a project with several people at once (SPEC § 4.9, J4b): Alice owns the project, Bob
 * edits it with her, Cléo may only look. Each one has a browser of their own.
 */

type Person = { page: Page; username: string; name: string }

async function person(
  browser: Browser,
  name: string,
  mode: 'junior' | 'studio' = 'studio',
): Promise<Person> {
  const username = `${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '')}-${unique()}`
  const context = await browser.newContext({ locale: 'fr-FR' })
  const page = await context.newPage()
  await usePrefs(page, { locale: 'fr', mode, theme: 'light' })
  return { page, username, name }
}

/** Alice's new project, shared with Bob (editor) and Cléo (viewer), open in the three browsers. */
async function team(browser: Browser, options: { cleo?: boolean } = {}) {
  const alice = await person(browser, 'Alice')
  const bob = await person(browser, 'Bob')
  const cleo = await person(browser, 'Cléo')
  const people = options.cleo === false ? [alice, bob] : [alice, bob, cleo]

  const admin = await (await browser.newContext()).newPage()
  await admin.goto('/login')
  const origin = new URL(admin.url()).origin
  const post = async (page: Page, path: string, data: unknown, method = 'POST') => {
    const response = await page.request.fetch(path, { method, data, headers: { origin } })
    expect(response.ok(), path).toBe(true)
  }
  await post(admin, '/api/auth/sign-in/username', ADMIN)
  for (const p of people) {
    await post(admin, '/api/admin/users', {
      username: p.username,
      displayName: p.name,
      password: `${p.username}-password`,
    })
  }
  await admin.context().close()

  for (const p of people) await signIn(p.page, p.username, `${p.username}-password`)
  await alice.page
    .getByRole('button', { name: /Nouveau projet|C’est parti/ })
    .first()
    .click()
  await alice.page.getByRole('dialog').getByRole('textbox').fill(`Ensemble ${unique()}`)
  await alice.page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await alice.page.waitForURL(/\/p\/[^/?]+/)
  const projectId = new URL(alice.page.url()).pathname.split('/')[2] ?? ''
  await expect(alice.page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
  await post(
    alice.page,
    `/api/projects/${projectId}/members`,
    { username: bob.username, role: 'editor' },
    'PUT',
  )
  if (people.includes(cleo)) {
    await post(
      alice.page,
      `/api/projects/${projectId}/members`,
      { username: cleo.username, role: 'viewer' },
      'PUT',
    )
  }
  for (const p of people.slice(1)) {
    await p.page.goto(`/p/${projectId}?tab=design`)
    await expect(p.page.getByTestId('canvas-screen')).toBeVisible()
  }
  return { alice, bob, cleo, projectId }
}

test('two editors see each other, and each other’s edits within a second', async ({ browser }) => {
  const { alice, bob, cleo } = await team(browser)

  // Presence: Alice sees Bob and Cléo, Cléo only looking.
  await expect(alice.page.getByTestId('presence')).toHaveAttribute('data-count', '2')
  await alice.page.getByTestId('presence').click()
  const entries = alice.page.getByTestId('presence-person')
  await expect(entries).toHaveCount(2)
  await expect(entries.filter({ hasText: 'Bob' })).toContainText('Design · Accueil')
  await expect(entries.filter({ hasText: 'Cléo' })).toContainText('Regarde seulement')
  await alice.page.keyboard.press('Escape')

  // A component added by Alice reaches Bob in less than a second.
  await addComponent(alice.page, 'Button')
  await expect(bob.page.getByTestId('layer-Bouton1')).toBeVisible({ timeout: 1000 })
  await expect(cleo.page.getByTestId('layer-Bouton1')).toBeVisible({ timeout: 1000 })

  // Bob sees what Alice selects, in her colour, on his canvas.
  await alice.page.getByTestId('layer-Bouton1').click()
  const selection = bob.page.getByTestId('peer-selection')
  await expect(selection).toHaveAttribute('data-user', 'Alice')
  await expect(bob.page.getByTestId('peer-label')).toHaveText('Alice')
  // And where she is: Bob follows her to the Blocks tab from the presence menu.
  await alice.page.getByRole('button', { name: /^Blocs$/ }).click()
  await bob.page.getByTestId('presence').click()
  await expect(bob.page.getByTestId('presence-person').filter({ hasText: 'Alice' })).toContainText(
    'Blocs · Accueil',
  )
  await bob.page.getByTestId('presence-person').filter({ hasText: 'Alice' }).click()
  await expect(bob.page.locator('.blocklySvg').first()).toBeVisible()
})

test('a viewer sees the edits live but changes nothing', async ({ browser }) => {
  const { alice, bob, cleo } = await team(browser)
  await expect(cleo.page.getByTestId('save-state')).toHaveAttribute('data-state', 'readonly')
  await addComponent(alice.page, 'Button')
  await expect(cleo.page.getByTestId('layer-Bouton1')).toBeVisible({ timeout: 1000 })
  // Cléo may try things in her tab: nothing leaves it.
  await addComponent(cleo.page, 'Text')
  await expect(cleo.page.getByTestId('layer-Texte1')).toBeVisible()
  await addComponent(alice.page, 'Image')
  await expect(bob.page.getByTestId('layer-Image1')).toBeVisible()
  await expect(bob.page.getByTestId('layer-Texte1')).toHaveCount(0)
  await expect(alice.page.getByTestId('layer-Texte1')).toHaveCount(0)
  await cleo.page.reload()
  await expect(cleo.page.getByTestId('layer-Image1')).toBeVisible()
  await expect(cleo.page.getByTestId('layer-Texte1')).toHaveCount(0)
})

test('undo takes back one’s own edits only', async ({ browser }) => {
  const { alice, bob } = await team(browser, { cleo: false })
  await addComponent(alice.page, 'Button')
  await expect(bob.page.getByTestId('layer-Bouton1')).toBeVisible()
  await addComponent(bob.page, 'Text')
  await expect(alice.page.getByTestId('layer-Texte1')).toBeVisible()
  await alice.page.getByRole('button', { name: 'Annuler' }).click()
  await expect(alice.page.getByTestId('layer-Bouton1')).toHaveCount(0)
  await expect(alice.page.getByTestId('layer-Texte1')).toBeVisible()
  await expect(bob.page.getByTestId('layer-Bouton1')).toHaveCount(0)
  await expect(bob.page.getByTestId('layer-Texte1')).toBeVisible()
  // Bob's undo stack still holds his text, not Alice's button.
  await bob.page.getByRole('button', { name: 'Annuler' }).click()
  await expect(bob.page.getByTestId('layer-Texte1')).toHaveCount(0)
  await expect(alice.page.getByTestId('layer-Texte1')).toHaveCount(0)
  await alice.page.getByRole('button', { name: 'Rétablir' }).click()
  await expect(bob.page.getByTestId('layer-Bouton1')).toBeVisible()
})

test('what two people did offline is merged when they are back', async ({ browser }) => {
  const { alice, bob } = await team(browser, { cleo: false })
  for (const p of [alice, bob]) await p.page.context().setOffline(true)
  for (const p of [alice, bob]) {
    await expect(p.page.getByTestId('save-state')).toHaveAttribute('data-state', 'offline', {
      timeout: 20_000,
    })
  }
  await addComponent(alice.page, 'Button')
  await addComponent(bob.page, 'Text')
  for (const p of [alice, bob]) await p.page.context().setOffline(false)
  for (const p of [alice, bob]) {
    await expect(p.page.getByTestId('layer-Bouton1')).toBeVisible({ timeout: 20_000 })
    await expect(p.page.getByTestId('layer-Texte1')).toBeVisible({ timeout: 20_000 })
    await expect(p.page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
  }
})
