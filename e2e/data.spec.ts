import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test'
import {
  ADMIN,
  blockOfType,
  dragBlock,
  dropEvent,
  dropInside,
  dropOnValue,
  flyoutBlock,
  openCategory,
  preview,
  signIn,
  unique,
  usePrefs,
} from './helpers.ts'

const bubble = (page: Page) => page.getByTestId('tutorial-bubble')
const step = (page: Page) => bubble(page).getByTestId('tutorial-text')

/**
 * What Open-Meteo answers. The relay itself is tested against a local server and the private
 * addresses in `apps/server/test/relay.test.ts`; here the outside world is replaced so that
 * the test does not depend on the network.
 */
const FORECAST = {
  latitude: 48.86,
  longitude: 2.34,
  current_units: { time: 'iso8601', temperature_2m: '°C' },
  current: { time: '2026-10-07T12:00', interval: 900, temperature_2m: 18.4 },
}

async function fakeOpenMeteo(context: BrowserContext) {
  const answer = { status: 200, contentType: 'application/json', body: FORECAST }
  // "Try" in the Data tab (studio origin) and the app's calls (apps origin).
  await context.route('**/api/projects/*/data/try', (route) =>
    route.fulfill({ json: { response: answer } }),
  )
  await context.route('**/_rx/proxy', async (route) => {
    const request = route.request().postDataJSON() as { path?: string; credential?: unknown }
    expect(request.credential).toMatchObject({ kind: 'editor' })
    expect(request.path).toBe('/forecast')
    await route.fulfill({ json: answer })
  })
}

async function startTutorial(page: Page, id: string) {
  await page.goto('/learn')
  await page
    .getByTestId(`tutorial-${id}`)
    .getByRole('button', { name: /^Commencer/ })
    .click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(step(page)).toBeVisible()
  await bubble(page)
    .getByRole('button')
    .filter({ hasText: /parti|Suivant/ })
    .first()
    .click()
}

/** Fills a field of the Data tab and leaves it (the change is written on blur). */
async function fill(page: Page, label: string | RegExp, value: string) {
  const field = page.getByLabel(label, { exact: typeof label === 'string' })
  await field.fill(value)
  await field.press('Tab')
}

