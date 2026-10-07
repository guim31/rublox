import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { settled, usePrefs } from './helpers.ts'

/**
 * Axe on what J9 adds (SPEC § 5.1): the "Apps to take apart" section of the learning page,
 * the guided tour's bubble on the blocks, the challenges panel and "Show me what's new".
 * Junior and Studio, light and dark.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function axe(page: Page, where: string) {
  await settled(page)
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    // The app being built is the learner's own content (checked by a11y-j8 on its origin).
    .exclude('[data-testid=preview-frame]')
    .analyze()
  expect(
    results.violations.map(
      (v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
}

for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`apps to take apart, ${mode}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
      await usePrefs(page, { mode, theme, locale: 'fr' })
      await page.goto('/learn')
      const card = page.getByTestId('explore-big-quiz')
      await expect(card).toBeVisible()
      await card.getByTestId('explore-big-quiz-level-2').click()
      await axe(page, 'learn')

      await card.getByTestId('explore-open').click()
      await page.waitForURL(/tab=blocks/)
      await expect(page.getByTestId('explore-bubble')).toBeVisible()
      await page.getByTestId('explore-next').click()
      await expect(page.getByTestId('tutorial-spotlight')).toBeVisible()
      await axe(page, 'tour')

      await page.getByTestId('explore-quit').click()
      await expect(page.getByTestId('explore-challenges')).toBeVisible()
      await page.getByTestId('whats-new').click()
      await expect(page.getByTestId('whats-new-panel')).toBeVisible()
      await axe(page, 'challenges and what is new')
    })
  }
}
