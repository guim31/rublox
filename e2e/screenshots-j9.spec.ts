import { type Browser, expect, type Page, test } from '@playwright/test'
import { usePrefs } from './helpers.ts'

/**
 * PR screenshots of J9 (SPEC § 7): the apps to take apart, Junior and Studio, light and dark.
 * The learning page's section, a step of the guided tour on a stack of blocks, "Show me what's
 * new" with its lit blocks, and the challenges of the level. Each variant takes another app.
 * `npx playwright test --project=screenshots e2e/screenshots-j9.spec.ts` writes them to
 * docs/screenshots/j9/.
 */
const DIR = 'docs/screenshots/j9'

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

/** Variant, app, level, and the tour step to show (its index). */
const VARIANTS = [
  ['junior', 'light', 'star-catcher', 2, 1],
  ['junior', 'dark', 'brick-breaker', 2, 1],
  ['studio', 'light', 'big-quiz', 4, 3],
  ['studio', 'dark', 'piggy-bank', 4, 2],
] as const

for (const [mode, theme, app, level, step] of VARIANTS) {
  test(`J9 ${mode} ${theme}: ${app}`, async ({ browser }) => {
    const page = await open(browser, mode, theme)
    const name = (shot: string) => `${DIR}/${mode}-${theme}-${shot}.png`

    await page.goto('/learn')
    const section = page.getByTestId('explore-section')
    await expect(section.getByTestId(`explore-${app}`)).toBeVisible()
    const card = section.getByTestId(`explore-${app}`)
    await card.getByTestId(`explore-${app}-level-${level}`).click()
    await section.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      const element = document.querySelector('[data-testid=explore-section]')
      if (element) window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 90)
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: name('learn') })

    await card.getByTestId('explore-open').click()
    await page.waitForURL(/tab=blocks/)
    const bubble = page.getByTestId('explore-bubble')
    await expect(bubble).toBeVisible()
    for (let index = 0; index < step; index++) {
      await bubble.getByTestId('explore-next').click()
    }
    await expect(page.getByTestId('tutorial-spotlight')).toBeVisible()
    // The preview runs a moment; the stack is in view.
    await page.waitForTimeout(1800)
    await page.screenshot({ path: name('tour') })

    await bubble.getByTestId('explore-quit').click()
    await page.getByTestId('whats-new').click()
    await expect(page.getByTestId('whats-new-panel')).toBeVisible()
    await page.waitForTimeout(500)
    await page.screenshot({ path: name('whats-new') })

    await page.getByTestId('whats-new').click()
    await expect(page.getByTestId('explore-challenges')).toBeVisible()
    await page.waitForTimeout(300)
    await page.screenshot({ path: name('challenges') })
    await page.context().close()
  })
}
