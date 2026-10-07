import AxeBuilder from '@axe-core/playwright'
import { type Browser, expect, type Page, test } from '@playwright/test'
import { ADMIN, openBlocks, openDemo, unique, usePrefs } from './helpers.ts'

/**
 * Axe on every page and dialog the other accessibility specs leave out (J8, SPEC § 5.1): the
 * templates, the command palette, sharing, the history, the help's keyboard tab, the blocks
 * themselves (Blockly included), the gallery and its entry, the trash and a confirmation, the
 * spaces, the game designer, the narrow screen, the page not found, and the apps origin (a
 * published app, its install page, a live test). Junior and Studio, light and dark.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
type Mode = 'junior' | 'studio'
type Theme = 'light' | 'dark'

async function axe(page: Page, where: string, options: { dialog?: boolean } = {}) {
  let builder = new AxeBuilder({ page }).withTags(TAGS)
  // The app being built is the learner's own content: checked on the apps origin below.
  builder = builder.exclude('[data-testid=preview-frame]').exclude('[data-testid=canvas-screen]')
  if (options.dialog) builder = builder.include('[role=dialog]')
  const results = await builder.analyze()
  expect(
    results.violations.map(
      (v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
}

/** A fresh account whose profile holds the mode and theme (the profile wins over the browser). */
async function account(page: Page, mode: Mode, theme: Theme) {
  await page.goto('/login')
  const headers = { origin: new URL(page.url()).origin }
  const call = async (path: string, data: unknown, method = 'POST') => {
    const response = await page.request.fetch(path, { method, data, headers })
    expect(response.ok(), path).toBe(true)
  }
  await call('/api/auth/sign-in/username', ADMIN)
  const username = `axe8-${unique().toLowerCase()}`
  await call('/api/admin/users', { username, displayName: 'Axe', password: 'axe-password' })
  await page.context().clearCookies()
  await call('/api/auth/sign-in/username', { username, password: 'axe-password' })
  await call('/api/me', { uiMode: mode, theme, locale: 'fr' }, 'PATCH')
}

