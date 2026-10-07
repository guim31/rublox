import { type Browser, expect, type Page, test } from '@playwright/test'
import {
  ADMIN,
  addComponent,
  buildHelloBlocks,
  openBlocks,
  unique,
  usePrefs,
  workspaceBlocks,
} from './helpers.ts'

/**
 * PR screenshots of J4b (SPEC § 7): editing with several people, in Junior and Studio, light
 * and dark. Camille owns the project, Sacha edits it with her, Lou only looks.
 * `npx playwright test --project=screenshots e2e/screenshots-j4b.spec.ts` writes them to
 * docs/screenshots/j4b/.
 */
const DIR = 'docs/screenshots/j4b'

type Prefs = { mode: 'junior' | 'studio'; theme: 'light' | 'dark' }

/** A fresh account in a browser of its own; its profile holds the mode and theme. */
async function person(browser: Browser, name: string, avatar: string, prefs: Prefs) {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, { ...prefs, locale: 'fr' })
  await page.goto('/login')
  const headers = { origin: new URL(page.url()).origin }
  const post = async (path: string, data: unknown, method = 'POST') => {
    const response = await page.request.fetch(path, { method, data, headers })
    expect(response.ok(), path).toBe(true)
  }
  await post('/api/auth/sign-in/username', ADMIN)
  const username = `${name.toLowerCase()}-${unique().toLowerCase()}`
  await post('/api/admin/users', { username, displayName: name, password: `${name}-password` })
  await page.context().clearCookies()
  await post('/api/auth/sign-in/username', { username, password: `${name}-password` })
  await post('/api/me', { uiMode: prefs.mode, theme: prefs.theme, locale: 'fr', avatar }, 'PATCH')
  return { page, username, post }
}

async function open(page: Page, projectId: string, tab: 'design' | 'blocks' = 'design') {
  await page.goto(`/p/${projectId}?tab=${tab}`)
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', /saved|readonly/)
}

const VARIANTS = [
  ['junior', 'light'],
  ['junior', 'dark'],
  ['studio', 'light'],
  ['studio', 'dark'],
] as const

for (const [mode, theme] of VARIANTS) {
  test(`${mode} ${theme}`, async ({ browser }) => {
    const camille = await person(browser, 'Camille', 'fox', { mode, theme })
    const sacha = await person(browser, 'Sacha', 'robot', { mode: 'studio', theme: 'light' })
    const lou = await person(browser, 'Lou', 'bunny', { mode: 'studio', theme: 'light' })

    // Camille's project, shared with Sacha (editor) and Lou (viewer).
    const page = camille.page
    await page.goto('/')
    await page
      .getByRole('button', { name: /Nouveau projet|C’est parti/ })
      .first()
      .click()
    await page.getByRole('dialog').getByRole('textbox').fill('Le quiz de la classe')
    await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
    await page.waitForURL(/\/p\/[^/?]+/)
    const projectId = new URL(page.url()).pathname.split('/')[2] ?? ''
    for (const [who, role] of [
      [sacha, 'editor'],
      [lou, 'viewer'],
    ] as const) {
      await camille.post(
        `/api/projects/${projectId}/members`,
        { username: who.username, role },
        'PUT',
      )
    }
    await addComponent(page, 'Text')
    await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Quelle est la capitale ?')
    await addComponent(page, 'Button')
    await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Paris')
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')

    // The others arrive; Sacha picks the button.
    await open(sacha.page, projectId)
    await open(lou.page, projectId)
    await sacha.page.getByTestId('layer-Bouton1').click()
    await page.getByTestId('layer-Texte1').click()
    await expect(page.getByTestId('presence')).toHaveAttribute('data-count', '2')
    await expect(page.getByTestId('peer-label')).toHaveText('Sacha')
    // Nothing of the top bar is cut.
    const bar = page.locator('header').first()
    expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-presence.png` })

    await page.getByTestId('presence').click()
    await expect(page.getByTestId('presence-person')).toHaveCount(2)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-people.png` })
    await page.keyboard.press('Escape')

    // Blocks: Sacha writes a stack; Camille sees it, and where Sacha is.
    await open(sacha.page, projectId, 'blocks')
    await openBlocks(page)
    await buildHelloBlocks(sacha.page, 'Bravo !')
    await expect(workspaceBlocks(page)).toHaveCount(1)
    await expect(page.getByTestId('peer-block-label')).toHaveText('Sacha')
    // The first stack earns a badge: its toast goes before the pictures.
    const badge = page.locator('[data-sonner-toast]').filter({ hasText: 'Nouveau badge' })
    await badge.waitFor({ timeout: 4000 }).catch(() => {})
    if (await badge.count()) await badge.locator('[data-close-button]').click()
    await expect(badge).toHaveCount(0)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-blocks.png` })

    // Camille drags the stack while Sacha changes it: Sacha saved first, Camille is told.
    const box = await workspaceBlocks(page).first().boundingBox()
    if (!box) throw new Error('no stack')
    await page.mouse.move(box.x + 12, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + 40, box.y + 40, { steps: 5 })
    const field = workspaceBlocks(sacha.page).first().locator('.blocklyTextInputField').first()
    const fieldBox = await field.boundingBox()
    if (!fieldBox) throw new Error('no field')
    await sacha.page.mouse.click(fieldBox.x + fieldBox.width / 2, fieldBox.y + fieldBox.height / 2)
    await sacha.page.locator('.blocklyHtmlInput').fill('Bien joué !')
    await sacha.page.locator('.blocklyHtmlInput').press('Enter')
    await expect(sacha.page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
    await page.waitForTimeout(400)
    await page.mouse.move(box.x + 160, box.y + 180, { steps: 5 })
    await page.mouse.up()
    await expect(page.getByText('Pile modifiée par Sacha')).toBeVisible()
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-conflict.png` })

    for (const who of [camille, sacha, lou]) await who.page.context().close()
  })
}
