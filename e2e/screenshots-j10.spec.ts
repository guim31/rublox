import { type Browser, expect, type Page, test } from '@playwright/test'
import { openBlocks, preview, tap, usePrefs } from './helpers.ts'

/**
 * PR screenshots of J10 (SPEC § 7): the "New project" dialog on its games, Junior and Studio,
 * light and dark, then each game template in play, light and dark (the Junior games in
 * Junior, the Studio ones in Studio).
 * `npx playwright test --project=screenshots e2e/screenshots-j10.spec.ts` writes them to
 * docs/screenshots/j10/.
 */
const DIR = 'docs/screenshots/j10'

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

/** The dialog, with the games category chosen and a game selected. */
async function dialog(page: Page, selected: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByTestId('template-category-games').click()
  await dialog.getByTestId(`template-${selected}`).click()
  // Every cover drawn.
  await expect(async () => {
    const covers = await dialog
      .getByTestId('template-cover')
      .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).complete))
    expect(covers.length).toBeGreaterThan(0)
    expect(covers.every(Boolean)).toBe(true)
  }).toPass()
  return dialog
}

for (const [mode, theme] of [
  ['junior', 'light'],
  ['junior', 'dark'],
  ['studio', 'light'],
  ['studio', 'dark'],
] as const) {
  test(`J10 ${mode} ${theme}: new project dialog`, async ({ browser }) => {
    const page = await open(browser, mode, theme)
    await dialog(page, mode === 'junior' ? 'buzzy-bee' : 'cloud-hopper')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-new-project.png` })
    await page.context().close()
  })
}

/** Game, its mode, and how long it runs before the picture (in ms). */
const GAMES = [
  ['buzzy-bee', 'junior', 250],
  ['robo-dash', 'junior', 2200],
  ['puck-clash', 'junior', 1200],
  ['cloud-hopper', 'studio', 1400],
  ['wiggle-snake', 'studio', 900],
  ['galaxy-patrol', 'studio', 4000],
] as const

for (const [game, mode, wait] of GAMES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`J10 ${mode} ${theme}: ${game} in play`, async ({ browser }) => {
      const page = await open(browser, mode, theme)
      const box = await dialog(page, game)
      await box.getByRole('button', { name: 'Créer depuis ce modèle' }).click()
      await page.waitForURL(/\/p\/[^/]+/, { timeout: 30_000 })
      await openBlocks(page)
      const app = preview(page)
      const play = app.locator('[data-rx-stage] [data-rx-name="BoutonJouer"]:not([data-rx-clone])')
      await expect(play.locator('img')).toHaveJSProperty('complete', true)
      // The template's blocks earn badges: their toasts go before the pictures.
      const badge = page.locator('[data-sonner-toast]').filter({ hasText: 'Nouveau badge' })
      await badge
        .first()
        .waitFor({ timeout: 4000 })
        .catch(() => {})
      await page.waitForTimeout(500)
      while (await badge.count()) {
        await badge.first().locator('[data-close-button]').click({ force: true })
        await page.waitForTimeout(150)
      }
      await tap(play)
      // The bee would fall at once: a few taps keep it flying.
      if (game === 'buzzy-bee') {
        const stage = app.locator('[data-rx-stage]')
        for (let count = 0; count < 5; count++) {
          await page.waitForTimeout(220)
          await tap(stage)
        }
      }
      await page.waitForTimeout(wait)
      await page.screenshot({ path: `${DIR}/${mode}-${theme}-${game}.png` })
      // The phone alone, at its own size.
      await page.getByTestId('preview-frame').screenshot({
        path: `${DIR}/${mode}-${theme}-${game}-phone.png`,
      })
      await page.context().close()
    })
  }
}
