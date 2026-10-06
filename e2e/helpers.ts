import { expect, type Locator, type Page } from '@playwright/test'

/** Sets the interface preferences before the first load (mode, theme, language). */
export async function usePrefs(
  page: Page,
  prefs: { mode?: 'junior' | 'studio'; theme?: 'light' | 'dark'; locale?: 'fr' | 'en' },
) {
  await page.addInitScript((value) => {
    const current = JSON.parse(localStorage.getItem('rublox:prefs') || '{"state":{},"version":1}')
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

/** Opens a toolbox category by its label. */
export async function openCategory(page: Page, label: string) {
  const label_ = page.locator('.blocklyToolboxCategoryLabel', { hasText: new RegExp(`^${label}$`) })
  await page.locator('.blocklyToolboxCategory').filter({ has: label_ }).last().click()
  await expect(page.locator('.blocklyFlyout').first()).toBeVisible()
}

/** A block in the open flyout, by its text. */
export function flyoutBlock(page: Page, text: RegExp | string): Locator {
  return page
    .locator('.blocklyFlyout .blocklyBlockCanvas > .blocklyDraggable')
    .filter({ hasText: text })
    .first()
}

/** Drags a block by its top-left corner so that this corner lands on `to`. */
export async function dragBlock(page: Page, block: Locator, to: { x: number; y: number }) {
  const box = await block.boundingBox()
  if (!box) throw new Error('block not visible')
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
export async function buildHelloBlocks(page: Page, text = 'Bonjour') {
  await openCategory(page, 'Bouton1')
  const area = await workspace(page).boundingBox()
  if (!area) throw new Error('no workspace')
  await dragBlock(page, flyoutBlock(page, /est\scliqué|is\sclicked/), {
    x: area.x + 380,
    y: area.y + 120,
  })
  const event = workspaceBlocks(page).first()
  await expect(event).toBeVisible()
  const eventBox = await event.boundingBox()
  if (!eventBox) throw new Error('no event block')

  await openCategory(page, 'Texte1')
  await dragBlock(page, flyoutBlock(page, /^mettre\s*texte|^set\s*text/), {
    x: eventBox.x + 18,
    y: eventBox.y + eventBox.height * 0.55,
  })
  // One stack: the setter snapped inside the event block.
  await expect(workspaceBlocks(page)).toHaveCount(1)

  const field = event.locator('.blocklyTextInputField').first()
  const box = await field.boundingBox()
  if (!box) throw new Error('no text field')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const input = page.locator('.blocklyHtmlInput')
  await expect(input).toBeVisible()
  await input.fill(text)
  await input.press('Enter')
}

export function preview(page: Page) {
  return page.frameLocator('[data-testid=preview-frame]')
}
