import { expect, type Page, test } from '@playwright/test'
import { addComponent, newProject, openBlocks, preview, usePrefs } from './helpers.ts'

/** Opens the demo app from the dashboard's command palette. */
async function openDemo(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /démonstration|demo app/i }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(page.getByTestId('canvas-screen')).toBeVisible()
}

test('the demo app opens in one click and runs every screen without an error', async ({ page }) => {
  await usePrefs(page, { consoleOpen: true } as never)
  await openDemo(page)
  // The design canvas shows the tab bar of the app.
  await expect(page.getByTestId('canvas-tabs')).toBeVisible()
  await openBlocks(page)
  const app = preview(page)
  await expect(app.locator('.rx-tabs')).toBeVisible()
  for (const tab of ['Saisie', 'Listes', 'Medias', 'Appareil', 'Tous les composants']) {
    await app.locator('.rx-tab', { hasText: tab }).dispatchEvent('click')
    await expect(app.locator('.rx-tab[aria-current="page"]')).toHaveText(tab)
  }
  // A tapped list item reaches its event with its value.
  await app.locator('.rx-tab', { hasText: 'Listes' }).dispatchEvent('click')
  await app.getByRole('button', { name: 'Mardi' }).dispatchEvent('click')
  await expect(app.locator('.rx-toast')).toHaveText('2 · Mardi')
  // Nothing went wrong: the console has no error.
  await page.waitForTimeout(500)
  await expect(page.getByLabel('error', { exact: true })).toHaveCount(0)
})

test('multiple selection, copy and paste into another screen', async ({ page }) => {
  await usePrefs(page, { mode: 'studio' })
  await newProject(page)
  await addComponent(page, 'Button')
  await addComponent(page, 'Slider')
  await page.getByTestId('layer-Bouton1').click()
  await page.getByTestId('layer-Curseur1').click({ modifiers: ['Shift'] })
  await expect(page.getByTestId('multi-inspector')).toContainText('2 composants sélectionnés')
  // A shared property changes both.
  await page
    .getByRole('switch', { name: /visible/i })
    .first()
    .click()
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  await page.getByTestId('canvas-screen').focus()
  await page.keyboard.press('Control+c')
  // Another screen, then paste.
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: 'Ajouter un écran' }).click()
  await expect(page.getByTestId('screen-picker')).toContainText('Ecran2')
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: 'Coller' }).click()
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  await expect(page.getByTestId('layer-Curseur1')).toBeVisible()
})

test('the app theme and a non-visual component', async ({ page }) => {
  await newProject(page)
  await addComponent(page, 'Button')
  await addComponent(page, 'Timer')
  await expect(page.getByTestId('non-visual-tray')).toContainText('Minuteur1')
  await page.getByTestId('layer-Accueil').click()
  await page.getByRole('radio', { name: 'Appli' }).click()
  await expect(page.getByTestId('app-settings')).toBeVisible()
  await page.getByRole('textbox', { name: 'Couleur principale (hex)' }).fill('#d9543a')
  const button = page.getByTestId('canvas-screen').locator('[data-rx-type="Button"]')
  await expect(button).toHaveCSS('background-color', 'rgb(217, 84, 58)')
})
