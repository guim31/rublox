import { type Browser, expect, type Page, test } from '@playwright/test'
import { ADMIN, addComponent, unique, usePrefs } from './helpers.ts'

/**
 * PR screenshots of J5 (SPEC § 7): the Data tab (a table, an API connection tried), and a
 * chart and a map bound to the table, in Junior and Studio, light and dark.
 * `npx playwright test --project=screenshots e2e/screenshots-j5.spec.ts` writes them to
 * docs/screenshots/j5/.
 */
const DIR = 'docs/screenshots/j5'

type Prefs = { mode: 'junior' | 'studio'; theme: 'light' | 'dark' }

const PLACES = [
  'Nom,Latitude,Longitude,Visites',
  'Capitole,43.6045,1.4440,12',
  'Jardin des Plantes,43.5930,1.4510,7',
  'Cité de l’espace,43.5866,1.4933,4',
  'Pont Neuf,43.5990,1.4380,9',
].join('\n')

const FORECAST = {
  latitude: 43.6,
  longitude: 1.44,
  current_units: { time: 'iso8601', temperature_2m: '°C', wind_speed_10m: 'km/h' },
  current: { time: '2026-10-07T12:00', temperature_2m: 21.3, wind_speed_10m: 11.2 },
}

/** A fresh account per picture: its profile holds the mode and theme of the picture. */
async function open(browser: Browser, prefs: Prefs): Promise<Page> {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, { ...prefs, locale: 'fr' })
  await page.goto('/login')
  const headers = { origin: new URL(page.url()).origin }
  const post = async (path: string, data: unknown, method = 'POST') => {
    const response = await page.request.fetch(path, { method, data, headers })
    expect(response.ok(), path).toBe(true)
  }
  await post('/api/auth/sign-in/username', ADMIN)
  const username = `alix-${unique().toLowerCase()}`
  await post('/api/admin/users', { username, displayName: 'Alix', password: 'alix-password' })
  await page.context().clearCookies()
  await post('/api/auth/sign-in/username', { username, password: 'alix-password' })
  await post(
    '/api/me',
    { uiMode: prefs.mode, theme: prefs.theme, locale: 'fr', avatar: 'owl' },
    'PATCH',
  )
  await context.route('**/api/projects/*/data/try', (route) =>
    route.fulfill({
      json: { response: { status: 200, contentType: 'application/json', body: FORECAST } },
    }),
  )
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
    await page.goto('/')
    await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
    await page.getByRole('dialog').getByRole('textbox').fill('Mes lieux')
    await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
    await page.waitForURL(/\/p\/[^/]+/)
    await addComponent(page, 'Chart')
    await addComponent(page, 'Map')

    // A table, imported from a CSV file.
    await page.getByRole('button', { name: /^Données$/ }).click()
    await page.getByRole('button', { name: 'Nouvelle table' }).click()
    const name = page.getByLabel('Nom de la table')
    await name.fill('Lieux')
    await name.press('Tab')
    await page.locator('input[type=file]').setInputFiles({
      name: 'lieux.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(PLACES),
    })
    await page.getByRole('button', { name: 'Remplacer les lignes' }).click()
    await expect(page.getByLabel('Visites, ligne 4')).toHaveValue('9')
    await page.mouse.move(0, 0)
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-table.png` })

    // An API connection, tried: the answer as a tree.
    await page.getByRole('button', { name: 'Nouvelle connexion' }).click()
    const base = page.getByLabel('Adresse de base')
    await base.fill('https://api.open-meteo.com/v1')
    await base.press('Tab')
    for (const [key, value] of [
      ['latitude', '43.60'],
      ['longitude', '1.44'],
      ['current', 'temperature_2m,wind_speed_10m'],
    ]) {
      await page.getByRole('button', { name: 'Ajouter un paramètre' }).click()
      const keys = page.getByLabel(/^Paramètres envoyés à chaque appel \d+ — Nom$/)
      await keys.last().fill(key ?? '')
      await keys.last().press('Tab')
      const values = page.getByLabel(/^Paramètres envoyés à chaque appel \d+ — Valeur$/)
      await values.last().fill(value ?? '')
      await values.last().press('Tab')
    }
    await page.getByLabel('Chemin').fill('/forecast')
    await page.getByRole('button', { name: 'Essayer' }).click()
    await expect(page.getByText('Statut 200')).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-api.png` })

    // The chart and the map draw the table's rows on the canvas.
    await page.getByRole('button', { name: /^Design$/ }).click()
    for (const [layer, fields] of [
      [
        'layer-Graphique1',
        [
          ['Étiquette', 'Nom'],
          ['Valeur', 'Visites'],
        ],
      ],
      ['layer-Carte1', []],
    ] as const) {
      await page.getByTestId(layer).click()
      const more = page.getByRole('button', { name: 'Plus d’options' })
      if (await more.isVisible()) await more.click()
      await page.getByLabel('source (table)').selectOption({ label: 'Lieux' })
      for (const [field, column] of fields) {
        await page.getByLabel(field, { exact: true }).selectOption({ label: column })
      }
    }
    await page.getByTestId('layer-Graphique1').click()
    await page.mouse.move(0, 0)
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
    await page.screenshot({ path: `${DIR}/${mode}-${theme}-design.png` })
    await page.context().close()
  })
}
