import AxeBuilder from '@axe-core/playwright'
import { type Browser, expect, type Page, test } from '@playwright/test'
import {
  ADMIN,
  addComponent,
  buildHelloBlocks,
  editField,
  openBlocks,
  settled,
  signIn,
  unique,
  usePrefs,
  workspaceBlocks,
} from './helpers.ts'

/**
 * Editing a project with several people at once (SPEC § 4.9, J4b): Alice owns the project, Bob
 * edits it with her, Cléo may only look. Each one has a browser of their own.
 */

type Person = { page: Page; username: string; name: string }

async function person(
  browser: Browser,
  name: string,
  mode: 'junior' | 'studio' = 'studio',
  theme: 'light' | 'dark' = 'light',
): Promise<Person> {
  const username = `${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '')}-${unique()}`
  const context = await browser.newContext({ locale: 'fr-FR' })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, { locale: 'fr', mode, theme })
  return { page, username, name }
}

/** Alice's new project, shared with Bob (editor) and Cléo (viewer), open in the three browsers. */
/** Creates a project from the dashboard and returns its id. */
async function createProject(page: Page) {
  await page.goto('/')
  await page
    .getByRole('button', { name: /Nouveau projet|C’est parti/ })
    .first()
    .click()
  await page.getByRole('dialog').getByRole('textbox').fill(`Ensemble ${unique()}`)
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/p\/[^/?]+/)
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
  return new URL(page.url()).pathname.split('/')[2] ?? ''
}

/** Shares a project from its owner's browser. */
async function share(owner: Page, projectId: string, username: string, role: string) {
  const response = await owner.request.put(`/api/projects/${projectId}/members`, {
    data: { username, role },
    headers: { origin: new URL(owner.url()).origin },
  })
  expect(response.ok()).toBe(true)
}

async function team(
  browser: Browser,
  options: { cleo?: boolean; theme?: 'light' | 'dark'; mode?: 'junior' | 'studio' } = {},
) {
  const alice = await person(browser, 'Alice', options.mode, options.theme)
  const bob = await person(browser, 'Bob')
  const cleo = await person(browser, 'Cléo')
  const people = options.cleo === false ? [alice, bob] : [alice, bob, cleo]

  const admin = await (await browser.newContext()).newPage()
  await admin.goto('/login')
  const origin = new URL(admin.url()).origin
  const post = async (page: Page, path: string, data: unknown, method = 'POST') => {
    const response = await page.request.fetch(path, { method, data, headers: { origin } })
    expect(response.ok(), path).toBe(true)
  }
  await post(admin, '/api/auth/sign-in/username', ADMIN)
  for (const p of people) {
    await post(admin, '/api/admin/users', {
      username: p.username,
      displayName: p.name,
      password: `${p.username}-password`,
    })
  }
  await admin.context().close()

  for (const p of people) await signIn(p.page, p.username, `${p.username}-password`)
  const projectId = await createProject(alice.page)
  await post(
    alice.page,
    `/api/projects/${projectId}/members`,
    { username: bob.username, role: 'editor' },
    'PUT',
  )
  if (people.includes(cleo)) {
    await post(
      alice.page,
      `/api/projects/${projectId}/members`,
      { username: cleo.username, role: 'viewer' },
      'PUT',
    )
  }
  for (const p of people.slice(1)) {
    await p.page.goto(`/p/${projectId}?tab=design`)
    await expect(p.page.getByTestId('canvas-screen')).toBeVisible()
  }
  return { alice, bob, cleo, projectId }
}

test('two editors see each other, and each other’s edits within a second', async ({ browser }) => {
  const { alice, bob, cleo } = await team(browser)

  // Presence: Alice sees Bob and Cléo, Cléo only looking.
  await expect(alice.page.getByTestId('presence')).toHaveAttribute('data-count', '2')
  await alice.page.getByTestId('presence').click()
  const entries = alice.page.getByTestId('presence-person')
  await expect(entries).toHaveCount(2)
  await expect(entries.filter({ hasText: 'Bob' })).toContainText('Design · Accueil')
  await expect(entries.filter({ hasText: 'Cléo' })).toContainText('Regarde seulement')
  await alice.page.keyboard.press('Escape')

  // A component added by Alice reaches Bob in less than a second.
  await addComponent(alice.page, 'Button')
  await expect(bob.page.getByTestId('layer-Bouton1')).toBeVisible({ timeout: 1000 })
  await expect(cleo.page.getByTestId('layer-Bouton1')).toBeVisible({ timeout: 1000 })

  // Bob sees what Alice selects, in her colour, on his canvas.
  await alice.page.getByTestId('layer-Bouton1').click()
  const selection = bob.page.getByTestId('peer-selection')
  await expect(selection).toHaveAttribute('data-user', 'Alice')
  await expect(bob.page.getByTestId('peer-label')).toHaveText('Alice')
  // And where she is: Bob follows her to the Blocks tab from the presence menu.
  await alice.page.getByRole('button', { name: /^Blocs$/ }).click()
  await bob.page.getByTestId('presence').click()
  await expect(bob.page.getByTestId('presence-person').filter({ hasText: 'Alice' })).toContainText(
    'Blocs · Accueil',
  )
  await bob.page.getByTestId('presence-person').filter({ hasText: 'Alice' }).click()
  await expect(bob.page.locator('.blocklySvg').first()).toBeVisible()
})

