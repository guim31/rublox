import { expect, type Locator, type Page } from '@playwright/test'

/** Sets the interface preferences before the first load (mode, theme, language). */
export async function usePrefs(
  page: Page,
  prefs: {
    mode?: 'junior' | 'studio'
    theme?: 'light' | 'dark'
    locale?: 'fr' | 'en'
    welcomed?: boolean
    toursSeen?: { junior: boolean; studio: boolean }
  },
) {
  await page.addInitScript((value) => {
    const current = JSON.parse(localStorage.getItem('rublox:prefs') || '{"state":{},"version":2}')
    localStorage.setItem(
      'rublox:prefs',
      JSON.stringify({ ...current, state: { ...current.state, ...value } }),
    )
  }, prefs)
}

/** Creates a guest project from the dashboard and waits for the editor. */
export async function newProject(page: Page, name = 'Mon appli') {
  await page.goto('/')
  await page
    .getByRole('button', { name: /Nouveau projet|New project/ })
    .first()
    .click()
  const field = page.getByRole('dialog').getByRole('textbox')
  await field.fill(name)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Créer|Create/ })
    .click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(page.getByTestId('canvas-screen')).toBeVisible()
}

export async function addComponent(page: Page, type: string) {
  await page.getByTestId(`palette-${type}`).press('Enter')
}

export async function openBlocks(page: Page) {
  await page.getByRole('button', { name: /^(Blocs|Blocks)$/ }).click()
  await expect(page.locator('.blocklySvg').first()).toBeVisible()
}

/** The blocks of the open flyout, as text (empty when none is open). */
function flyoutText(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.blocklyFlyout .blocklyBlockCanvas > .blocklyDraggable')]
      .map((block) => block.textContent ?? '')
      .join('|'),
  )
}

/**
 * Opens a toolbox category by its label, and waits until its flyout is drawn and still: the
 * flyout of the previous category stays on screen for a moment after the category is
 * selected, and may hold a block of the same name ("set text of Bouton1" while "Texte1"
 * opens), which a drag would then miss.
 */
export async function openCategory(page: Page, label: string) {
  const label_ = page.locator('.blocklyToolboxCategoryLabel', { hasText: new RegExp(`^${label}$`) })
  const row = page.locator('.blocklyToolboxCategory').filter({ has: label_ }).last()
  const item = page.getByRole('treeitem', { name: label, exact: true }).last()
  // Already open: its flyout is the one on screen.
  const previous =
    (await item.getAttribute('aria-selected')) === 'true' ? null : await flyoutText(page)
  await expect(async () => {
    // Clicking the selected category would close it.
    if ((await item.getAttribute('aria-selected')) !== 'true') await row.click()
    await expect(item).toHaveAttribute('aria-selected', 'true', { timeout: 1000 })
  }).toPass()
  await expect(page.locator('.blocklyFlyout').first()).toBeVisible()
  let last = ''
  await expect
    .poll(async () => {
      const now = await flyoutText(page)
      const still = now !== '' && now !== previous && now === last
      last = now
      return still
    })
    .toBe(true)
}

/** A block in the open flyout, by its text. */
export function flyoutBlock(page: Page, text: RegExp | string): Locator {
  return page
    .locator('.blocklyFlyout .blocklyBlockCanvas > .blocklyDraggable')
    .filter({ hasText: text })
    .first()
}

/**
 * Where an element is once it stays there. Blockly draws blocks on the next animation frame:
 * right after a drop, a block (and its fields) may still be where it was before it snapped,
 * and a flyout being drawn still shows the previous category's blocks.
 */
export async function stableBox(locator: Locator) {
  let box = await locator.boundingBox()
  await expect
    .poll(async () => {
      const again = await locator.boundingBox()
      const still = again !== null && JSON.stringify(again) === JSON.stringify(box)
      box = again
      return still
    })
    .toBe(true)
  if (!box) throw new Error('element not visible')
  return box
}

/** Clicks a block's text field and waits for its editor (the click is tried again if the
 * block was still being drawn). Returns the editor's input. */
export async function editField(page: Page, field: Locator): Promise<Locator> {
  const input = page.locator('.blocklyHtmlInput')
  await expect(async () => {
    if (await input.isVisible()) return
    const box = await stableBox(field)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(input).toBeVisible({ timeout: 2000 })
  }).toPass()
  return input
}

/** Drags a block by its top-left corner so that this corner lands on `to`. */
export async function dragBlock(page: Page, block: Locator, to: { x: number; y: number }) {
  // Grab the block only once it stays where it is (a flyout being drawn moves its blocks).
  const box = await stableBox(block)
  // Grab inside the block's body (a hat block's top corner is empty space).
  const offset = { x: 10, y: Math.min(box.height / 2, 36) }
  const grab = { x: box.x + offset.x, y: box.y + offset.y }
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 20, grab.y + 10, { steps: 4 })
  await page.mouse.move(to.x + offset.x, to.y + offset.y, { steps: 12 })
  await page.mouse.up()
}

export function workspace(page: Page): Locator {
  return page.getByTestId('blockly-workspace')
}

/** The top blocks of the main workspace. */
export function workspaceBlocks(page: Page): Locator {
  return page.locator(
    '[data-testid=blockly-workspace] svg.blocklySvg > .blocklyWorkspace > .blocklyBlockCanvas > .blocklyDraggable',
  )
}

