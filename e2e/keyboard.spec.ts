import { expect, type Page, test } from '@playwright/test'
import { addComponent, newProject, openBlocks, usePrefs } from './helpers.ts'

/**
 * Blocks with the keyboard only (SPEC § 4.2, § 5.1): Blockly 13's own navigation, its full
 * set of shortcuts registered by the studio. Tab reaches the toolbox, arrows choose, Enter
 * places a block (twice: insert, then confirm), and a block placed while another one is
 * chosen attaches to it.
 */

const focused = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')

async function press(page: Page, ...keys: string[]) {
  for (const key of keys) await page.keyboard.press(key)
}

/** Arrow down in the open flyout until the block read out matches. */
async function downTo(page: Page, label: RegExp) {
  await expect(async () => {
    if (!label.test(await focused(page))) await page.keyboard.press('ArrowDown')
    expect(await focused(page)).toMatch(label)
  }).toPass({ intervals: [0], timeout: 15_000 })
}

test('builds a stack of blocks with the keyboard only', async ({ page }) => {
  await usePrefs(page, { mode: 'studio' })
  await newProject(page, 'Au clavier')
  await addComponent(page, 'Button')
  await openBlocks(page)

  // Tab from the editor's tabs until the toolbox has the focus.
  await page.getByRole('button', { name: /^Blocs$/ }).focus()
  await expect(async () => {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('treeitem')
  }).toPass({ intervals: [0], timeout: 15_000 })

  // Under « Components », the screen's category: its first block, placed and confirmed.
  await press(page, 'ArrowDown', 'ArrowRight')
  await expect.poll(() => focused(page)).toMatch(/^quand, Accueil, s'ouvre/)
  await press(page, 'Enter', 'Enter')
  // T goes back to the toolbox (on the screen's category); the next one is Bouton1, whose
  // second block is « set visible ».
  await press(page, 't', 'ArrowDown', 'ArrowRight')
  await downTo(page, /^mettre, visible, de, Bouton1/)
  await press(page, 'Enter', 'Enter')

  // One stack: the block went inside the one that was chosen.
  const code = page.getByTestId('code-view')
  await expect(code).toContainText('Accueil.onOpen(async () => {    Bouton1.visible = true;  });')
})

test('lists every keyboard shortcut in the help', async ({ page }) => {
  await newProject(page, 'Aide clavier')
  await page.getByTestId('help-button').click()
  await page.getByTestId('help-panel').getByRole('radio', { name: 'Clavier' }).click()
  const keys = page.getByTestId('help-keys')
  await expect(keys).toContainText('Aller à la boîte à outils')
  await expect(keys).toContainText('Palette de commandes')
  await page.getByRole('searchbox', { name: 'Chercher dans l’aide' }).fill('dupliquer')
  await expect(keys.getByRole('definition')).toHaveCount(2)
})

test('reduced motion stops what moves, endless animations included', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const motion = await page.evaluate(() => {
    const spinner = document.createElement('div')
    spinner.className = 'animate-spin'
    document.body.append(spinner)
    const style = getComputedStyle(spinner)
    return { count: style.animationIterationCount, duration: style.animationDuration }
  })
  expect(motion).toEqual({ count: '1', duration: '0.001s' })
})
