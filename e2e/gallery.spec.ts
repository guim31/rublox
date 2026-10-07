import { type Browser, expect, type Page, test } from '@playwright/test'
import {
  ADMIN,
  createAccount,
  newProject,
  openBlocks,
  preview,
  signIn,
  unique,
  usePrefs,
} from './helpers.ts'

/** A browser of its own, signed in. */
async function person(browser: Browser, account: { username: string; password: string }) {
  const context = await browser.newContext({
    locale: 'fr-FR',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${process.env.E2E_PORT ?? 4310}`,
          localStorage: [
            {
              name: 'rublox:prefs',
              value: JSON.stringify({
                state: { welcomed: true, toursSeen: { junior: true, studio: true } },
                version: 2,
              }),
            },
          ],
        },
      ],
    },
  })
  const page = await context.newPage()
  await signIn(page, account.username, account.password)
  return page
}

/** Creates a project from a template in the "New project" dialog. */
async function fromTemplate(page: Page, template: string, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByTestId(`template-${template}`).click()
  await dialog.getByRole('textbox', { name: 'Nom du projet' }).fill(name)
  await dialog.getByRole('button', { name: 'Créer depuis ce modèle' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(page.getByTestId('canvas-screen')).toBeVisible()
}

test('a template gives a working app, in guest mode too', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
  const dialog = page.getByRole('dialog')
  // Twelve templates, and the blank project.
  await expect(dialog.locator('[data-testid^="template-"]')).toHaveCount(13)
  await dialog.getByTestId('template-dice').click()
  // The name follows the chosen template until it is typed.
  await expect(dialog.getByRole('textbox', { name: 'Nom du projet' })).toHaveValue('Lance le dé')
  await dialog.getByRole('button', { name: 'Créer depuis ce modèle' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(page.getByTestId('layer-Lancer')).toBeVisible()
  await openBlocks(page)
  const app = preview(page)
  await expect(app.locator('[data-rx-name="Lancer"]')).toBeVisible()
  await expect(async () => {
    await app.locator('[data-rx-name="Lancer"]').dispatchEvent('click')
    await expect(app.locator('[data-rx-name="Resultat"]')).toHaveText(/Tu as fait [1-6]/, {
      timeout: 1000,
    })
  }).toPass()
})

test('gallery: share, like, remix with the credit, see the blocks', async ({ page, browser }) => {
  await signIn(page, ADMIN.username, ADMIN.password)
  const alice = await createAccount(page, 'Alice')
  const bob = await createAccount(page, 'Bob')
  const name = `Tableau ${unique()}`

  // Alice shares a project in the gallery from the editor's "Share" dialog.
  const a = await person(browser, alice)
  await fromTemplate(a, 'scoreboard', name)
  await a.getByRole('button', { name: 'Partager' }).click()
  const sharing = a.getByTestId('gallery-sharing')
  await expect(sharing).toBeVisible()
  await sharing.getByRole('switch').click()
  await expect(a.getByText('Ton projet est dans la galerie.')).toBeVisible()
  await expect(sharing.getByRole('link', { name: 'Voir dans la galerie' })).toBeVisible()

  // Bob finds it, likes it.
  const b = await person(browser, bob)
  await b.getByRole('link', { name: 'Galerie' }).click()
  await expect(b).toHaveURL(/\/gallery/)
  await b.getByRole('searchbox', { name: 'Chercher une appli ou une personne' }).fill(name)
  const card = b.getByTestId('gallery-grid').getByRole('listitem').first()
  await expect(card).toContainText(name)
  await expect(card).toContainText('par Alice')
  await card.getByRole('button', { name: 'J’aime' }).click()
  await expect(card.getByRole('button', { name: 'Je n’aime plus' })).toContainText('1')

  // Its page: "See the blocks" opens it read-only, with "Remix".
  await card.getByRole('button', { name: `Voir ${name}` }).click()
  const entry = b.getByTestId('gallery-entry')
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('Personne ne l’a encore remixée')
  await entry.getByRole('button', { name: 'Voir les blocs' }).click()
  await b.waitForURL(/\/p\/[^/]+\?tab=blocks/)
  await expect(b.getByText(/Projet de la galerie, par Alice/)).toBeVisible()
  await expect(b.getByRole('button', { name: 'Partager' })).toHaveCount(0)

  // "Remix": a copy in Bob's projects, which says where it comes from.
  await b.getByRole('note').getByRole('button', { name: 'Remixer' }).click()
  await expect(b.getByText('Remix créé dans tes projets.')).toBeVisible()
  await expect(b.getByText(/Projet de la galerie/)).toHaveCount(0)
  await b.goto('/')
  await expect(b.getByRole('button', { name: `Ouvrir ${name} (remix)` })).toBeVisible()

  // The gallery counts the remix, and shows the tree (the copy is private: counted only).
  await b.goto('/gallery')
  await b.getByRole('searchbox', { name: 'Chercher une appli ou une personne' }).fill(name)
  await expect(card).toContainText('1 remix')
  await card.getByRole('button', { name: `Voir ${name}` }).click()
  await expect(b.getByTestId('gallery-entry')).toContainText('1 remix privé')
  await b.context().close()
  await a.context().close()
})

test('no trace of the AI without ANTHROPIC_API_KEY', async ({ page }) => {
  await usePrefs(page, { mode: 'studio' })
  await signIn(page, ADMIN.username, ADMIN.password)
  await expect(page.getByRole('button', { name: 'Nouveau projet' }).first()).toBeVisible()
  await expect(page.getByTestId('ai-create-open')).toHaveCount(0)
  await expect(page.getByText(/IA\b|intelligence/i)).toHaveCount(0)

  await page.goto('/admin?section=settings')
  await expect(page.getByLabel('Galerie activée')).toBeVisible()
  await expect(page.getByText(/IA/)).toHaveCount(0)

  await newProject(page, `Sans IA ${unique()}`)
  await expect(page.getByTestId('palette-Clipboard')).toBeVisible()
  await expect(page.getByTestId('palette-AI')).toHaveCount(0)
  await expect(page.getByTestId('ai-debug-open')).toHaveCount(0)
  await openBlocks(page)
  await expect(page.getByTestId('ai-explain-screen')).toHaveCount(0)
})
