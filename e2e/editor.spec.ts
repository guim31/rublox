import { expect, test } from '@playwright/test'
import {
  addComponent,
  blockOfType,
  buildHelloBlocks,
  dropEvent,
  dropInside,
  dropOnValue,
  flyoutBlock,
  newProject,
  openBlocks,
  openCategory,
  preview,
  usePrefs,
} from './helpers.ts'

test('undo and redo', async ({ page }) => {
  await newProject(page)
  await addComponent(page, 'Button')
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  await page.getByTestId('canvas-screen').click()
  await page.keyboard.press('Control+z')
  await expect(page.getByTestId('layer-Bouton1')).toHaveCount(0)
  await page.keyboard.press('Control+Shift+z')
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).first().click()
  await expect(page.getByTestId('layer-Bouton1')).toHaveCount(0)
  await page.getByRole('button', { name: 'Rétablir' }).click()
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
})

test('undo works on blocks too', async ({ page }) => {
  await newProject(page)
  await addComponent(page, 'Button')
  await addComponent(page, 'Text')
  await openBlocks(page)
  await buildHelloBlocks(page, 'Salut')
  await expect(blockOfType(page, 'rx_Button_on_click')).toBeVisible()
  const undo = page.getByRole('button', { name: 'Annuler' }).first()
  const redo = page.getByRole('button', { name: 'Rétablir' })
  // Undo step by step until the setter is gone, then redo until it is back.
  for (let i = 0; i < 8 && (await blockOfType(page, 'rx_Text_set').count()) > 0; i++) {
    await undo.click()
    await page.waitForTimeout(150)
  }
  await expect(blockOfType(page, 'rx_Text_set')).toHaveCount(0)
  for (let i = 0; i < 8 && (await blockOfType(page, 'rx_Text_set').count()) === 0; i++) {
    await redo.click()
    await page.waitForTimeout(150)
  }
  await expect(blockOfType(page, 'rx_Text_set')).toBeVisible()
})

test('reloading the page brings the project back', async ({ page }) => {
  await newProject(page, 'Projet gardé')
  await addComponent(page, 'Button')
  await addComponent(page, 'Text')
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Coucou')
  await page.waitForTimeout(800)
  await page.reload()
  await expect(page.getByTestId('layer-Texte1')).toBeVisible()
  await expect(page.getByTestId('canvas-screen').locator('[data-rx-name="Texte1"]')).toHaveText(
    'Coucou',
  )
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Ouvrir Projet gardé' })).toBeVisible()
})

test('two screens and the navigation between them', async ({ page }) => {
  await newProject(page)
  await addComponent(page, 'Button')
  await page.getByTestId('screen-picker').click()
  await page.getByRole('menuitem', { name: 'Ajouter un écran' }).click()
  await expect(page.getByTestId('screen-picker')).toContainText('Ecran2')
  await addComponent(page, 'Button')

  // Ecran2: when Bouton1 is clicked, go back.
  await openBlocks(page)
  await openCategory(page, 'Bouton1')
  const back = await dropEvent(page, /est\scliqué/, 'rx_Button_on_click')
  await openCategory(page, 'Écrans')
  await dropInside(page, flyoutBlock(page, /revenir/), back)
  await expect(blockOfType(page, 'rx_screen_back')).toBeVisible()

  // Accueil: when Bouton1 is clicked, go to Ecran2.
  await page.getByTestId('screen-picker').click()
  await page.getByRole('menuitem', { name: 'Accueil' }).click()
  await openCategory(page, 'Bouton1')
  const go = await dropEvent(page, /est\scliqué/, 'rx_Button_on_click')
  await openCategory(page, 'Écrans')
  await dropInside(page, flyoutBlock(page, /aller\sà/), go)
  await expect(blockOfType(page, 'rx_screen_open')).toBeVisible()

  // The preview is scaled down: Playwright's pointer clicks land off target inside a scaled
  // iframe, so these clicks are dispatched to the element.
  const app = preview(page)
  const tap = (selector: string) => app.locator(selector).dispatchEvent('click')
  // The preview gets new code ~150 ms after the last change: retry until the click navigates.
  const navigates = async (from: string, to: string) =>
    expect(async () => {
      await expect(app.locator(`[data-rx-name="${from}"]`)).toBeVisible({ timeout: 500 })
      await tap('[data-rx-name="Bouton1"]')
      await expect(app.locator(`[data-rx-name="${to}"]`)).toBeVisible({ timeout: 500 })
    }).toPass({ timeout: 10_000 })
  await navigates('Accueil', 'Ecran2')
  await navigates('Ecran2', 'Accueil')
  // The back bar of a stack does the same.
  await tap('[data-rx-name="Bouton1"]')
  await expect(app.locator('[data-rx-name="Ecran2"]')).toBeVisible()
  await app.getByRole('button', { name: 'Retour' }).dispatchEvent('click')
  await expect(app.locator('[data-rx-name="Accueil"]')).toBeVisible()
})

