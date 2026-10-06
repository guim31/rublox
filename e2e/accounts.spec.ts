import { type Browser, expect, type Page, test } from '@playwright/test'
import { ADMIN, addComponent, signIn, unique, usePrefs } from './helpers.ts'

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: 'fr-FR' })
  const page = await context.newPage()
  await usePrefs(page, { locale: 'fr', theme: 'light', mode: 'junior' })
  return page
}

/** The admin creates an invitation and returns its link. */
async function createInvite(page: Page, note: string): Promise<string> {
  await page.goto('/admin?section=invites')
  await page.getByRole('button', { name: 'Créer une invitation' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Pour qui ? (note)').fill(note)
  await dialog.getByRole('button', { name: 'Créer une invitation' }).click()
  const link = await dialog.getByTestId('invite-link').inputValue()
  expect(link).toMatch(/\/invite\/[\w-]+$/)
  await dialog.getByRole('button', { name: 'Fermer' }).first().click()
  await expect(page.getByText(note)).toBeVisible()
  return link
}

test('SPEC § 8, J1: the admin invites a parent, who creates a family and a child account; the child makes a project the parent sees', async ({
  browser,
}) => {
  const suffix = unique()
  const parentName = `parent-${suffix}`
  const childName = `lou-${suffix}`

  // 1. The admin creates an invitation.
  const admin = await newPage(browser)
  await signIn(admin, ADMIN.username, ADMIN.password)
  const link = await createInvite(admin, `Camille ${suffix}`)

  // 2. The parent signs up with it.
  const parent = await newPage(browser)
  await parent.goto(link)
  await expect(parent.getByRole('heading', { name: 'Bienvenue sur Rublox' })).toBeVisible()
  await parent.getByLabel('Ton nom').fill('Camille')
  await parent.getByLabel('Identifiant').fill(parentName)
  await parent.getByLabel('Mot de passe', { exact: true }).fill('camille-password')
  await parent.getByLabel('Confirme le mot de passe').fill('camille-password')
  await parent.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(parent.getByRole('heading', { name: 'Mes projets' })).toBeVisible()
  await expect(parent.getByTestId('user-menu')).toBeVisible()

  // 3. The parent creates the family space and a child account.
  await parent.getByRole('link', { name: 'Espaces' }).click()
  await parent.getByRole('button', { name: 'Créer un espace' }).click()
  await parent.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await expect(parent.getByRole('heading', { name: 'Ma famille' })).toBeVisible()
  await parent.getByRole('button', { name: 'Créer un compte' }).click()
  const dialog = parent.getByRole('dialog')
  await dialog.getByLabel('Ton nom').fill('Lou')
  await dialog.getByLabel('Identifiant').fill(childName)
  await dialog.getByLabel('Mot de passe').fill('lou-password')
  await dialog.getByRole('button', { name: 'Créer' }).click()
  await expect(parent.getByTestId(`member-${childName}`)).toBeVisible()

  // 4. The child signs in and creates a project.
  const child = await newPage(browser)
  await signIn(child, childName, 'lou-password')
  await child
    .getByRole('button', { name: /Nouveau projet|C’est parti/ })
    .first()
    .click()
  await child.getByRole('dialog').getByRole('textbox').fill('Le jeu de Lou')
  await child.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await child.waitForURL(/\/p\/[^/]+/)
  await addComponent(child, 'Button')
  await expect(child.getByTestId('layer-Bouton1')).toBeVisible()
  await expect(child.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')

  // 5. The parent sees it: in the space and in the dashboard, read-only.
  await parent.getByRole('radio', { name: 'Projets' }).click()
  await expect(parent.getByRole('link', { name: 'Le jeu de Lou' })).toBeVisible()
  await parent.goto('/')
  await expect(parent.getByRole('button', { name: 'Ouvrir Le jeu de Lou' })).toBeVisible()
  await expect(parent.getByText('par Lou · Lecture seule')).toBeVisible()
  await parent.getByRole('button', { name: 'Ouvrir Le jeu de Lou' }).click()
  await expect(parent.getByText(/Tu regardes le projet de Lou/)).toBeVisible()
  await expect(parent.getByTestId('layer-Bouton1')).toBeVisible()
  await expect(parent.getByTestId('save-state')).toHaveAttribute('data-state', 'readonly')
})

test('a project of the account survives a reload and goes to the trash', async ({ page }) => {
  await usePrefs(page, { locale: 'fr', mode: 'studio' })
  await signIn(page, ADMIN.username, ADMIN.password)
  const name = `Serveur ${unique()}`
  await page
    .getByRole('button', { name: /Nouveau projet|C’est parti/ })
    .first()
    .click()
  await page.getByRole('dialog').getByRole('textbox').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await addComponent(page, 'Text')
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
  await page.reload()
  await expect(page.getByTestId('layer-Texte1')).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: `Actions sur ${name}` }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(page.getByRole('button', { name: `Ouvrir ${name}` })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Corbeille' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
})

test('guest projects move into the account at sign-in', async ({ page }) => {
  await usePrefs(page, { locale: 'fr' })
  const name = `Invité ${unique()}`
  await page.goto('/')
  await page
    .getByRole('button', { name: /Nouveau projet|C’est parti/ })
    .first()
    .click()
  await page.getByRole('dialog').getByRole('textbox').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await addComponent(page, 'Button')

  await signIn(page, ADMIN.username, ADMIN.password)
  await page.getByRole('button', { name: 'Ranger dans mon compte' }).click()
  await expect(page.getByText(/rangé\(s\) dans ton compte/)).toBeVisible()
  await page.getByRole('button', { name: `Ouvrir ${name}` }).click()
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
})

test('a wrong password says so, without leaking which part was wrong', async ({ page }) => {
  await usePrefs(page, { locale: 'fr' })
  await page.goto('/login')
  await page.getByLabel('Identifiant ou e-mail').fill(`nobody-${unique()}`)
  await page.getByLabel('Mot de passe', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Me connecter' }).click()
  await expect(page.getByRole('alert')).toHaveText('Identifiant ou mot de passe incorrect.')
})