async function open(
  browser: Browser,
  mode: Mode,
  theme: Theme,
  viewport?: { width: number; height: number },
) {
  const context = await browser.newContext({
    locale: 'fr-FR',
    colorScheme: theme,
    viewport: viewport ?? { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, {
    mode,
    theme,
    locale: 'fr',
    welcomed: true,
    toursSeen: { junior: true, studio: true },
  })
  return page
}

async function closeDialog(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).first().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe, everything else: ${mode}, ${theme}`, async ({ browser }) => {
      test.setTimeout(180_000)
      const page = await open(browser, mode, theme)
      await account(page, mode, theme)
      const name = `Tableau ${unique()}`

      // A project from a template: the dialog, then the editor.
      await page.goto('/')
      await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
      await expect(page.getByRole('dialog').getByTestId('template-scoreboard')).toBeVisible()
      await axe(page, 'templates', { dialog: true })
      await page.getByRole('dialog').getByTestId('template-scoreboard').click()
      await page.getByRole('dialog').getByRole('textbox', { name: 'Nom du projet' }).fill(name)
      await page.getByRole('dialog').getByRole('button', { name: 'Créer depuis ce modèle' }).click()
      await page.waitForURL(/\/p\/[^/]+/)
      await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')

      await page.keyboard.press('Control+k')
      await expect(page.getByRole('combobox')).toBeVisible()
      await axe(page, 'command palette', { dialog: true })
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: 'Partager' }).click()
      await expect(page.getByTestId('gallery-sharing')).toBeVisible()
      await axe(page, 'share', { dialog: true })
      // In the gallery, for the gallery pages below.
      await page.getByTestId('gallery-sharing').getByRole('switch').click()
      await expect(page.getByText('Ton projet est dans la galerie.')).toBeVisible()
      await closeDialog(page)

      await page.getByRole('button', { name: 'Historique' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await axe(page, 'versions', { dialog: true })
      await closeDialog(page)

      await page.getByTestId('help-button').click()
      await page.getByTestId('help-panel').getByRole('radio', { name: 'Clavier' }).click()
      await expect(page.getByTestId('help-keys')).toBeVisible()
      await axe(page, 'help keys')
      await page.getByTestId('help-button').click()

      // The blocks, Blockly's own workspace and toolbox included.
      await openBlocks(page)
      await axe(page, 'blocks')

      // Published, then seen on the apps origin as a visitor would.
      await page.getByTestId('publish-open').click()
      await page.getByTestId('publish-slug').fill(`axe-${unique().toLowerCase()}`)
      await expect(page.getByText('Adresse libre')).toBeVisible()
      await page.getByTestId('publish-submit').click()
      await expect(page.getByTestId('publish-state')).toHaveText('En ligne · Version 1')
      await page.getByRole('radio', { name: 'Partager' }).click()
      const appUrl = await page.getByTestId('publish-url').inputValue()
      await closeDialog(page)
      await page.getByTestId('live-open').click()
      const liveUrl = await page.getByTestId('live-url').inputValue()
      await closeDialog(page)

      const phone = await open(browser, mode, theme, { width: 390, height: 844 })
      await phone.goto(appUrl)
      await expect(phone.locator('[data-rx-name]').first()).toBeVisible()
      await axe(phone, 'published app')
      await phone.goto(`${appUrl}install`)
      await axe(phone, 'install page')
      await phone.goto(liveUrl)
      await expect(phone.locator('[data-rx-name]').first()).toBeVisible()
      await axe(phone, 'live test')
      await phone.goto(new URL('/a/nothing-here-at-all/', appUrl).href)
      await axe(phone, 'app not found')
      // The editor on a phone: a kind message instead.
      await phone.goto(page.url())
      await axe(phone, 'narrow editor')
      await phone.context().close()

      await page.goto('/gallery')
      await page.getByRole('searchbox', { name: 'Chercher une appli ou une personne' }).fill(name)
      const card = page.getByTestId('gallery-grid').getByRole('listitem').first()
      await expect(card).toContainText(name)
      await axe(page, 'gallery')
      await card.getByRole('button', { name: `Voir ${name}` }).click()
      await expect(page.getByTestId('gallery-entry')).toBeVisible()
      await axe(page, 'gallery entry', { dialog: true })
      await closeDialog(page)

      // Trash, then the confirmation of a deletion for good.
      await page.goto('/')
      await page.getByRole('button', { name: `Actions sur ${name}` }).click()
      await expect(page.getByRole('menuitem', { name: 'Supprimer' })).toBeVisible()
      await axe(page, 'project menu')
      // The scan moves the focus, which closes a menu that is not modal: open it again.
      await page.getByRole('button', { name: `Actions sur ${name}` }).click()
      await page.getByRole('menuitem', { name: 'Supprimer' }).click()
      await page.getByRole('radio', { name: 'Corbeille' }).click()
      await expect(page.getByRole('heading', { name })).toBeVisible()
      await axe(page, 'trash')

      await page.goto('/spaces')
      await expect(page.getByRole('button', { name: 'Créer un espace' })).toBeVisible()
      await axe(page, 'spaces')

      await page.goto('/nothing-here-at-all')
      await axe(page, 'not found')

      // The game designer: scene, sprites, joystick (J7).
      await openDemo(page, /Attrape les fruits/)
      await axe(page, 'game designer')
      await page.context().close()
    })
  }
}

/** The 12 templates are Rublox's own apps: each one passes axe, light and dark (J8). */
const TEMPLATES = [
  'hello',
  'dice',
  'quiz',
  'scoreboard',
  'shopping',
  'chores',
  'converter',
  'bill-split',
  'toothbrush',
  'drawing',
  'tabs',
  'catch-star',
]

for (const template of TEMPLATES) {
  test(`axe, template app: ${template}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await usePrefs(page, { mode: 'studio', theme: 'light', locale: 'fr' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
    await page.getByRole('dialog').getByTestId(`template-${template}`).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Créer depuis ce modèle' }).click()
    await page.waitForURL(/\/p\/[^/]+/)
    await openBlocks(page)
    const app = page.frameLocator('[data-testid=preview-frame]')
    await expect(app.locator('[data-rx-name]').first()).toBeVisible()
    for (const scheme of ['light', 'dark'] as const) {
      if (scheme === 'dark') {
        await page.getByRole('button', { name: 'Appli en sombre' }).first().click()
        await expect(app.locator('.rx-app[data-scheme=dark]').first()).toBeVisible()
      }
      const results = await new AxeBuilder({ page })
        .withTags(TAGS)
        .include('[data-testid=preview-frame]')
        .analyze()
      expect(
        results.violations.map(
          (v) =>
            `${scheme} ${v.id}: ${v.nodes
              .map((n) => {
                const data = n.any[0]?.data as
                  | { fgColor?: string; bgColor?: string; contrastRatio?: number }
                  | undefined
                const colors = data?.fgColor
                  ? ` (${data.fgColor} on ${data.bgColor}: ${data.contrastRatio})`
                  : ''
                return `${n.target.join(' ')}${colors}`
              })
              .join(', ')}`,
        ),
      ).toEqual([])
    }
  })
}