test('an endless loop freezes nothing and Stop ends it', async ({ page }) => {
  await newProject(page)
  await addComponent(page, 'Button')
  await addComponent(page, 'Text')
  await openBlocks(page)
  await openCategory(page, 'Bouton1')
  const event = await dropEvent(page, /est\scliqué/, 'rx_Button_on_click')
  await openCategory(page, 'Contrôle')
  await dropInside(page, flyoutBlock(page, /indéfiniment/), event)
  const loop = blockOfType(page, 'rx_forever')
  await expect(loop).toBeVisible()
  await openCategory(page, 'Texte1')
  await dropInside(page, flyoutBlock(page, /^mettre\s*texte/), loop)
  const setter = blockOfType(page, 'rx_Text_set')
  await expect(setter).toBeVisible()
  await openCategory(page, 'Maths')
  await dropOnValue(
    page,
    flyoutBlock(page, /aléatoire/),
    setter.locator('g.blocklyDraggable.text').first(),
  )
  await expect(setter.locator('g.math_random_int')).toBeVisible()

  const app = preview(page)
  await expect(page.getByTestId('preview-state')).toHaveText(/En marche/)
  // Start the loop (retry while the preview receives the latest code).
  const text = app.locator('[data-rx-name="Texte1"]')
  await expect(async () => {
    await app.locator('[data-rx-name="Bouton1"]').dispatchEvent('click')
    await expect(text).toHaveText(/^[1-6]$/, { timeout: 500 })
  }).toPass({ timeout: 10_000 })
  // The app keeps drawing: the text keeps changing while the loop runs.
  const seen = new Set<string>()
  for (let i = 0; i < 40 && seen.size < 3; i++) {
    seen.add((await text.textContent()) ?? '')
    await page.waitForTimeout(50)
  }
  expect(seen.size).toBeGreaterThan(1)
  // The editor answers too.
  const name = page.getByRole('textbox', { name: 'Nom du projet' })
  await name.fill('Toujours là')
  await expect(name).toHaveValue('Toujours là')

  await page.getByTestId('preview-stop').click()
  await expect(page.getByTestId('preview-state')).toHaveText(/Arrêtée/)
  const after = await text.textContent()
  await page.waitForTimeout(300)
  await expect(text).toHaveText(after ?? '')
  await expect(app.getByRole('status')).toContainText('arrêtée')
})

test('Junior and Studio, French and English, light and dark', async ({ page }) => {
  await usePrefs(page, { mode: 'junior', theme: 'light', locale: 'fr' })
  await newProject(page)
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-mode', 'junior')
  await page.getByRole('radio', { name: /Studio/ }).click()
  await expect(html).toHaveAttribute('data-mode', 'studio')
  await openBlocks(page)
  await expect(page.locator('.thrasos-renderer').first()).toBeVisible()
  await expect(page.getByTestId('code-view')).toBeVisible()
  await page.getByRole('radio', { name: /Junior/ }).click()
  await expect(html).toHaveAttribute('data-mode', 'junior')
  await expect(page.locator('.zelos-renderer').first()).toBeVisible()

  await page.getByTestId('prefs-menu').click()
  await page.getByRole('menuitem', { name: 'Sombre' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.getByTestId('prefs-menu').click()
  await page.getByRole('menuitem', { name: 'English' }).click()
  await expect(html).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Blocks', exact: true })).toBeVisible()
  await openCategory(page, 'Control')
  await expect(flyoutBlock(page, /repeat\sforever/)).toBeVisible()
  await page.getByTestId('prefs-menu').click()
  await page.getByRole('menuitem', { name: 'Light' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')
})
