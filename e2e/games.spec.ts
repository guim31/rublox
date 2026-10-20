import { expect, type FrameLocator, type Locator, type Page, test } from '@playwright/test'
import {
  ADMIN,
  clickInPreview,
  editField,
  openBlocks,
  preview,
  signIn,
  tap,
  unique,
} from './helpers.ts'

/**
 * The game templates (J10): each one is created from the "New project" dialog, played a
 * little in the live preview (an action of the player changes the game), lost (the end
 * screen), and started again with "Rejouer". Its pictures and sounds come with it: the
 * console stays empty (a missing file would warn).
 */

test.describe.configure({ mode: 'parallel' })

/**
 * Creates a project from a template of the Games category and opens its blocks, with the
 * preview. A game template (J10) shows an animated cover in the dialog; the star game (J7)
 * does not.
 */
async function fromTemplate(page: Page, id: string, cover = true) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByTestId('template-category-games').click()
  if (cover) {
    await expect(dialog.getByTestId(`template-${id}`).getByTestId('template-cover')).toBeVisible()
  }
  await dialog.getByTestId(`template-${id}`).click()
  await dialog.getByRole('button', { name: 'Créer depuis ce modèle' }).click()
  await page.waitForURL(/\/p\/[^/]+/, { timeout: 30_000 })
  await openBlocks(page)
  const app = preview(page)
  return { app, errors }
}

/** A game template (J10), on its title screen. */
async function fromGame(page: Page, id: string) {
  const { app, errors } = await fromTemplate(page, id)
  // The title screen: the game's name and "Jouer", drawn with the template's pictures.
  await expect(body(app, 'BoutonJouer')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(body(app, 'BoutonJouer').locator('img')).toHaveJSProperty('complete', true)
  return { app, errors }
}

/** A sprite or a text of the running scene, by name (the original, not a clone). */
function body(app: FrameLocator, name: string): Locator {
  return app.locator(`[data-rx-stage] [data-rx-name="${name}"]:not([data-rx-clone])`)
}

/** A key pressed (or released) in the preview, as the keyboard of a computer would. */
async function key(app: FrameLocator, type: 'keydown' | 'keyup', name: string) {
  await app
    .locator('body')
    .evaluate(
      (element, init) =>
        element.ownerDocument.defaultView?.dispatchEvent(
          new KeyboardEvent(init.type, { key: init.name, bubbles: true }),
        ),
      { type, name },
    )
}

async function press(app: FrameLocator, name: string, ms = 0) {
  await key(app, 'keydown', name)
  if (ms) await new Promise((resolve) => setTimeout(resolve, ms))
  await key(app, 'keyup', name)
}

/** Where a body is drawn now (its transform), in scene units. */
async function at(target: Locator): Promise<{ x: number; y: number }> {
  const transform = await target.evaluate((element) => (element as HTMLElement).style.transform)
  const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(transform)
  return { x: Number(match?.[1] ?? Number.NaN), y: Number(match?.[2] ?? Number.NaN) }
}

/** The centre of a body, in scene units. */
async function centre(target: Locator): Promise<{ x: number; y: number }> {
  const { x, y } = await at(target)
  const size = await target.evaluate((element) => ({
    width: (element as HTMLElement).offsetWidth,
    height: (element as HTMLElement).offsetHeight,
  }))
  return { x: x + size.width / 2, y: y + size.height / 2 }
}

/** The end screen, then "Rejouer": a new game starts. */
async function replay(app: FrameLocator, timeout: number) {
  await expect(body(app, 'BoutonRejouer')).toBeVisible({ timeout })
  await expect(body(app, 'TexteFin')).toBeVisible()
  await tap(body(app, 'BoutonRejouer'))
  await expect(body(app, 'BoutonRejouer')).toBeHidden()
  await expect(body(app, 'Panneau')).toBeHidden()
}

/** The console of the editor: neither a warning nor an error. */
async function quietConsole(page: Page, errors: string[]) {
  const toggle = page.getByRole('button', { name: /Afficher la console|Console/ }).first()
  if ((await page.getByTestId('console').count()) === 0) await toggle.click()
  const panel = page.getByTestId('console')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[aria-label="warn"], [aria-label="error"]')).toHaveCount(0)
  expect(errors).toEqual([])
}

/** Sets a number of the "Change me!" settings (the variable `name`) in the blocks. Block
 * text is not in reading order in the SVG: the block is found by its variable's own field. */
async function setSetting(page: Page, name: string, value: number) {
  const area = page.getByTestId('blockly-workspace')
  const block = area
    .locator('g.blocklyDraggable.variables_set')
    .filter({
      has: page.locator(':scope > .blocklyVariableField', { hasText: new RegExp(`^${name}$`) }),
    })
    .filter({ has: page.locator(':scope > g.math_number') })
    .first()
  const field = block.locator(':scope > g.math_number .blocklyEditableField').first()
  // Scroll the workspace (wheel) until the number is on screen.
  const view = await area.boundingBox()
  if (!view) throw new Error('no workspace')
  await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2)
  await expect(async () => {
    const box = await field.boundingBox()
    if (!box) throw new Error('no field')
    const inside =
      box.x > view.x + 200 &&
      box.x + box.width < view.x + view.width - 100 &&
      box.y > view.y + 60 &&
      box.y + box.height < view.y + view.height - 60
    if (!inside) {
      const dx = box.x - (view.x + view.width / 2)
      const dy = box.y - (view.y + view.height / 2)
      const step = (d: number) => Math.sign(d) * Math.min(Math.abs(d), 1500)
      await page.mouse.wheel(step(dx), step(dy))
      throw new Error('scrolling')
    }
  }).toPass({ timeout: 20_000 })
  const input = await editField(page, field)
  await input.fill(String(value))
  await input.press('Enter')
}

