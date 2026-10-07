import { expect, type Page, test } from '@playwright/test'
import { ADMIN, createAccount, preview, signIn } from './helpers.ts'

/**
 * J9 — apps to take apart: every level opens from the learning page and runs without an
 * error, the guided tour of a level goes to its end and one of its challenges is done, and
 * "Show me what's new" lights the blocks a level adds.
 */

const APPS = ['star-catcher', 'brick-breaker', 'big-quiz', 'piggy-bank'] as const

/** Preferences before the first load: the console open (its errors are read), a language. */
async function prefs(page: Page, locale: 'fr' | 'en', mode: 'junior' | 'studio' = 'junior') {
  await page.addInitScript(
    (value) => {
      const current = JSON.parse(localStorage.getItem('rublox:prefs') || '{"state":{},"version":2}')
      localStorage.setItem(
        'rublox:prefs',
        JSON.stringify({ ...current, state: { ...current.state, ...value } }),
      )
    },
    { locale, mode, consoleOpen: { junior: true, studio: true } },
  )
}

/** Opens a copy of a level from the learning page, in the Blocks tab. */
async function openLevel(page: Page, app: string, level: number) {
  await page.goto('/learn')
  const card = page.getByTestId(`explore-${app}`)
  await card.getByTestId(`explore-${app}-level-${level}`).click()
  await card.getByTestId('explore-open').click()
  await page.waitForURL(/\/p\/[^/]+\?tab=blocks/)
  await expect(page.locator('.blocklySvg').first()).toBeVisible()
  await expect(page.getByTestId('preview-state')).toHaveAttribute('class', /mint/)
}

/** The errors and warnings of the console (the preview's, and the editor's). */
function problems(page: Page) {
  return page.locator('[data-testid=console] li').filter({
    has: page.locator('[aria-label=error], [aria-label=warn]'),
  })
}

for (const app of APPS) {
  for (const level of [1, 2, 3, 4]) {
    for (const locale of level === 4 ? (['fr', 'en'] as const) : (['fr'] as const)) {
      test(`${app} level ${level} (${locale}) opens and runs without an error`, async ({
        page,
      }) => {
        await prefs(page, locale)
        await openLevel(page, app, level)
        await expect(page.getByTestId('explore-bubble')).toBeVisible()
        // The level's blocks are there, with their comments.
        await expect(
          page.locator('[data-testid=blockly-workspace] .blocklyBlockCanvas > g').first(),
        ).toBeVisible()
        // Let it run a moment: nothing goes wrong.
        await page.waitForTimeout(2500)
        await expect(problems(page)).toHaveCount(0)
      })
    }
  }
}

test('the tour of Star Catcher level 1 goes to its end, then a challenge is done', async ({
  page,
}) => {
  await prefs(page, 'fr')
  await openLevel(page, 'star-catcher', 1)
  const bubble = page.getByTestId('explore-bubble')
  const next = bubble.getByTestId('explore-next')
  await expect(bubble).toContainText('Attrape-étoiles')
  await next.click()
  // Steps that point at stacks of blocks: the spotlight sits on the stack.
  for (const block of ['start', 'drop', 'catch', 'follow']) {
    await expect(bubble.getByTestId('explore-text')).toBeVisible()
    const stack = page.locator(`[data-testid=blockly-workspace] [data-id="${block}"]`)
    await expect(stack).toBeVisible()
    await expect(page.getByTestId('tutorial-spotlight')).toBeVisible()
    await next.click()
  }
  // Slow motion: on, a block lights up, off.
  await bubble.getByRole('button', { name: 'Lancer le ralenti' }).click()
  await expect(bubble).toContainText('Bien vu', { timeout: 20_000 })
  await expect(bubble).toContainText('Arrête le ralenti')
  await page.getByTestId('slow-motion').click()
  // The tour is over: the challenges.
  const challenges = page.getByTestId('explore-challenges')
  await expect(challenges).toBeVisible()
  const faster = challenges.getByTestId('explore-challenge-faster')
  await expect(faster).toHaveAttribute('data-done', 'false')
  await faster.getByRole('button', { name: 'Montrer le bloc' }).click()

  // "Make the star fall faster": 150 becomes 300 in the block.
  const field = page.locator('[data-id="drop-speed/value"] .blocklyEditableField').first()
  await field.click()
  const input = page.locator('.blocklyHtmlInput')
  await expect(input).toBeVisible()
  await input.fill('300')
  await input.press('Enter')
  await expect(faster).toHaveAttribute('data-done', 'true')
  await expect(challenges).toContainText('1/3')
  await expect(preview(page).locator('body')).toBeVisible()

  // The progress joins the learning page.
  await page.goto('/learn')
  const card = page.getByTestId('explore-star-catcher')
  await expect(card).toContainText('Visite faite')
  await expect(card).toContainText('Défis : 1 sur 3')
})

test('"Show me what\'s new" lights what level 2 adds', async ({ page }) => {
  await prefs(page, 'fr', 'studio')
  await openLevel(page, 'star-catcher', 2)
  await page.getByTestId('explore-quit').click()
  await page.getByTestId('whats-new').click()
  const panel = page.getByTestId('whats-new-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Nouveau au niveau 2')
  // New components (the score, the rain timer) and changed stacks.
  await expect(panel).toContainText('Pluie')
  await expect(panel.getByTestId('whats-new-item').first()).toBeVisible()
  await expect(page.locator('.blocklySvg .rx-new-added').first()).toBeAttached()
  await expect(page.locator('.blocklySvg .rx-new-changed').first()).toBeAttached()
  // The drop function was changed, not added; the clone handler was added.
  await expect(page.locator('[data-id="drop-clone"]')).toHaveClass(/rx-new-added/)
  await expect(page.locator('[data-id="catch-end"]')).toHaveClass(/rx-new-changed/)
  await panel.getByRole('button', { name: 'Fermer' }).click()
  await expect(page.locator('.blocklySvg .rx-new-added')).toHaveCount(0)
})

test('the first level has no "what\'s new", and the copy is the learner\'s', async ({ page }) => {
  await prefs(page, 'en', 'studio')
  await openLevel(page, 'piggy-bank', 1)
  await expect(page.getByTestId('whats-new')).toHaveCount(0)
  await page.getByTestId('explore-quit').click()
  await expect(page.getByTestId('explore-challenges')).toBeVisible()
  // The copy is among the guest's projects.
  await page.goto('/')
  await expect(page.getByText('My Piggy Bank · level 1').first()).toBeVisible()
})

test('with an account, the copy is a project of the account, and its tour comes back', async ({
  page,
}) => {
  await prefs(page, 'fr')
  await signIn(page, ADMIN.username, ADMIN.password)
  const learner = await createAccount(page, 'Sacha')
  await page.context().clearCookies()
  await signIn(page, learner.username, learner.password)
  await openLevel(page, 'brick-breaker', 3)
  const bubble = page.getByTestId('explore-bubble')
  await bubble.getByTestId('explore-next').click()
  await expect(bubble).toContainText('Étape 2 sur')
  const url = page.url()
  // The project lives on the server: reloading reopens it, at the same step of the tour.
  await page.reload()
  await expect(page.getByTestId('explore-bubble')).toContainText('Étape 2 sur')
  await expect(page.getByTestId('whats-new')).toBeVisible()
  expect(page.url()).toBe(url)
  await page.goto('/')
  await expect(page.getByText('Casse-briques · niveau 3').first()).toBeVisible()
})
