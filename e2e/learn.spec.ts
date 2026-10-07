import { expect, type Page, test } from '@playwright/test'
import {
  blockOfType,
  buildHelloBlocks,
  EMPTY_STATE,
  newProject,
  preview,
  usePrefs,
} from './helpers.ts'

const bubble = (page: Page) => page.getByTestId('tutorial-bubble')
const step = (page: Page) => bubble(page).getByTestId('tutorial-text')

/** SPEC § 8, J3: "Mon premier bouton", from the learning page to the end, in Junior. */
test('tutorial "Mon premier bouton" from start to finish, in Junior', async ({ page }) => {
  await usePrefs(page, { mode: 'junior', locale: 'fr' })
  await page.goto('/learn')
  await page
    .getByTestId('tutorial-first-button')
    .getByRole('button', { name: /^Commencer/ })
    .click()
  await page.waitForURL(/\/p\/[^/]+/)

  // Welcome: a "Let's go" button.
  await expect(step(page)).toContainText('ta première appli')
  await bubble(page).getByRole('button', { name: 'C’est parti !' }).click()

  // The palette's Button is lit up; drag it onto the phone.
  await expect(step(page)).toContainText('Glisse un Bouton')
  await expect(page.getByTestId('tutorial-spotlight')).toBeVisible()
  await page.getByTestId('palette-Button').dragTo(page.getByTestId('canvas-screen'))
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()

  // Its text, in the inspector.
  await expect(step(page)).toContainText('case texte')
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Dis bonjour')

  await expect(step(page)).toContainText('Ajoute maintenant un Texte')
  await page.getByTestId('palette-Text').dragTo(page.getByTestId('canvas-screen'))

  await expect(step(page)).toContainText('onglet Blocs')
  await page.getByRole('button', { name: /^Blocs$/ }).click()
  await expect(page.locator('.blocklySvg').first()).toBeVisible()

  // The three block steps: the event, the setter inside it, the text typed in it.
  await expect(step(page)).toContainText('Bouton1')
  await buildHelloBlocks(page, 'Bonjour !')
  await expect(blockOfType(page, 'rx_Button_on_click')).toBeVisible()

  // Last step: tap the button in the preview.
  await expect(step(page)).toContainText('aperçu')
  const app = preview(page)
  await expect(async () => {
    await app.locator('[data-rx-name="Bouton1"]').dispatchEvent('click')
    await expect(app.locator('[data-rx-name="Texte1"]')).toHaveText('Bonjour !', { timeout: 500 })
  }).toPass({ timeout: 10_000 })

  // Celebration, then the tutorial is marked done and a badge is earned.
  const finished = page.getByTestId('tutorial-finished')
  await expect(finished).toBeVisible()
  await expect(finished).toContainText('Tutoriel terminé')
  await finished.getByRole('button', { name: 'Voir les autres tutoriels' }).click()
  await page.waitForURL(/\/learn$/)
  await expect(page.getByTestId('tutorial-first-button')).toContainText('Terminé')
  await expect(page.getByTestId('badge-first-tutorial')).toHaveAttribute('data-earned', 'true')
  await expect(page.getByTestId('badge-first-app')).toHaveAttribute('data-earned', 'true')
})

test('a tutorial pauses, resumes after a reload, and exists in English', async ({ page }) => {
  await usePrefs(page, { mode: 'junior', locale: 'en' })
  await page.goto('/learn')
  await page
    .getByTestId('tutorial-magic-dice')
    .getByRole('button', { name: /^Start/ })
    .click()
  await expect(step(page)).toContainText('random')
  await bubble(page).getByRole('button', { name: 'Let’s go!' }).click()
  await expect(step(page)).toContainText('Put a Text')

  await bubble(page).getByRole('button', { name: 'Pause' }).click()
  await expect(bubble(page)).toBeHidden()
  await page.getByRole('button', { name: 'Resume the tutorial' }).click()
  await expect(step(page)).toContainText('Put a Text')

  // The progression is kept: back at the same step after a reload.
  await page.reload()
  await expect(step(page)).toContainText('Put a Text')
  await page.goto('/learn')
  await expect(page.getByTestId('tutorial-magic-dice')).toContainText('Step 2 of 10')
})