test('Abeille Zigzag: a tap makes the bee fly, a bump ends the game, Rejouer starts again', async ({
  page,
}) => {
  const { app, errors } = await fromGame(page, 'buzzy-bee')
  // "Jouer" answers a real click of the mouse, through the scaled preview (1.2.1).
  await expect(body(app, 'BoutonJouer')).toHaveCSS('pointer-events', 'auto')
  await clickInPreview(page, body(app, 'BoutonJouer'))
  const bee = body(app, 'Abeille')
  await expect(body(app, 'TexteScore')).toBeVisible()
  await expect(body(app, 'BoutonJouer')).toBeHidden()
  // Tapping the meadow sends the bee up.
  await expect(async () => {
    const before = await at(bee)
    await tap(app.locator('[data-rx-stage]'))
    await expect.poll(async () => (await at(bee)).y, { timeout: 400 }).toBeLessThan(before.y)
  }).toPass({ timeout: 5_000 })
  // Without taps, it falls to the ground: the end screen.
  await replay(app, 15_000)
  await expect(bee).toBeVisible()
  await quietConsole(page, errors)
})

test('Serpentin: the arrows turn the snake, a wall ends the game, Rejouer starts again', async ({
  page,
}) => {
  const { app, errors } = await fromGame(page, 'wiggle-snake')
  await tap(body(app, 'BoutonJouer'))
  const head = body(app, 'Tête')
  await expect(head).toBeVisible()
  // Down: the head turns (it is drawn rotated by a quarter turn).
  await press(app, 'ArrowDown')
  await expect
    .poll(() => head.evaluate((el) => (el as HTMLElement).style.transform))
    .toContain('rotate(90deg)')
  // A tap on an arrow of the screen turns it too.
  await tap(body(app, 'FlècheDroite'))
  await expect
    .poll(() => head.evaluate((el) => (el as HTMLElement).style.transform))
    .toContain('rotate(0deg)')
  // Straight on until a wall.
  await replay(app, 15_000)
  await quietConsole(page, errors)
})

