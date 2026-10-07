import { type Browser, expect, type Page, test } from '@playwright/test'
import { openBlocks, usePrefs } from './helpers.ts'

/**
 * PR screenshots of J8 (SPEC § 7): Junior and Studio, light and dark. The blocks built with
 * the keyboard (focus in the flyout, the help's « Clavier » tab), and a template whose app
 * gets readable colors. `npx playwright test --project=screenshots e2e/screenshots-j8.spec.ts`
 * writes them to docs/screenshots/j8/.
 */
const DIR = 'docs/screenshots/j8'

type Mode = 'junior' | 'studio'
type Theme = 'light' | 'dark'

async function open(browser: Browser, mode: Mode, theme: Theme): Promise<Page> {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    colorScheme: theme,
    storageState: { cookies: [], origins: [] },
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

async function fromTemplate(page: Page, template: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
  await page.getByRole('dialog').getByTestId(`template-${template}`).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Créer depuis ce modèle' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(page.getByTestId('canvas-screen')).toBeVisible()
}

/** Badges earned on the way (first app…) announce themselves: their toasts go first. */
async function closeToasts(page: Page) {
  const toasts = page.locator('[data-sonner-toast]')
  await page.waitForTimeout(600)
  while (await toasts.count()) {
    await toasts.first().locator('[data-close-button]').click()
    await page.waitForTimeout(250)
  }
}

const VARIANTS = [
  ['junior', 'light'],
  ['junior', 'dark'],
  ['studio', 'light'],
  ['studio', 'dark'],
] as const

for (const [mode, theme] of VARIANTS) {
  test(`${mode} ${theme}`, async ({ browser }) => {
    const page = await open(browser, mode, theme)
    await fromTemplate(page, 'scoreboard')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

    // The app of a template, with readable colors, in the app's own theme.
    if (theme === 'dark')
      await page.getByRole('button', { name: 'Appli en sombre' }).first().click()
    await page.mouse.move(0, 0)
    await closeToasts(page)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-template.png` })

    // Blocks with the keyboard: the focus in the toolbox's flyout, the shortcuts in the help.
    await openBlocks(page)
    await page.getByTestId('help-button').click()
    await page.getByTestId('help-panel').getByRole('radio', { name: 'Clavier' }).click()
    await expect(page.getByTestId('help-keys')).toBeVisible()
    await closeToasts(page)
    await page.getByRole('button', { name: /^Blocs$/ }).focus()
    await expect(async () => {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe(
        'treeitem',
      )
    }).toPass({ intervals: [0], timeout: 15_000 })
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-keys.png` })
    await page.context().close()
  })
}
