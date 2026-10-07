import { type Browser, expect, type Page, test } from '@playwright/test'
import {
  addComponent,
  blockOfType,
  dropEvent,
  dropInside,
  flyoutBlock,
  openBlocks,
  openCategory,
  preview,
  usePrefs,
} from './helpers.ts'

/**
 * PR screenshots of J3 (SPEC § 7): Junior and Studio, light and dark. `pnpm screenshots`
 * writes them to docs/screenshots/j3/.
 */
const DIR = 'docs/screenshots/j3'

type Prefs = { mode: 'junior' | 'studio'; theme: 'light' | 'dark' }

async function open(browser: Browser, prefs: Prefs, first = false): Promise<Page> {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, {
    ...prefs,
    locale: 'fr',
    welcomed: !first,
    toursSeen: { junior: !first, studio: !first },
  })
  return page
}

async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0)
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${DIR}/${name}.png` })
}

const VARIANTS = [
  ['junior', 'light'],
  ['junior', 'dark'],
  ['studio', 'light'],
  ['studio', 'dark'],
] as const

for (const [mode, theme] of VARIANTS) {
  test(`${mode} ${theme}`, async ({ browser }) => {
    const prefs = { mode, theme }
    const name = (what: string) => `${mode}-${theme}-${what}`

    // A first visit: the welcome page.
    const visitor = await open(browser, prefs, true)
    await visitor.goto('/')
    await expect(visitor.getByTestId('try-guest')).toBeVisible()
    await shot(visitor, name('landing'))
    await visitor.getByTestId('try-guest').click()

    // The guided tour at the first opening of the editor.
    await visitor
      .getByRole('button', { name: /Nouveau projet|C’est parti/ })
      .first()
      .click()
    await visitor.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
    await expect(visitor.getByTestId('tour-bubble')).toBeVisible()
    await visitor.getByTestId('tour-next').click()
    await shot(visitor, name('tour'))
    await visitor.context().close()

    const page = await open(browser, prefs)
    await page.goto('/learn')
    await expect(page.getByTestId('tutorial-first-button')).toBeVisible()
    await shot(page, name('learn'))

    // A tutorial: its bubble in Design, then in Blocks.
    const tutorial = mode === 'junior' ? 'first-button' : 'two-screens'
    await page
      .getByTestId(`tutorial-${tutorial}`)
      .getByRole('button', { name: /Commencer/ })
      .click()
    await expect(page.getByTestId('tutorial-bubble')).toBeVisible()
    await page.getByTestId('tutorial-bubble').getByRole('button', { name: 'C’est parti !' }).click()
    await expect(page.getByTestId('tutorial-spotlight')).toBeVisible()
    await shot(page, name('tutorial-design'))

    // The help panel, on a block sheet.
    await page.getByTestId('help-button').click()
    await page.getByTestId('help-block-controls_repeat_ext').click()
    await expect(page.getByTestId('help-sheet')).toBeVisible()
    await shot(page, name('help'))
    await page.getByTestId('help-button').click()

    // Slow motion, paused on a breakpoint.
    await page
      .getByTestId('tutorial-bubble')
      .getByRole('button', { name: 'Quitter le tutoriel' })
      .click()
    await addComponent(page, 'Button')
    await addComponent(page, 'Text')
    await openBlocks(page)
    await openCategory(page, 'Bouton1')
    const event = await dropEvent(page, /est\scliqué/, 'rx_Button_on_click')
    await openCategory(page, 'Texte1')
    await dropInside(page, flyoutBlock(page, /^mettre\s*texte/), event)
    const setter = blockOfType(page, 'rx_Text_set')
    await setter.click({ button: 'right', position: { x: 12, y: 10 } })
    await page.getByText('Ajouter un point d’arrêt').click()
    await expect(page.getByTestId('slow-motion-bar')).toBeVisible()
    await expect(async () => {
      await preview(page).locator('[data-rx-name="Bouton1"]').dispatchEvent('click')
      await expect(page.getByTestId('slow-continue')).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 10_000 })
    await shot(page, name('slow-motion'))
    await page.context().close()
  })
}
