import { type Browser, devices, expect, type Page, test } from '@playwright/test'
import { ADMIN, addComponent, unique, usePrefs } from './helpers.ts'

/**
 * PR screenshots of J4 (SPEC § 7): test on a phone, publication, in Junior and Studio, light
 * and dark, and the phone side. `npx playwright test --project=screenshots
 * e2e/screenshots-j4.spec.ts` writes them to docs/screenshots/j4/.
 */
const DIR = 'docs/screenshots/j4'

type Prefs = { mode: 'junior' | 'studio'; theme: 'light' | 'dark' }

async function open(browser: Browser, prefs: Prefs): Promise<Page> {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, { ...prefs, locale: 'fr' })
  await page.goto('/login')
  const response = await page.request.post('/api/auth/sign-in/username', {
    data: ADMIN,
    headers: { origin: new URL(page.url()).origin },
  })
  expect(response.ok()).toBe(true)
  return page
}

async function project(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
  await page.getByRole('dialog').getByRole('textbox').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await addComponent(page, 'Text')
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Lance le dé !')
  await addComponent(page, 'Button')
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill('Lancer')
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
}

async function phone(browser: Browser, dark: boolean) {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'fr-FR',
    colorScheme: dark ? 'dark' : 'light',
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  return page
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
    await project(page, 'Le dé magique')

    // Test on my phone: one phone connected, its console.
    await page.getByTestId('live-open').click()
    const url = await page.getByTestId('live-url').inputValue()
    const device = await phone(browser, theme === 'dark')
    await device.goto(url)
    await expect(device.locator('[data-rx-name="Bouton1"]')).toHaveText('Lancer')
    await expect(page.getByTestId('live-phone-count')).toHaveText('1 téléphone connecté')
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-live.png` })
    if (mode === 'junior') {
      await device.screenshot({ path: `${DIR}/phone-${theme}-live.png` })
    }
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()

    // Publish: settings, then sharing.
    await page.getByTestId('publish-open').click()
    await page.getByTestId('publish-slug').fill(`de-${unique().toLowerCase()}`)
    await expect(page.getByText('Adresse libre')).toBeVisible()
    await page.getByRole('button', { name: 'Choisir l’émoji 🎲' }).click()
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-publish.png` })
    await page.getByTestId('publish-submit').click()
    await expect(page.getByTestId('publish-state')).toHaveText('En ligne · Version 1')
    await expect(page.getByRole('img', { name: 'QR code de l’appli publiée' })).toBeVisible()
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-publish-share.png` })
    await page.getByRole('radio', { name: 'Versions' }).click()
    if (mode === 'studio') await page.screenshot({ path: `${DIR}/${mode}-${theme}-versions.png` })

    if (mode === 'junior') {
      const appUrl = await (async () => {
        await page.getByRole('radio', { name: 'Partager' }).click()
        return page.getByTestId('publish-url').inputValue()
      })()
      await device.goto(appUrl)
      await expect(device.locator('[data-rx-name="Bouton1"]')).toHaveText('Lancer')
      await device.screenshot({ path: `${DIR}/phone-${theme}-app.png` })
      await device.getByTestId('install-button').click()
      await expect(device.getByTestId('install-help')).toBeVisible()
      await device.screenshot({ path: `${DIR}/phone-${theme}-install.png` })
    }
    await device.context().close()
    await page.context().close()
  })
}
