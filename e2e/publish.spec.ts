import { readFile } from 'node:fs/promises'
import { devices, expect, type Page, test } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import {
  ADMIN,
  addComponent,
  blockOfType,
  buildHelloBlocks,
  dropEvent,
  dropInside,
  flyoutBlock,
  newProject,
  openBlocks,
  openCategory,
  signIn,
  unique,
  usePrefs,
} from './helpers.ts'

/** A small PNG (8×8, violet). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR42mOMTGVgYGBgYmBgAAAUrAEz8n7XUgAAAABJRU5ErkJggg==',
  'base64',
)

async function selectedText(page: Page, value: string) {
  await page.getByRole('textbox', { name: 'texte', exact: true }).fill(value)
}

test('a phone follows the editor live, and its console comes back', async ({ page, browser }) => {
  await signIn(page, ADMIN.username, ADMIN.password)
  await newProject(page, `Direct ${unique()}`)
  await addComponent(page, 'Button')
  await addComponent(page, 'Text')

  await page.getByTestId('live-open').click()
  const field = page.getByTestId('live-url')
  await expect(field).toHaveValue(/^http:\/\/127\.0\.0\.1:\d+\/live\/[\w-]+$/)
  const url = await field.inputValue()
  await expect(page.getByRole('img', { name: 'QR code du lien de test' })).toBeVisible()

  // A phone (emulated) opens the link of the QR code.
  const phoneContext = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR' })
  const phone = await phoneContext.newPage()
  await phone.goto(url)
  await expect(phone.locator('[data-rx-name="Bouton1"]')).toHaveText('Bouton')
  await expect(page.getByTestId('live-phone-count')).toHaveText('1 téléphone connecté')
  await expect(page.getByTestId('live-status')).toHaveAttribute('data-status', 'live')
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
  await expect(page.getByTestId('live-phones')).toHaveText('1')

  // A design change reaches the phone right away.
  await page.getByTestId('layer-Bouton1').click()
  const changed = Date.now()
  await selectedText(page, 'Lancer')
  await expect(phone.locator('[data-rx-name="Bouton1"]')).toHaveText('Lancer', { timeout: 3000 })
  test.info().annotations.push({ type: 'live latency', description: `${Date.now() - changed} ms` })

  // Blocks too: the phone runs them, and its console reaches the editor.
  await openBlocks(page)
  await buildHelloBlocks(page, 'Bonjour du téléphone')
  await expect(async () => {
    await phone.locator('[data-rx-name="Bouton1"]').click()
    await expect(phone.locator('[data-rx-name="Texte1"]')).toHaveText('Bonjour du téléphone', {
      timeout: 500,
    })
  }).toPass()

  // Stopping the test disconnects the phone.
  await page.getByTestId('live-open').click()
  await page.getByRole('button', { name: 'Arrêter le test' }).click()
  await expect(phone.getByText('Ce lien de test a été arrêté.')).toBeVisible()
  await phoneContext.close()
})

test('the phone console and its device show in the editor', async ({ page, browser }) => {
  await usePrefs(page, { mode: 'studio' })
  await signIn(page, ADMIN.username, ADMIN.password)
  await newProject(page, `Console ${unique()}`)
  await addComponent(page, 'Button')
  await openBlocks(page)
  await openCategory(page, 'Bouton1')
  const event = await dropEvent(page, /est\scliqué/, 'rx_Button_on_click')
  await openCategory(page, 'Débogage')
  await dropInside(page, flyoutBlock(page, /afficher/), event)
  await expect(blockOfType(page, 'rx_log')).toBeVisible()

  await page.getByTestId('live-open').click()
  const url = await page.getByTestId('live-url').inputValue()
  const phoneContext = await browser.newContext({ ...devices['iPhone 13'] })
  const phone = await phoneContext.newPage()
  await phone.goto(url)
  await expect(page.getByRole('list', { name: '1 téléphone connecté' })).toContainText(
    'iPhone · Safari',
  )
  await expect(async () => {
    await phone.locator('[data-rx-name="Bouton1"]').click()
    await expect(page.getByTestId('live-console')).toContainText('Bonjour', { timeout: 500 })
  }).toPass()
  await expect(page.getByTestId('live-console')).toContainText('iPhone · Safari')
  await phoneContext.close()
  await expect(page.getByTestId('live-phone-count')).toHaveText('En attente d’un téléphone…')
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
  await expect(page.getByTestId('console')).toContainText('iPhone · Safari')
})

test('publish an app: manifest, service worker, offline, versions, unpublish', async ({
  page,
  context,
}) => {
  const id = unique().toLowerCase()
  await signIn(page, ADMIN.username, ADMIN.password)
  await newProject(page, `Le dé ${id}`)
  await addComponent(page, 'Button')
  await selectedText(page, 'Lancer')

  await page.getByTestId('publish-open').click()
  const slug = `de-${id}`
  await page.getByTestId('publish-slug').fill(slug)
  await expect(page.getByText('Adresse libre')).toBeVisible()
  await page.getByRole('button', { name: 'Choisir l’émoji 🎲' }).click()
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId('publish-state')).toHaveText('En ligne · Version 1')
  const url = await page.getByTestId('publish-url').inputValue()
  expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:\\d+/a/${slug}/$`))

  const app = await context.newPage()
  await app.goto(url)
  await expect(app.locator('[data-rx-name="Bouton1"]')).toHaveText('Lancer')
  await expect(app).toHaveTitle(`Le dé ${id}`)

  // A valid web app manifest, with its icons.
  const manifest = await app.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    return link ? await (await fetch(link.href)).json() : null
  })
  expect(manifest).toMatchObject({
    name: `Le dé ${id}`,
    start_url: `/a/${slug}/`,
    scope: `/a/${slug}/`,
    display: 'standalone',
  })
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const response = await app.request.get(new URL(icon.src, url).href)
    expect(response.headers()['content-type']).toBe('image/png')
  }
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )

  // An active service worker of its own, scoped to the app.
  await expect
    .poll(() =>
      app.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready
        return { state: registration.active?.state, scope: registration.scope }
      }),
    )
    .toEqual({ state: 'activated', scope: url })
  await app.reload()
  await expect
    .poll(() => app.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)

  // Offline, the app still opens.
  await context.setOffline(true)
  await app.reload()
  await expect(app.locator('[data-rx-name="Bouton1"]')).toHaveText('Lancer')
  await context.setOffline(false)

  // The installation help.
  await app.getByTestId('install-button').click()
  await expect(app.getByTestId('install-help')).toContainText('Sur iPhone ou iPad')
  await app.getByRole('button', { name: 'Fermer' }).click()

  // A new version, at the same address.
  await page.keyboard.press('Escape')
  await selectedText(page, 'Lancer le dé')
  await page.getByTestId('publish-open').click()
  await page.getByRole('radio', { name: 'Réglages' }).click()
  await expect(page.getByTestId('publish-slug')).toHaveAttribute('readonly', '')
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId('publish-state')).toHaveText('En ligne · Version 2')
  await app.reload()
  await expect(app.locator('[data-rx-name="Bouton1"]')).toHaveText('Lancer le dé')

  // Versions: put the first back online, then unpublish.
  await page.getByRole('radio', { name: 'Versions' }).click()
  await expect(page.getByTestId('publish-version')).toHaveCount(2)
  await page.getByRole('button', { name: 'Remettre en ligne' }).click()
  await expect(page.getByTestId('publish-state')).toHaveText('En ligne · Version 1')
  await page.getByRole('button', { name: 'Dépublier' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dépublier' }).click()
  await expect(page.getByTestId('publish-state')).toHaveText('Pas en ligne')
  await app.reload()
  await expect(app.getByText('Cette appli n’est plus publiée.')).toBeVisible()
})

/** Saves the `.rublox` of the open project and reads it back. */
async function exportProject(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByTestId('transfer-menu').click()
  await page.getByRole('menuitem', { name: 'Exporter le projet (.rublox)' }).click()
  const file = await (await download).path()
  const entries = unzipSync(new Uint8Array(await readFile(file)))
  const doc = JSON.parse(strFromU8(entries['project.json'] as Uint8Array))
  return { file, doc, files: Object.keys(entries).sort() }
}

