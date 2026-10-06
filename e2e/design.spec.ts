import { expect, test } from '@playwright/test'
import { addComponent, newProject } from './helpers.ts'

test('drag a component from the palette onto the canvas', async ({ page }) => {
  await newProject(page)
  await page.getByTestId('palette-Button').dragTo(page.getByTestId('canvas-screen'))
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  await expect(page.getByTestId('canvas-screen').locator('[data-rx-name="Bouton1"]')).toBeVisible()
})

test('move components with the keyboard in the layers', async ({ page }) => {
  await newProject(page)
  await addComponent(page, 'Button')
  await addComponent(page, 'Text')
  const names = () =>
    page
      .locator('[role=treeitem]')
      .evaluateAll((items) => items.map((i) => i.getAttribute('data-testid')))
  expect(await names()).toEqual(['layer-Accueil', 'layer-Bouton1', 'layer-Texte1'])
  await page.getByTestId('layer-Texte1').focus()
  // Space grabs, arrow up moves, Enter drops.
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect.poll(names).toEqual(['layer-Accueil', 'layer-Texte1', 'layer-Bouton1'])
  // Alt + arrow moves directly.
  await page.getByTestId('layer-Texte1').focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect.poll(names).toEqual(['layer-Accueil', 'layer-Bouton1', 'layer-Texte1'])
  // Escape puts it back where it was.
  await page.getByTestId('layer-Texte1').focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Escape')
  await expect.poll(names).toEqual(['layer-Accueil', 'layer-Bouton1', 'layer-Texte1'])
})

test('rename in place, edit properties, delete and duplicate', async ({ page }) => {
  await newProject(page)
  await addComponent(page, 'Button')
  await page.getByTestId('layer-Bouton1').dblclick()
  await page.keyboard.type('Valider')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('layer-Valider')).toBeVisible()
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill('OK !')
  await expect(page.getByTestId('canvas-screen').locator('[data-rx-name="Valider"]')).toHaveText(
    'OK !',
  )
  await page.getByTestId('canvas-screen').locator('[data-rx-name="Valider"]').click()
  await page.keyboard.press('Control+d')
  await expect(page.getByTestId('layer-Valider1')).toBeVisible()
  await page.keyboard.press('Delete')
  await expect(page.getByTestId('layer-Valider1')).toHaveCount(0)
})

test('dashboard: rename, duplicate, favorite, trash and restore', async ({ page }) => {
  await newProject(page, 'Premier')
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajouter aux favoris' }).click()
  await page.getByRole('button', { name: 'Actions sur Premier' }).click()
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir Premier (copie)' })).toBeVisible()
  await page.getByRole('button', { name: 'Actions sur Premier (copie)' }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir Premier (copie)' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Corbeille' }).click()
  await page.getByRole('button', { name: 'Actions sur Premier (copie)' }).click()
  await page.getByRole('menuitem', { name: 'Restaurer' }).click()
  await page.getByRole('radio', { name: 'Favoris' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir Premier', exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'Tous' }).click()
  await expect(page.getByRole('button', { name: 'Ouvrir Premier (copie)' })).toBeVisible()
})