test('Robot Fonceur: space makes the robot jump, a crash ends the game, Rejouer starts again', async ({
  page,
}) => {
  const { app, errors } = await fromGame(page, 'robo-dash')
  await tap(body(app, 'BoutonJouer'))
  const robot = body(app, 'Robot')
  await expect(body(app, 'BoutonSaut')).toBeVisible()
  await expect(async () => {
    const before = await at(robot)
    await press(app, ' ')
    await expect.poll(async () => (await at(robot)).y, { timeout: 400 }).toBeLessThan(before.y - 20)
  }).toPass({ timeout: 5_000 })
  // The buttons of the screen answer a tap that goes through the hit test (1.2.1).
  await expect(async () => {
    const before = await at(robot)
    await tap(body(app, 'BoutonSaut'))
    await expect.poll(async () => (await at(robot)).y, { timeout: 400 }).toBeLessThan(before.y - 20)
  }).toPass({ timeout: 5_000 })
  await expect(body(app, 'BoutonGlisse')).toHaveCSS('pointer-events', 'auto')
  // The score is the distance run: it goes up on its own.
  await expect(body(app, 'TexteScore')).not.toHaveText('0')
  // Nothing more: the first obstacle stops it.
  await replay(app, 20_000)
  await quietConsole(page, errors)
})

test('Patrouille Galactique: the ship moves and shoots, a hit ends the game, Rejouer starts again', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const { app, errors } = await fromGame(page, 'galaxy-patrol')
  // "Change me!": one life only, so that the test does not last.
  await setSetting(page, 'vies', 1)
  await expect(body(app, 'BoutonJouer')).toBeVisible()
  await tap(body(app, 'BoutonJouer'))
  const ship = body(app, 'Vaisseau')
  await expect(body(app, 'Manette')).toHaveCSS('pointer-events', 'auto')
  const before = await at(ship)
  await press(app, 'ArrowLeft', 300)
  await expect.poll(async () => (await at(ship)).x).toBeLessThan(before.x - 20)
  // It fires on its own: an enemy of the first wave falls.
  await expect(body(app, 'TexteScore')).not.toHaveText('0', { timeout: 20_000 })
  await expect(body(app, 'TexteVague')).toHaveText('Vague 1')
  await replay(app, 120_000)
  await quietConsole(page, errors)
})

test('Palet Éclair: two players steer their bats, a goal ends a game to 1, Rejouer starts again', async ({
  page,
}) => {
  const { app, errors } = await fromGame(page, 'puck-clash')
  // "Change me!": a game to one goal.
  await setSetting(page, 'butsPourGagner', 1)
  await expect(body(app, 'BoutonJouer')).toBeVisible()
  await tap(body(app, 'BoutonJouer'))
  const blue = body(app, 'Bleu')
  const red = body(app, 'Rouge')
  const puck = body(app, 'Palet')
  await expect(body(app, 'JoystickBleu')).toHaveCSS('pointer-events', 'auto')
  await expect(body(app, 'JoystickRouge')).toHaveCSS('pointer-events', 'auto')
  // Both bats at once: W A S D for blue, the arrows for red.
  const blueBefore = await at(blue)
  const redBefore = await at(red)
  await key(app, 'keydown', 'a')
  await key(app, 'keydown', 'ArrowRight')
  await new Promise((resolve) => setTimeout(resolve, 250))
  await key(app, 'keyup', 'a')
  await key(app, 'keyup', 'ArrowRight')
  await expect.poll(async () => (await at(blue)).x).toBeLessThan(blueBefore.x - 20)
  await expect.poll(async () => (await at(red)).x).toBeGreaterThan(redBefore.x + 20)
  // The puck waits on one side: that side's player comes from behind it and pushes it
  // towards the other goal (red, at the top, attacks downwards).
  const attacksDown = (await centre(puck)).y < 360
  const bat = attacksDown ? red : blue
  const keys = attacksDown
    ? { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }
    : { left: 'a', right: 'd', up: 'w', down: 's' }
  const behind = attacksDown ? -60 : 60
  const deadline = Date.now() + 40_000
  while (!(await body(app, 'BoutonRejouer').isVisible())) {
    expect(Date.now()).toBeLessThan(deadline)
    const p = await centre(puck)
    const b = await centre(bat)
    // Behind the puck, then through it.
    const aim = Math.abs(b.x - p.x) < 20 && Math.sign(p.y - b.y) === -Math.sign(behind)
    const target = aim ? { x: p.x, y: p.y - behind } : { x: p.x, y: p.y + behind }
    const held = [
      ...(target.x < b.x - 8 ? [keys.left] : target.x > b.x + 8 ? [keys.right] : []),
      ...(target.y < b.y - 8 ? [keys.up] : target.y > b.y + 8 ? [keys.down] : []),
    ]
    for (const name of held) await key(app, 'keydown', name)
    await new Promise((resolve) => setTimeout(resolve, 80))
    for (const name of held) await key(app, 'keyup', name)
  }
  await expect(body(app, 'TexteFin')).toHaveText(/gagne/)
  await replay(app, 5_000)
  await quietConsole(page, errors)
})