test('SPEC § 8, J5: the weather tutorial works from start to finish', async ({ page, context }) => {
  // A whole tutorial, end to end: about 45 s on two busy cores, too close to the 60 s budget.
  test.slow()
  await usePrefs(page, { mode: 'studio', locale: 'fr' })
  await signIn(page, ADMIN.username, ADMIN.password)
  await fakeOpenMeteo(context)
  await startTutorial(page, 'weather')

  await expect(step(page)).toContainText('onglet Données')
  await page.getByRole('button', { name: /^Données$/ }).click()

  await expect(step(page)).toContainText('connexion API')
  await page.getByRole('button', { name: 'Nouvelle connexion' }).click()

  await expect(step(page)).toContainText('Adresse de base')
  await fill(page, 'Adresse de base', 'https://api.open-meteo.com/v1')

  await expect(step(page)).toContainText('trois paramètres')
  for (const [key, value] of [
    ['latitude', '48.85'],
    ['longitude', '2.35'],
    ['current', 'temperature_2m'],
  ] as const) {
    await page.getByRole('button', { name: 'Ajouter un paramètre' }).click()
    const rows = page.getByLabel(/^Paramètres envoyés à chaque appel \d+ — Nom$/)
    const index = (await rows.count()) - 1
    await rows.nth(index).fill(key)
    await rows.nth(index).press('Tab')
    const values = page.getByLabel(/^Paramètres envoyés à chaque appel \d+ — Valeur$/)
    await values.nth(index).fill(value)
    await values.nth(index).press('Tab')
  }

  // "Try", then a click on a field of the answer creates the block that reads it.
  await expect(step(page)).toContainText('Essayer')
  await page.getByLabel('Chemin').fill('/forecast')
  await page.getByRole('button', { name: 'Essayer' }).click()
  await expect(page.getByText('Statut 200')).toBeVisible()
  await page.getByTitle('current.temperature_2m').click()
  await expect(page.getByText(/Bloc ajouté à l’écran/)).toBeVisible()

  await expect(step(page)).toContainText('onglet Blocs')
  await page.getByRole('button', { name: /^Blocs$/ }).click()
  const reader = blockOfType(page, 'rx_object_get')
  await expect(reader).toBeVisible()
  // "set Texte1.text to (the new block)", then "when Bouton1 is clicked" around it. The
  // workspace is zoomed out first: the new block is wide.
  const canvas = await canvasArea(page)

  await openCategory(page, 'Texte1')
  const area = await page.getByTestId('blockly-workspace').boundingBox()
  if (!area) throw new Error('no workspace')
  await dragBlock(page, flyoutBlock(page, /^mettre\s*texte/), {
    x: canvas.x + 380,
    y: area.y + 60,
  })
  const setter = blockOfType(page, 'rx_Text_set')
  await expect(setter).toBeVisible()
  const value = setter.locator('g.blocklyDraggable.text').first()
  // Grab the reader by its path field (its left edge sits under the toolbox's border).
  const path = await reader.locator(':scope > .blocklyEditableField').first().boundingBox()
  const target = await value.boundingBox()
  if (!path || !target) throw new Error('blocks not drawn')
  const grabOffset = path.x + path.width / 2 - ((await reader.boundingBox())?.x ?? path.x)
  await page.mouse.move(path.x + path.width / 2, path.y + path.height / 2)
  await page.mouse.down()
  await page.mouse.move(path.x + path.width / 2 + 30, path.y + 40, { steps: 4 })
  await page.mouse.move(target.x + 4 + grabOffset, target.y + target.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(setter.locator('g.rx_object_get')).toBeVisible()
  await openCategory(page, 'Bouton1')
  const event = await dropEvent(page, /est\scliqué/, 'rx_Button_on_click', {
    x: canvas.x - area.x + 380,
    y: 300,
  })
  await dropInside(page, setter, event)
  await expect(event.locator('g.rx_Text_set')).toBeVisible()

  // The app calls the API through the relay and shows the temperature.
  await expect(step(page)).toContainText('aperçu')
  const app = preview(page)
  await expect(async () => {
    await app.locator('[data-rx-name="Bouton1"]').dispatchEvent('click')
    await expect(app.locator('[data-rx-name="Texte1"]')).toHaveText('18.4', { timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await expect(page.getByTestId('tutorial-finished')).toBeVisible()
})

test('SPEC § 8, J5: the family chat syncs two browsers', async ({ page, browser }) => {
  // A whole tutorial, end to end: about 45 s on two busy cores, too close to the 60 s budget.
  test.slow()
  await usePrefs(page, { mode: 'studio', locale: 'fr' })
  await signIn(page, ADMIN.username, ADMIN.password)
  await startTutorial(page, 'family-chat')

  // A shared table "Messages" with two columns.
  await page.getByRole('button', { name: /^Données$/ }).click()
  await page.getByRole('button', { name: 'Nouvelle table' }).click()
  await fill(page, 'Nom de la table', 'Messages')
  await page.getByRole('radio', { name: 'Partagée' }).click()
  await expect(step(page)).toContainText('deux colonnes')
  await page.getByRole('button', { name: /^Options de la colonne Colonne$/ }).click()
  await fill(page, 'Nom de la colonne', 'Auteur')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Colonne', exact: true }).click()
  await page.getByRole('button', { name: /^Options de la colonne Colonne 2$/ }).click()
  await fill(page, 'Nom de la colonne', 'Texte')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('columnheader', { name: /Texte/ })).toBeVisible()

  // The data list shows the table: title = Texte, subtitle = Auteur.
  await page.getByRole('button', { name: /^Design$/ }).click()
  await page.getByTestId('layer-ListeDonnees1').click()
  await page.getByLabel('source (table)').selectOption({ label: 'Messages' })
  await page.getByLabel('Titre', { exact: true }).selectOption({ label: 'Texte' })
  await page.getByLabel('Sous-titre', { exact: true }).selectOption({ label: 'Auteur' })

  // When Envoyer is clicked, add a row: Auteur = Champ1.texte, Texte = Champ2.texte.
  await page.getByRole('button', { name: /^Blocs$/ }).click()
  await expect(page.locator('.blocklySvg').first()).toBeVisible()
  await openCategory(page, 'Bouton1')
  const event = await dropEvent(page, /est\scliqué/, 'rx_Button_on_click')
  await openCategory(page, 'Données')
  await dropInside(page, flyoutBlock(page, /ajouter\sune\sligne/), event)
  const add = blockOfType(page, 'rx_table_add')
  await expect(add).toBeVisible()
  for (const field of ['Champ1', 'Champ2']) {
    await openCategory(page, field)
    const getter = page
      .locator('.blocklyFlyout .blocklyBlockCanvas > g.blocklyDraggable.rx_TextInput_get')
      .filter({ hasText: /^texte[^a-z]*de/ })
      .first()
    await reveal(page, getter)
    await dropOnValue(page, getter, add.locator('g.blocklyDraggable.text').first())
  }
  await expect(add.locator('g.rx_TextInput_get')).toHaveCount(2)

  // Publish, then open the app in two browsers.
  const slug = `tchat-${unique().toLowerCase()}`
  await page.getByTestId('publish-open').click()
  await page.getByTestId('publish-slug').fill(slug)
  await expect(page.getByText('Adresse libre')).toBeVisible()
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId('publish-state')).toHaveText('En ligne · Version 1')
  const url = await page.getByTestId('publish-url').inputValue()

  const phones = await Promise.all([browser.newContext(), browser.newContext()])
  const [lea, tom] = await Promise.all(phones.map((context) => context.newPage()))
  if (!lea || !tom) throw new Error('no page')
  await Promise.all([lea.goto(url), tom.goto(url)])
  const send = async (app: Page, author: string, message: string) => {
    await app.locator('[data-rx-name="Champ1"] input').fill(author)
    await app.locator('[data-rx-name="Champ2"] input').fill(message)
    await app.locator('[data-rx-name="Bouton1"]').click()
  }
  await send(lea, 'Léa', 'Coucou Tom !')
  await expect(tom.locator('[data-rx-name="ListeDonnees1"]')).toContainText('Coucou Tom !')
  await expect(tom.locator('[data-rx-name="ListeDonnees1"]')).toContainText('Léa')
  await send(tom, 'Tom', 'Salut Léa')
  await expect(lea.locator('[data-rx-name="ListeDonnees1"]')).toContainText('Salut Léa')
  // A newcomer sees the conversation.
  await lea.reload()
  await expect(lea.locator('.rx-card-title')).toHaveText(['Coucou Tom !', 'Salut Léa'])
  for (const context of phones) await context.close()

  // The editor's Data tab shows the server's rows.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Données$/ }).click()
  await page.getByRole('button', { name: 'Messages' }).click()
  await expect(page.getByLabel('Texte, ligne 2')).toHaveValue('Salut Léa')
})

/** Scrolls the open flyout until `block` is within the window (it may sit far down). */
async function reveal(page: Page, block: Locator) {
  const flyout = await page.locator('.blocklyFlyout').first().boundingBox()
  if (!flyout) throw new Error('no flyout')
  for (let i = 0; i < 30; i++) {
    const box = await block.boundingBox()
    if (box && box.y > flyout.y && box.y + box.height < flyout.y + flyout.height - 10) return
    await page.mouse.move(flyout.x + flyout.width / 2, flyout.y + flyout.height / 2)
    await page.mouse.wheel(0, 200)
    await page.waitForTimeout(50)
  }
}

/** The part of the blocks workspace right of the toolbox, where blocks can be dropped. */
async function canvasArea(page: Page) {
  const area = await page.getByTestId('blockly-workspace').boundingBox()
  const toolbox = await page.locator('.blocklyToolbox').first().boundingBox()
  if (!area || !toolbox) throw new Error('no workspace')
  const left = toolbox.x + toolbox.width
  return { x: left, y: area.y, width: area.x + area.width - left, height: area.height }
}