test('a viewer sees the edits live but changes nothing', async ({ browser }) => {
  const { alice, bob, cleo } = await team(browser)
  await expect(cleo.page.getByTestId('save-state')).toHaveAttribute('data-state', 'readonly')
  await addComponent(alice.page, 'Button')
  await expect(cleo.page.getByTestId('layer-Bouton1')).toBeVisible({ timeout: 1000 })
  // Cléo may try things in her tab: nothing leaves it.
  await addComponent(cleo.page, 'Text')
  await expect(cleo.page.getByTestId('layer-Texte1')).toBeVisible()
  await addComponent(alice.page, 'Image')
  await expect(bob.page.getByTestId('layer-Image1')).toBeVisible()
  await expect(bob.page.getByTestId('layer-Texte1')).toHaveCount(0)
  await expect(alice.page.getByTestId('layer-Texte1')).toHaveCount(0)
  await cleo.page.reload()
  await expect(cleo.page.getByTestId('layer-Image1')).toBeVisible()
  await expect(cleo.page.getByTestId('layer-Texte1')).toHaveCount(0)
})

test('undo takes back one’s own edits only', async ({ browser }) => {
  const { alice, bob } = await team(browser, { cleo: false })
  await addComponent(alice.page, 'Button')
  await expect(bob.page.getByTestId('layer-Bouton1')).toBeVisible()
  await addComponent(bob.page, 'Text')
  await expect(alice.page.getByTestId('layer-Texte1')).toBeVisible()
  await alice.page.getByRole('button', { name: 'Annuler' }).click()
  await expect(alice.page.getByTestId('layer-Bouton1')).toHaveCount(0)
  await expect(alice.page.getByTestId('layer-Texte1')).toBeVisible()
  await expect(bob.page.getByTestId('layer-Bouton1')).toHaveCount(0)
  await expect(bob.page.getByTestId('layer-Texte1')).toBeVisible()
  // Bob's undo stack still holds his text, not Alice's button.
  await bob.page.getByRole('button', { name: 'Annuler' }).click()
  await expect(bob.page.getByTestId('layer-Texte1')).toHaveCount(0)
  await expect(alice.page.getByTestId('layer-Texte1')).toHaveCount(0)
  await alice.page.getByRole('button', { name: 'Rétablir' }).click()
  await expect(bob.page.getByTestId('layer-Bouton1')).toBeVisible()
})