test('Saute-Nuage: the hero runs with the arrows, falls into a hole, Rejouer starts again', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const { app, errors } = await fromGame(page, 'cloud-hopper')
  await tap(body(app, 'BoutonJouer'))
  const hero = body(app, 'Héros')
  await expect(body(app, 'TexteNiveau')).toHaveText('Niveau 1')
  await expect(body(app, 'Manette')).toHaveCSS('pointer-events', 'auto')
  // A tap on the jump button, through the hit test, makes the hero jump (1.2.1).
  await expect(async () => {
    const before = await at(hero)
    await tap(body(app, 'BoutonSaut'))
    await expect.poll(async () => (await at(hero)).y, { timeout: 400 }).toBeLessThan(before.y - 20)
  }).toPass({ timeout: 5_000 })
  // Running right, without jumping: the camera follows, the hero falls into the first hole
  // three times.
  const start = await at(hero)
  await key(app, 'keydown', 'ArrowRight')
  await expect.poll(async () => (await at(hero)).x).toBeGreaterThan(start.x + 40)
  await expect(body(app, 'TexteVies')).toHaveText('× 2', { timeout: 20_000 })
  await expect(body(app, 'BoutonRejouer')).toBeVisible({ timeout: 40_000 })
  await key(app, 'keyup', 'ArrowRight')
  await replay(app, 5_000)
  await expect(hero).toBeVisible()
  await quietConsole(page, errors)
})

test('Attrape l’étoile (J7): a tap on the star, through the hit test, scores', async ({ page }) => {
  const { app, errors } = await fromTemplate(page, 'catch-star', false)
  const star = body(app, 'Etoile')
  await expect(star).toBeVisible()
  await expect(star).toHaveCSS('pointer-events', 'auto')
  // The moon is decorative: a touch goes through it, to the sky.
  await expect(body(app, 'Lune')).toHaveCSS('pointer-events', 'none')
  const score = body(app, 'Score')
  const before = await score.textContent()
  await tap(star)
  await expect(score).not.toHaveText(before ?? '')
  await quietConsole(page, errors)
})

test('a published game answers a real click on its player origin', async ({ page, context }) => {
  await signIn(page, ADMIN.username, ADMIN.password)
  const { app } = await fromGame(page, 'buzzy-bee')
  await expect(body(app, 'BoutonJouer')).toHaveCSS('pointer-events', 'auto')
  const slug = `abeille-${unique().toLowerCase()}`
  await page.getByTestId('publish-open').click()
  await page.getByTestId('publish-slug').fill(slug)
  await expect(page.getByText('Adresse libre')).toBeVisible()
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId('publish-state')).toHaveText('En ligne · Version 1')
  const url = await page.getByTestId('publish-url').inputValue()

  const played = await context.newPage()
  await played.goto(url)
  const play = played.locator('[data-rx-stage] [data-rx-name="BoutonJouer"]:not([data-rx-clone])')
  await expect(play).toBeVisible()
  await expect(play.locator('img')).toHaveJSProperty('complete', true)
  await expect(play).toHaveCSS('pointer-events', 'auto')
  const box = await play.boundingBox()
  if (!box) throw new Error('no Jouer button')
  await played.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(play).toBeHidden()
  await expect(
    played.locator('[data-rx-stage] [data-rx-name="TexteScore"]:not([data-rx-clone])'),
  ).toBeVisible()
  await played.close()
})
