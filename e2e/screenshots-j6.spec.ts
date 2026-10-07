import { type Browser, expect, type Page, test } from '@playwright/test'
import { ADMIN, AI_URL, openBlocks, unique, usePrefs } from './helpers.ts'

/**
 * PR screenshots of J6 (SPEC § 7): templates, gallery, remix tree and the AI assistant, in
 * Junior and Studio, light and dark. `npx playwright test --project=screenshots
 * e2e/screenshots-j6.spec.ts` writes them to docs/screenshots/j6/.
 */
const DIR = 'docs/screenshots/j6'

type Prefs = { mode: 'junior' | 'studio'; theme: 'light' | 'dark' }

/** A fresh account on `base`, its profile set to the mode and theme of the picture. */
async function open(browser: Browser, prefs: Prefs, name: string, base?: string): Promise<Page> {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    ...(base ? { baseURL: base } : {}),
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, { ...prefs, locale: 'fr', welcomed: true, toursSeen: { junior: true, studio: true } })
  await page.goto('/login')
  const headers = { origin: new URL(page.url()).origin }
  const post = async (path: string, data: unknown, method = 'POST') => {
    const response = await page.request.fetch(path, { method, data, headers })
    expect(response.ok(), path).toBe(true)
  }
  await post('/api/auth/sign-in/username', ADMIN)
  if (base) await post('/api/admin/settings', { aiEnabled: true, aiDailyQuota: 500 }, 'PATCH')
  const username = `${name.toLowerCase()}-${unique().toLowerCase()}`
  await post('/api/admin/users', { username, displayName: name, password: `${username}-pw-123` })
  await page.context().clearCookies()
  await post('/api/auth/sign-in/username', { username, password: `${username}-pw-123` })
  await post('/api/me', { uiMode: prefs.mode, theme: prefs.theme, locale: 'fr', avatar: 'fox' }, 'PATCH')
  return page
}

/** A project from a template, shared in the gallery; returns its id. */
async function shared(page: Page, template: string): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
  await page.getByRole('dialog').getByTestId(`template-${template}`).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Créer depuis ce modèle' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  const id = new URL(page.url()).pathname.split('/')[2] as string
  const response = await page.request.put(`/api/gallery/${id}/sharing`, {
    data: { shared: true },
    headers: { origin: new URL(page.url()).origin },
  })
  expect(response.ok()).toBe(true)
  return id
}

const VARIANTS = [
  ['junior', 'light'],
  ['junior', 'dark'],
  ['studio', 'light'],
  ['studio', 'dark'],
] as const

for (const [mode, theme] of VARIANTS) {
  test(`${mode} ${theme}`, async ({ browser }) => {
    test.setTimeout(180_000)
    // Templates in the "New project" dialog.
    const page = await open(browser, { mode, theme }, 'Camille')
    await page.goto('/')
    await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
    await page.getByRole('dialog').getByTestId('template-dice').click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-templates.png` })

    // A gallery with a few apps, likes and a remix.
    const scores = await shared(page, 'scoreboard')
    await shared(page, 'catch-star')
    const other = await open(browser, { mode, theme }, 'Sacha')
    await shared(other, 'tabs')
    await shared(other, 'drawing')
    const headers = { origin: new URL(other.url()).origin }
    await other.request.put(`/api/gallery/${scores}/like`, { headers })
    const remix = await other.request.post(`/api/gallery/${scores}/remix`, {
      data: { name: 'Mon tableau des scores' },
      headers,
    })
    const remixId = ((await remix.json()) as { id: string }).id
    await other.request.put(`/api/gallery/${remixId}/sharing`, { data: { shared: true }, headers })
    await page.goto('/gallery')
    await expect(page.getByTestId('gallery-grid')).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-gallery.png` })
    await page.goto(`/gallery?p=${scores}`)
    await expect(page.getByTestId('gallery-entry')).toContainText('Mon tableau des scores')
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-gallery-entry.png` })

    // The assistant (server with a fake Claude API).
    const ai = await open(browser, { mode, theme }, 'Alex', AI_URL)
    await ai.goto('/')
    await ai.getByTestId('ai-create-open').click()
    await ai.getByRole('dialog').getByRole('textbox').fill('Une appli qui tire au sort qui fait la vaisselle')
    await ai.screenshot({ path: `${DIR}/${mode}-${theme}-ai-ask.png` })
    await ai.getByRole('dialog').getByRole('button', { name: 'Proposer une appli' }).click()
    await expect(ai.getByTestId('ai-proposal')).toBeVisible()
    await ai.waitForTimeout(400)
    await ai.screenshot({ path: `${DIR}/${mode}-${theme}-ai-proposal.png` })
    await ai.getByRole('button', { name: 'Garder cette appli' }).click()
    await ai.waitForURL(/\/p\/[^/]+/)
    await openBlocks(ai)
    await ai.getByTestId('ai-explain-screen').click()
    await expect(ai.getByTestId('ai-answer')).toBeVisible()
    await ai.waitForTimeout(600)
    await ai.screenshot({ path: `${DIR}/${mode}-${theme}-ai-explain.png` })
    await ai.getByTestId('ai-panel').getByRole('button', { name: 'Fermer' }).click()
    await ai.getByTestId('ai-debug-open').click()
    await ai.getByTestId('ai-panel').getByRole('button', { name: 'Chercher le problème' }).click()
    await expect(ai.getByTestId('ai-answer')).toBeVisible()
    await ai.waitForTimeout(600)
    await ai.screenshot({ path: `${DIR}/${mode}-${theme}-ai-debug.png` })

    for (const p of [page, other, ai]) await p.context().close()
  })
}
