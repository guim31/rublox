import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { ADMIN, addComponent, newProject, settled, unique, usePrefs } from './helpers.ts'

/** A fresh account whose profile holds the mode and theme (the profile wins over the browser). */
async function account(page: Page, mode: 'junior' | 'studio', theme: 'light' | 'dark') {
  await page.goto('/login')
  const headers = { origin: new URL(page.url()).origin }
  const call = async (path: string, data: unknown, method = 'POST') => {
    const response = await page.request.fetch(path, { method, data, headers })
    expect(response.ok(), path).toBe(true)
  }
  await call('/api/auth/sign-in/username', ADMIN)
  const username = `axe-${unique().toLowerCase()}`
  await call('/api/admin/users', { username, displayName: 'Axe', password: 'axe-password' })
  await page.context().clearCookies()
  await call('/api/auth/sign-in/username', { username, password: 'axe-password' })
  await call('/api/me', { uiMode: mode, theme, locale: 'fr' }, 'PATCH')
}

/** Axe on the J4 dialogs: test on a phone, publish (settings, sharing, versions). */
for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe, publication: ${mode}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await usePrefs(page, { mode, theme, locale: 'fr' })
      await account(page, mode, theme)
      const check = async (where: string) => {
        await settled(page)
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .include('[role=dialog]')
          .analyze()
        expect(
          results.violations.map(
            (v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
          ),
        ).toEqual([])
      }
      await newProject(page, 'Accessible')
      await addComponent(page, 'Button')
      await page.getByTestId('live-open').click()
      await expect(page.getByTestId('live-url')).toHaveValue(/live/)
      await check('live')
      await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
      await page.getByTestId('publish-open').click()
      await page.getByTestId('publish-slug').fill(`axe-${unique().toLowerCase()}`)
      await expect(page.getByText('Adresse libre')).toBeVisible()
      await check('publish')
      await page.getByTestId('publish-submit').click()
      await expect(page.getByTestId('publish-state')).toHaveText('En ligne · Version 1')
      await check('share')
      await page.getByRole('radio', { name: 'Versions' }).click()
      await check('versions')
    })
  }
}
