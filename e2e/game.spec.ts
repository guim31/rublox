import { expect, test } from '@playwright/test'
import { addComponent, newProject, openBlocks, openDemo, preview } from './helpers.ts'

test('the catch game, made of blocks only, scores when it is played', async ({ page }) => {
  await openDemo(page, /Attrape les fruits/)
  // The designer shows the scene and its sprites, placed freely.
  const canvas = page.getByTestId('canvas-screen')
  await expect(canvas.locator('[data-rx-name="Panier"]')).toBeVisible()
  await expect(canvas.locator('[data-rx-name="Score"]')).toHaveText('Score : 0')

  // The blocks and the live preview, side by side.
  await openBlocks(page)
  await expect(page.locator('g.blocklyDraggable.rx_Sprite_on_hit').first()).toBeVisible()
  const app = preview(page)
  await expect(app.locator('[data-rx-stage] [data-rx-name="Panier"]')).toBeVisible()
  await expect(app.locator('[data-rx-stage] [data-rx-clone]').first()).toBeAttached({
    timeout: 5_000,
  })

  // Play: tap the garden right above the lowest fruit, so that the basket glides under it.
  const stage = app.locator('[data-rx-stage]')
  await expect(async () => {
    await stage.evaluate((element) => {
      const fruits = [...element.querySelectorAll<HTMLElement>('[data-rx-clone]')]
        .filter((fruit) => fruit.style.display !== 'none')
        .map((fruit) => fruit.getBoundingClientRect())
        .sort((a, b) => b.top - a.top)
      const lowest = fruits[0]
      if (!lowest) return
      const rect = element.getBoundingClientRect()
      const init = {
        bubbles: true,
        clientX: lowest.left + lowest.width / 2,
        clientY: rect.top + rect.height * 0.4,
        pointerId: 1,
      }
      element.dispatchEvent(new PointerEvent('pointerdown', init))
      element.dispatchEvent(new PointerEvent('pointerup', init))
    })
    await expect(app.locator('[data-rx-stage] [data-rx-name="Score"]')).not.toHaveText(
      'Score : 0',
      { timeout: 250 },
    )
  }).toPass({ timeout: 20_000 })
  await expect(app.locator('[data-rx-stage] [data-rx-name="Score"]')).toHaveText(/^Score : [1-9]/)
})

test('a sprite goes into a game scene and moves with the mouse and the keyboard', async ({
  page,
}) => {
  await newProject(page, 'Mon jeu')
  // No scene yet: adding a sprite adds one around it.
  await addComponent(page, 'Sprite')
  await expect(page.getByTestId('layer-Scene1')).toBeVisible()
  await expect(page.getByTestId('layer-Lutin1')).toBeVisible()
  const sprite = page.getByTestId('canvas-screen').locator('[data-rx-name="Lutin1"]')
  await expect(sprite).toHaveText('🐱')
  const x = page.getByRole('spinbutton', { name: 'x', exact: true })
  const y = page.getByRole('spinbutton', { name: 'y', exact: true })
  await expect(x).toHaveValue('180')

  // Drag it on the canvas.
  const box = await sprite.boundingBox()
  if (!box) throw new Error('no sprite')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 6 })
  await page.mouse.up()
  const movedX = Number(await x.inputValue())
  expect(movedX).toBeGreaterThan(190)
  expect(Number(await y.inputValue())).toBeGreaterThan(325)

  // Arrows move by 1, Shift by 10; R turns by 15 degrees.
  await page.getByTestId('selection-box').waitFor()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowRight')
  await expect(x).toHaveValue(String(movedX + 11))
  await page.keyboard.press('r')
  await expect(page.getByRole('spinbutton', { name: 'rotation', exact: true })).toHaveValue('15')

  // A button cannot go into the scene: it lands after it.
  await page.getByTestId('layer-Lutin1').click()
  await addComponent(page, 'Button')
  const layers = page.getByRole('tree')
  await expect(layers.getByTestId('layer-Bouton1')).toBeVisible()
  const scene = page.getByTestId('canvas-screen').locator('[data-rx-name="Scene1"]')
  await expect(scene.locator('[data-rx-name="Bouton1"]')).toHaveCount(0)

  // A costume from the ideas.
  await page.getByTestId('layer-Lutin1').click()
  await page.getByRole('button', { name: 'Ajouter un costume' }).click()
  await page.getByRole('button', { name: '🚀', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Costumes' }).getByRole('listitem')).toHaveCount(2)
})