/** Builds "when Bouton1 is clicked, set Texte1.text to <text>" with the mouse. */
export async function buildHelloBlocks(page: Page, text = 'Bonjour', target = 'Texte1') {
  await openCategory(page, 'Bouton1')
  const area = await workspace(page).boundingBox()
  if (!area) throw new Error('no workspace')
  await dragBlock(page, flyoutBlock(page, /est\scliqué|is\sclicked/), {
    x: area.x + 380,
    y: area.y + 120,
  })
  const event = workspaceBlocks(page).first()
  await expect(event).toBeVisible()
  const eventBox = await stableBox(event)

  await openCategory(page, target)
  await dragBlock(page, flyoutBlock(page, /^mettre\s*texte|^set\s*text/), {
    x: eventBox.x + 18,
    y: eventBox.y + eventBox.height * 0.55,
  })
  // One stack: the setter snapped inside the event block.
  await expect(workspaceBlocks(page)).toHaveCount(1)

  const input = await editField(page, event.locator('.blocklyTextInputField').first())
  await input.fill(text)
  await input.press('Enter')
}

export function preview(page: Page) {
  return page.frameLocator('[data-testid=preview-frame]')
}

/** A block of the main workspace, by its Blockly type (Blockly puts the type in the class). */
export function blockOfType(page: Page, type: string): Locator {
  return page
    .locator(`[data-testid=blockly-workspace] svg.blocklySvg g.blocklyDraggable.${type}`)
    .first()
}

/** Drops a block from the open flyout into the statement input of `parent`. */
export async function dropInside(page: Page, block: Locator, parent: Locator) {
  const box = await parent.boundingBox()
  if (!box) throw new Error('no parent block')
  await dragBlock(page, block, { x: box.x + 18, y: box.y + Math.min(box.height * 0.55, 52) })
}

/** Drops a value block onto the value input currently holding `shadow`. */
export async function dropOnValue(page: Page, block: Locator, shadow: Locator) {
  const box = await shadow.boundingBox()
  const source = await block.boundingBox()
  if (!box || !source) throw new Error('no target')
  await page.mouse.move(source.x + 4, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + 30, source.y + source.height / 2 + 10, { steps: 4 })
  await page.mouse.move(box.x + 4, box.y + box.height / 2, { steps: 12 })
  await page.mouse.up()
}

/** Drops a hat block (an event) somewhere free in the workspace and returns it. */
export async function dropEvent(page: Page, text: RegExp, type: string, at = { x: 380, y: 120 }) {
  const area = await workspace(page).boundingBox()
  if (!area) throw new Error('no workspace')
  await dragBlock(page, flyoutBlock(page, text), { x: area.x + at.x, y: area.y + at.y })
  const block = blockOfType(page, type)
  await expect(block).toBeVisible()
  return block
}

/** The first administrator, created by the server from the environment (playwright.config.ts). */
export const ADMIN = { username: 'admin', password: 'admin-password' }

let counter = 0
/** A suffix that keeps accounts and projects of parallel tests apart. */
export function unique(): string {
  counter += 1
  return `${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1000)}`
}

/** Signs in through the login page and waits for the dashboard. */
export async function signIn(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/Identifiant ou e-mail|Username or e-mail/).fill(username)
  await page.getByLabel(/^(Mot de passe|Password)$/).fill(password)
  await page.getByRole('button', { name: /^(Me connecter|Sign in)$/ }).click()
  await expect(page.getByTestId('user-menu')).toBeVisible()
}

/** Opens a game demo from the command palette (Ctrl + K). */
export async function openDemo(page: Page, name: RegExp, query = 'démo de jeu') {
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: /Nouveau projet|New project/ }).first(),
  ).toBeVisible()
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox').fill(query)
  await page.getByRole('option', { name }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  await expect(page.getByTestId('canvas-screen')).toBeVisible()
}
/** A first visit: no saved preference (welcome page, guided tour). */
export const EMPTY_STATE = { cookies: [], origins: [] }

/** The server with the AI assistant and a fake Claude API (J6, `playwright.config.ts`). */
export const AI_URL = 'http://localhost:4320'

/** A returning guest of the AI server (welcome page and tours already seen). */
export const AI_STATE = {
  cookies: [],
  origins: [
    {
      origin: AI_URL,
      localStorage: [
        {
          name: 'rublox:prefs',
          value: JSON.stringify({
            state: { welcomed: true, toursSeen: { junior: true, studio: true } },
            version: 2,
          }),
        },
      ],
    },
  ],
}

/** Creates an account as the administrator (API) and returns its credentials. */
export async function createAccount(page: Page, displayName: string) {
  const username = `u${unique()}`
  const password = `${username}-password`
  const response = await page.request.post('/api/admin/users', {
    data: { username, displayName, password },
    headers: { origin: new URL(page.url()).origin },
  })
  expect(response.status()).toBe(201)
  return { username, password }
}

/**
 * Waits until no finite animation is running (a dialog fading in): axe measures the contrast
 * of what is drawn, and a busy machine can leave even a 1 ms animation on its first frame.
 */
export async function settled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getComputedTiming().iterations === Number.POSITIVE_INFINITY,
      ),
  )
}