test('what two people did offline is merged when they are back', async ({ browser }) => {
  const { alice, bob } = await team(browser, { cleo: false })
  for (const p of [alice, bob]) await p.page.context().setOffline(true)
  for (const p of [alice, bob]) {
    await expect(p.page.getByTestId('save-state')).toHaveAttribute('data-state', 'offline', {
      timeout: 20_000,
    })
  }
  await addComponent(alice.page, 'Button')
  await addComponent(bob.page, 'Text')
  for (const p of [alice, bob]) await p.page.context().setOffline(false)
  for (const p of [alice, bob]) {
    await expect(p.page.getByTestId('layer-Bouton1')).toBeVisible({ timeout: 20_000 })
    await expect(p.page.getByTestId('layer-Texte1')).toBeVisible({ timeout: 20_000 })
    await expect(p.page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
  }
})

/** Types into the first text field of the first stack. */
async function setText(page: Page, text: string) {
  const input = await editField(
    page,
    workspaceBlocks(page).first().locator('.blocklyTextInputField').first(),
  )
  await input.fill(text)
  await input.press('Enter')
}

test('blocks follow stack by stack; the last save wins and says so', async ({ browser }) => {
  const { alice, bob } = await team(browser, { cleo: false })
  await addComponent(alice.page, 'Button')
  await addComponent(alice.page, 'Text')
  await expect(bob.page.getByTestId('layer-Texte1')).toBeVisible()
  await openBlocks(alice.page)
  await openBlocks(bob.page)
  const fieldOf = (page: Page) =>
    workspaceBlocks(page).first().locator('.blocklyTextInputField').first()

  // A stack built by Alice appears at Bob's in less than a second.
  await buildHelloBlocks(alice.page, 'Bonjour')
  await expect(workspaceBlocks(bob.page)).toHaveCount(1, { timeout: 1000 })
  await expect(fieldOf(bob.page)).toHaveText(/Bonjour/, { timeout: 1000 })

  // Bob changes it: Alice's stack follows, and her view does not move.
  // The view (the canvas' transform) and the stack's place in it.
  const view = async (page: Page) => ({
    canvas: await page
      .locator('[data-testid=blockly-workspace] .blocklyBlockCanvas')
      .first()
      .getAttribute('transform'),
    stack: await workspaceBlocks(page).first().getAttribute('transform'),
  })
  const before = await view(alice.page)
  await setText(bob.page, 'Salut')
  await expect(fieldOf(alice.page)).toHaveText(/Salut/, { timeout: 1000 })
  expect(await view(alice.page)).toEqual(before)

  // Bob sees which block Alice picked, in her colour.
  await workspaceBlocks(alice.page)
    .first()
    .click({ position: { x: 12, y: 12 } })
  await expect(bob.page.getByTestId('peer-block-label')).toHaveText('Alice')

  // Alice drags the stack while Bob changes it: Bob saved first, his version stays, and
  // Alice is told.
  const box = await workspaceBlocks(alice.page).first().boundingBox()
  if (!box) throw new Error('no stack')
  await alice.page.mouse.move(box.x + 10, box.y + 20)
  await alice.page.mouse.down()
  await alice.page.mouse.move(box.x + 40, box.y + 40, { steps: 5 })
  await setText(bob.page, 'Coucou')
  await expect(bob.page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
  await alice.page.waitForTimeout(400)
  await alice.page.mouse.move(box.x + 120, box.y + 140, { steps: 5 })
  await alice.page.mouse.up()
  await expect(alice.page.getByText('Pile modifiée par Bob')).toBeVisible()
  await expect(fieldOf(alice.page)).toHaveText(/Coucou/)
  await expect(fieldOf(bob.page)).toHaveText(/Coucou/)
  expect(await view(alice.page)).toEqual(before)
})

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGN4EWCPFTEMLQkAzCRdwQfp4yAAAAAASUVORK5CYII=',
  'base64',
)

test('pasting into someone else’s project copies the files of its images', async ({ browser }) => {
  const { alice, bob } = await team(browser, { cleo: false })
  // Alice's project: an image with a file of hers.
  await addComponent(alice.page, 'Image')
  await alice.page
    .locator('input[type=file][accept="image/*"]')
    .first()
    .setInputFiles({ name: 'pomme.png', mimeType: 'image/png', buffer: PNG })
  const image = (page: Page) =>
    page.getByTestId('canvas-screen').locator('[data-rx-type="Image"] img')
  await expect(image(alice.page)).toBeVisible()
  await alice.page.getByTestId('layer-Image1').click()
  await alice.page.getByTestId('canvas-screen').focus()
  await alice.page.keyboard.press('Control+c')

  // Bob's own project, where Alice may write.
  const theirs = await createProject(bob.page)
  await share(bob.page, theirs, alice.username, 'editor')
  const used = async () => {
    const response = await bob.page.request.get(`/api/projects/${theirs}/storage`)
    return ((await response.json()) as { usedBytes: number }).usedBytes
  }
  expect(await used()).toBe(0)

  await alice.page.goto(`/p/${theirs}?tab=design`)
  await expect(alice.page.getByTestId('canvas-screen')).toBeVisible()
  await alice.page.keyboard.press('Control+k')
  await alice.page.getByRole('option', { name: 'Coller' }).click()
  await expect(alice.page.getByTestId('layer-Image1')).toBeVisible()
  // The file now belongs to Bob's project: it counts in his storage, and he sees the image.
  await expect.poll(used).toBe(PNG.length)
  await expect(image(bob.page)).toBeVisible()
  await expect(image(alice.page)).toBeVisible()
  // A real picture, drawn: its file is there for both.
  for (const page of [alice.page, bob.page]) {
    await expect
      .poll(() => image(page).evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(8)
  }
})

for (const theme of ['light', 'dark'] as const) {
  test(`axe on the presence: ${theme}`, async ({ browser }) => {
    const { alice, bob } = await team(browser, { theme })
    await addComponent(alice.page, 'Button')
    await bob.page.getByTestId('layer-Bouton1').click()
    await expect(alice.page.getByTestId('peer-label')).toHaveText('Bob')
    // An open menu hides the rest of the page from assistive technologies (Radix): then only
    // the menu is checked.
    const check = async (where: string, only?: string) => {
      await settled(alice.page)
      const builder = new AxeBuilder({ page: alice.page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('[data-testid=preview-frame]')
        .exclude('[data-testid=canvas-screen]')
      const results = await (only ? builder.include(only) : builder).analyze()
      expect(
        results.violations.map(
          (v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([])
    }
    await check('editor')
    await alice.page.getByTestId('presence').click()
    await expect(alice.page.getByTestId('presence-person')).toHaveCount(2)
    await check('presence menu', '[role=menu]')
  })
}
