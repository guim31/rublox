import { expect, test } from '@playwright/test'
import { ADMIN, AI_STATE, AI_URL, openBlocks, preview, signIn } from './helpers.ts'

// The server of these tests has an `ANTHROPIC_API_KEY` and talks to a fake Claude API
// (`e2e/fake-anthropic.mjs`): the whole path runs, with no real key and no network.
test.use({ baseURL: AI_URL, storageState: AI_STATE })
// One database for the file: the administrator turns the assistant on once.
test.describe.configure({ mode: 'serial' })

test('the administrator turns the assistant on and sets the quota', async ({ page }) => {
  await signIn(page, ADMIN.username, ADMIN.password)
  // Present on this server, but off until the administrator turns it on.
  await expect(page.getByTestId('ai-create-open')).toHaveCount(0)
  await page.goto('/admin?section=settings')
  await page.getByLabel('Assistant IA activé').click()
  await page.getByLabel('Questions à l’IA par compte et par jour').fill('30')
  await page.getByRole('button', { name: 'Enregistrer' }).first().click()
  await expect(page.getByText('Réglages enregistrés.').first()).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('ai-create-open')).toBeVisible()
})

test('"Create with AI" proposes a valid app, declined then kept, and undoable', async ({
  page,
}) => {
  await signIn(page, ADMIN.username, ADMIN.password)
  const open = page.getByTestId('ai-create-open')
  await open.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Une appli qui tire au sort qui fait la vaisselle' }).click()
  await dialog.getByRole('button', { name: 'Proposer une appli' }).click()
  const proposal = dialog.getByTestId('ai-proposal')
  await expect(proposal).toBeVisible()
  await expect(proposal).toContainText('Qui fait la vaisselle ?')
  await expect(proposal).toContainText(/1 écran\(s\), 4 composant\(s\), 8 bloc\(s\)/)

  // Declined: nothing is created.
  await proposal.getByRole('button', { name: 'Refuser' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ouvrir Qui fait la vaisselle ?' })).toHaveCount(0)

  // Kept: a project, which opens and runs.
  await open.click()
  await page.getByRole('dialog').getByRole('textbox').fill('Une appli pour la vaisselle')
  await page.getByRole('dialog').getByRole('button', { name: 'Proposer une appli' }).click()
  await page.getByRole('button', { name: 'Garder cette appli' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(page.getByTestId('layer-Tirer')).toBeVisible()
  await expect(page.getByTestId('layer-Gagnant')).toBeVisible()
  await openBlocks(page)
  const app = preview(page)
  await expect(app.locator('[data-rx-name="Tirer"]')).toBeVisible()

  // "Undo" in the toast removes it.
  await page.getByRole('button', { name: 'Annuler' }).last().click()
  await expect(page.getByText('Appli supprimée.')).toBeVisible()
  await page.waitForURL(/\/$|\/\?/)
  await expect(page.getByRole('button', { name: 'Ouvrir Qui fait la vaisselle ?' })).toHaveCount(0)
})

test('"Explain" and "Why doesn\'t it work?" answer in the editor', async ({ page }) => {
  await signIn(page, ADMIN.username, ADMIN.password)
  await page.getByTestId('ai-create-open').click()
  await page.getByRole('dialog').getByRole('textbox').fill('Une appli pour la vaisselle')
  await page.getByRole('dialog').getByRole('button', { name: 'Proposer une appli' }).click()
  await page.getByRole('button', { name: 'Garder cette appli' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await openBlocks(page)

  await page.getByTestId('ai-explain-screen').click()
  const panel = page.getByTestId('ai-panel')
  await expect(panel.getByTestId('ai-answer')).toContainText('choisit un prénom au hasard')
  await panel.getByRole('button', { name: 'Fermer' }).click()

  await page.getByTestId('ai-debug-open').click()
  await panel.getByLabel('Ce que tu attendais (facultatif)').fill('Le prénom devrait s’afficher.')
  await panel.getByRole('button', { name: 'Chercher le problème' }).click()
  await expect(panel.getByTestId('ai-answer')).toContainText('la liste des prénoms est vide')
  await expect(panel.getByRole('listitem')).toHaveCount(2)

  // The AI component is in the palette, and answers in the preview.
  await page.getByRole('button', { name: /^Design$/ }).click()
  await expect(page.getByTestId('palette-AI')).toBeVisible()
})

test('the usage journal lists every question', async ({ page }) => {
  await signIn(page, ADMIN.username, ADMIN.password)
  await page.goto('/admin?section=settings')
  const journal = page.getByTestId('ai-journal')
  await expect(journal).toBeVisible()
  await expect(journal.getByRole('row').filter({ hasText: 'Créer' }).first()).toBeVisible()
  await expect(journal.getByRole('row').filter({ hasText: 'Déboguer' }).first()).toBeVisible()
  await expect(journal.getByRole('row').filter({ hasText: 'Expliquer' }).first()).toBeVisible()
})
