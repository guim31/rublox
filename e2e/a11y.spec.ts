import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { ADMIN, addComponent, newProject, openBlocks, signIn, usePrefs } from './helpers.ts'

/** Axe on the main pages (SPEC § 7), in both modes and both themes. Blockly's own SVG is left out. */
for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe: ${mode}, ${theme}`, async ({ page }) => {
      // No fade-in while axe measures contrasts.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await usePrefs(page, { mode, theme, locale: 'fr' })
      const check = async () => {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .exclude('.injectionDiv')
          .exclude('[data-testid=preview-frame]')
          .exclude('[data-testid=canvas-screen]')
          .analyze()
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
          ),
        ).toEqual([])
      }
      await page.goto('/')
      await check()
      await newProject(page)
      await addComponent(page, 'Button')
      await check()
      await openBlocks(page)
      await check()
    })
  }
}

/** Axe on the account pages (J1): sign-in, sign-up, dashboard, account, spaces, administration. */
for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe, accounts: ${mode}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await usePrefs(page, { mode, theme, locale: 'fr' })
      const check = async (where: string) => {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .exclude('[data-testid=preview-frame]')
          .exclude('[data-testid=canvas-screen]')
          .analyze()
        expect(
          results.violations.map(
            (v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
          ),
        ).toEqual([])
      }
      await page.goto('/login')
      await check('login')
      await signIn(page, ADMIN.username, ADMIN.password)
      await check('dashboard')
      await page.goto('/admin?section=invites')
      await page.getByRole('button', { name: 'Créer une invitation' }).click()
      await check('admin invite dialog')
      await page.getByRole('dialog').getByRole('button', { name: 'Créer une invitation' }).click()
      const link = await page.getByTestId('invite-link').inputValue()
      await page.keyboard.press('Escape')
      await page.goto('/admin')
      await expect(page.getByTestId('admin-user-admin')).toBeVisible()
      await check('admin users')
      await page.goto('/admin?section=settings')
      await expect(page.getByLabel('Nom de l’instance')).toBeVisible()
      await check('admin settings')
      await page.goto('/account')
      await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible()
      await check('account')
      await page.goto('/spaces')
      await page.getByRole('button', { name: 'Créer un espace' }).click()
      await check('new space dialog')
      await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
      await expect(page.getByRole('button', { name: 'Créer un compte' })).toBeVisible()
      await check('space')

      const visitor = await page.context().browser()?.newContext({ locale: 'fr-FR' })
      const guest = await visitor?.newPage()
      if (!guest) throw new Error('no browser')
      await guest.emulateMedia({ reducedMotion: 'reduce' })
      await usePrefs(guest, { mode, theme, locale: 'fr' })
      await guest.goto(link)
      await expect(guest.getByRole('heading', { name: 'Bienvenue sur Rublox' })).toBeVisible()
      const results = await new AxeBuilder({ page: guest })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(results.violations.map((v) => `invite ${v.id}`)).toEqual([])
    })
  }
}

/** Axe on the J3 pages: welcome, learning, a tutorial bubble, the help panel and slow motion. */
for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe, learning: ${mode}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await usePrefs(page, { mode, theme, locale: 'fr', welcomed: false })
      const check = async () => {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .exclude('.injectionDiv')
          .exclude('[data-testid=preview-frame]')
          .exclude('[data-testid=canvas-screen]')
          .analyze()
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
          ),
        ).toEqual([])
      }
      await page.goto('/')
      await expect(page.getByTestId('try-guest')).toBeVisible()
      await check()
      await page.goto('/learn')
      await expect(page.getByTestId('tutorial-first-button')).toBeVisible()
      await check()
      await page
        .getByTestId('tutorial-first-button')
        .getByRole('button', { name: /^Commencer/ })
        .click()
      await expect(page.getByTestId('tutorial-bubble')).toBeVisible()
      await check()
      await page.getByTestId('help-button').click()
      await expect(page.getByTestId('help-panel')).toBeVisible()
      await check()
      await page.getByTestId('help-button').click()
      await openBlocks(page)
      await page.getByTestId('slow-motion').click()
      await expect(page.getByTestId('slow-motion-bar')).toBeVisible()
      await check()
    })
  }
}