test('a challenge counts its stars live', async ({ page }) => {
  await usePrefs(page, { mode: 'junior', locale: 'fr' })
  await page.goto('/learn')
  await page.getByTestId('challenge-counter').getByRole('button', { name: 'Commencer' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  const panel = page.getByTestId('challenge-panel')
  await expect(panel).toContainText('Le compteur')
  await expect(page.getByTestId('challenge-star-1')).toHaveAttribute('data-earned', 'false')
  await page.getByRole('button', { name: /^Blocs$/ }).click()
  await expect(page.locator('.blocklySvg').first()).toBeVisible()
  await buildHelloBlocks(page, '1')
  await expect(page.getByTestId('challenge-star-1')).toHaveAttribute('data-earned', 'true')
  await expect(page.getByTestId('challenge-star-2')).toHaveAttribute('data-earned', 'false')
})

test.describe('first visit', () => {
  test.use({ storageState: EMPTY_STATE })

  test('the welcome page, then the guided tour of the mode', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fabrique tes propres')
    await expect(page.getByTestId('landing-sign-in')).toHaveAttribute('href', '/login')
    await page.getByTestId('try-guest').click()
    await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible()

    await page
      .getByRole('button', { name: /C’est parti|Nouveau projet/ })
      .first()
      .click()
    await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
    const tour = page.getByTestId('tour-bubble')
    await expect(tour).toContainText('Bienvenue')
    for (let index = 0; index < 6; index++) await page.getByTestId('tour-next').click()
    await expect(tour).toBeHidden()
    // Seen once: not shown again.
    await page.reload()
    await expect(page.getByTestId('canvas-screen')).toBeVisible()
    await expect(tour).toBeHidden()
  })
})

test('help: a sheet for every block, from the panel or a right-click', async ({ page }) => {
  await newProject(page)
  await page.getByTestId('help-button').click()
  const panel = page.getByTestId('help-panel')
  await panel.getByRole('searchbox').fill('hasard')
  await panel.getByTestId('help-block-math_random_int').click()
  await expect(page.getByTestId('help-sheet')).toContainText('Un nombre entier au hasard')
  await panel.getByRole('radio', { name: 'Glossaire' }).click()
  await expect(panel).toContainText('Point d’arrêt')
})

test('slow motion lights the blocks up and stops on a breakpoint', async ({ page }) => {
  await newProject(page)
  await page.getByTestId('palette-Button').press('Enter')
  await page.getByTestId('palette-Text').press('Enter')
  await page.getByRole('button', { name: /^Blocs$/ }).click()
  await expect(page.locator('.blocklySvg').first()).toBeVisible()
  await buildHelloBlocks(page, 'Pas à pas')
  const setter = blockOfType(page, 'rx_Text_set')
  await setter.click({ button: 'right', position: { x: 12, y: 10 } })
  await page.getByText('Ajouter un point d’arrêt').click()
  await expect(page.getByTestId('slow-motion-bar')).toBeVisible()
  await expect(setter).toHaveClass(/rx-breakpoint/)

  const app = preview(page)
  await expect(async () => {
    await app.locator('[data-rx-name="Bouton1"]').dispatchEvent('click')
    await expect(page.getByTestId('slow-continue')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
  // Paused before the block ran: it is lit, the text has not changed yet.
  await expect(setter).toHaveClass(/blocklyHighlighted/)
  await expect(app.locator('[data-rx-name="Texte1"]')).toHaveText('Texte')
  await page.getByTestId('slow-continue').click()
  await expect(app.locator('[data-rx-name="Texte1"]')).toHaveText('Pas à pas')
  await expect(setter).not.toHaveClass(/blocklyHighlighted/)
})

test('a finger drags a component from the palette onto the canvas', async ({ page }) => {
  await newProject(page)
  const from = await page.getByTestId('palette-Button').boundingBox()
  const to = await page.getByTestId('canvas-screen').boundingBox()
  if (!from || !to) throw new Error('not visible')
  const at = (x: number, y: number) => ({ x, y })
  const start = at(from.x + from.width / 2, from.y + from.height / 2)
  const end = at(to.x + to.width / 2, to.y + 120)
  // Pointer events of a touch screen: a long press, a move, a release.
  await page.evaluate(
    async ({ start, end }) => {
      const pointer = (type: string, point: { x: number; y: number }, target: EventTarget) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            clientX: point.x,
            clientY: point.y,
          }),
        )
      const source = document.elementFromPoint(start.x, start.y)
      if (!source) throw new Error('no source')
      pointer('pointerdown', start, source)
      await new Promise((resolve) => setTimeout(resolve, 400))
      for (let i = 1; i <= 8; i++) {
        const point = {
          x: start.x + ((end.x - start.x) * i) / 8,
          y: start.y + ((end.y - start.y) * i) / 8,
        }
        pointer('pointermove', point, window)
        await new Promise((resolve) => setTimeout(resolve, 16))
      }
      pointer('pointerup', end, window)
    },
    { start, end },
  )
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
})
