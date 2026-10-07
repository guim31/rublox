import { type Browser, expect, type Page, test } from '@playwright/test'
import { preview, usePrefs } from './helpers.ts'

/**
 * PR screenshots of J2 (SPEC § 7): the demo app, which uses every component, in Junior and
 * Studio, light and dark. Written to docs/screenshots/j2/.
 */
const DIR = 'docs/screenshots/j2'

type Prefs = { mode: 'junior' | 'studio'; theme: 'light' | 'dark' }

async function open(browser: Browser, prefs: Prefs): Promise<Page> {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, { ...prefs, locale: 'fr' })
  return page
}

/** The editor shows the app in light; switch it to dark for the dark pictures. */
async function darkApp(page: Page, scheme: 'light' | 'dark') {
  if (scheme === 'dark') await page.getByRole('button', { name: 'Appli en sombre' }).first().click()
}

const VARIANTS = [
  ['junior', 'light'],
  ['junior', 'dark'],
  ['studio', 'light'],
  ['studio', 'dark'],
] as const

for (const [mode, theme] of VARIANTS) {
  test(`${mode} ${theme}`, async ({ browser }) => {
    const page = await open(browser, { mode, theme })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.keyboard.press('Control+k')
    await page.getByRole('option', { name: /démonstration/ }).click()
    await page.waitForURL(/\/p\/[^/?]+/)
    const url = page.url().split('?')[0]
    const appScheme = theme === 'dark' ? 'dark' : 'light'

    // Design: the inputs screen, a component selected.
    await page.goto(`${url}?tab=design&screen=inputs`)
    await expect(page.getByTestId('canvas-screen')).toBeVisible()
    await darkApp(page, appScheme)
    await page.getByTestId('layer-Curseur1').click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${DIR}/design-${mode}-${theme}.png` })

    // The app's theme and navigation, on the home screen with its tab bar.
    await page.goto(`${url}?tab=design`)
    await expect(page.getByTestId('canvas-tabs')).toBeVisible()
    await darkApp(page, appScheme)
    await page.getByRole('radio', { name: 'Appli' }).click()
    await expect(page.getByTestId('app-settings')).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${DIR}/theme-${mode}-${theme}.png` })

    // Blocks of the lists screen, with the app running beside them.
    await page.goto(`${url}?tab=blocks&screen=lists`)
    await expect(page.locator('.blocklySvg').first()).toBeVisible()
    await expect(preview(page).locator('.rx-datalist')).toBeVisible()
    await darkApp(page, appScheme)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${DIR}/blocks-${mode}-${theme}.png` })
    await page.context().close()
  })
}