test('export then import a .rublox file gives the same project', async ({ page }) => {
  await newProject(page, 'Aller-retour')
  await addComponent(page, 'Button')
  await selectedText(page, 'Clique !')
  await page.getByRole('radio', { name: 'Images' }).click()
  await page
    .locator('input[type=file][accept="image/*"]')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: 'logo.png' })).toBeVisible()

  const first = await exportProject(page)
  expect(first.files.filter((name) => name.startsWith('assets/'))).toHaveLength(1)

  await page.goto('/')
  await page.getByTestId('import-file').setInputFiles(first.file)
  await page.waitForURL(
    (url) => !url.pathname.endsWith(first.doc.meta.id) && /\/p\//.test(url.pathname),
  )
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Images' })).toBeVisible()

  const second = await exportProject(page)
  const strip = (doc: { meta: Record<string, unknown> }) => ({
    ...doc,
    meta: { ...doc.meta, id: undefined, updatedAt: undefined },
  })
  expect(second.doc.meta.id).not.toBe(first.doc.meta.id)
  expect(strip(second.doc)).toEqual(strip(first.doc))
  expect(second.files).toEqual(first.files)
})

test('export a website that works from any folder', async ({ page }) => {
  await newProject(page, 'Mon site')
  await addComponent(page, 'Button')
  await selectedText(page, 'Sur le web')
  const download = page.waitForEvent('download')
  await page.getByTestId('transfer-menu').click()
  await page.getByRole('menuitem', { name: 'Exporter en site web (.zip)' }).click()
  const entries = unzipSync(new Uint8Array(await readFile(await (await download).path())))
  const html = strFromU8(entries['index.html'] as Uint8Array)
  expect(html).toContain('"page":{"kind":"site"}')
  expect(html).not.toMatch(/(src|href)="\/_app\//)
  expect(Object.keys(entries)).toEqual(
    expect.arrayContaining(['app.json', 'manifest.webmanifest', 'icon-512.png', 'README.txt']),
  )

  // Hosted in a sub-folder of another site.
  const site = await page.context().newPage()
  await site.route('http://static.example.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/apps\/de\//, '')
    const body = entries[path === '' ? 'index.html' : path]
    if (!body) return route.fulfill({ status: 404 })
    const type = path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.json')
          ? 'application/json'
          : path === ''
            ? 'text/html'
            : 'application/octet-stream'
    return route.fulfill({ status: 200, body: Buffer.from(body), contentType: type })
  })
  await site.goto('http://static.example.com/apps/de/')
  await expect(site.locator('[data-rx-name="Bouton1"]')).toHaveText('Sur le web')
})
