import { gzipSync } from 'node:zlib'
import { expect, type Frame, type Page, test } from '@playwright/test'
import { addComponent, newProject, openBlocks } from './helpers.ts'

/**
 * The performance budgets of SPEC § 7, measured on the production build:
 * - the studio weighs less than 300 KB (gzip) before the editor: everything the dashboard
 *   downloads, JavaScript and CSS, and no Blockly;
 * - the preview shows a change in less than 300 ms;
 * - a property changed in the inspector shows on the canvas in less than 50 ms.
 * The numbers are printed and attached to the report; the PR quotes them. They run in the
 * `perf` project, alone, after the other tests (an idle CPU).
 */

const KB = 1024
const STUDIO_BUDGET = 300 * KB
const PREVIEW_BUDGET_MS = 300
const PROPERTY_BUDGET_MS = 50

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

const round = (value: number) => Math.round(value * 10) / 10

test('the studio weighs less than 300 KB gzip before the editor', async ({ page }, info) => {
  const files = new Map<string, Promise<number>>()
  page.on('response', (response) => {
    const type = response.request().resourceType()
    const url = new URL(response.url())
    if ((type === 'script' || type === 'stylesheet') && url.pathname.startsWith('/_app/')) {
      files.set(
        url.pathname,
        response.body().then((body) => gzipSync(body, { level: 9 }).byteLength),
      )
    }
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Nouveau projet' }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  const sizes = await Promise.all(
    [...files].map(async ([path, size]) => ({ path, gzip: await size })),
  )
  const total = sizes.reduce((sum, file) => sum + file.gzip, 0)
  const report = {
    totalKb: round(total / KB),
    files: sizes
      .sort((a, b) => b.gzip - a.gzip)
      .map((file) => `${file.path} ${round(file.gzip / KB)} KB`),
  }
  console.log('Studio before the editor:', JSON.stringify(report))
  await info.attach('studio-weight', { body: JSON.stringify(report, null, 2) })
  expect(total).toBeLessThan(STUDIO_BUDGET)
  // The editor (Blockly, CodeMirror) comes later, on demand.
  for (const { path } of sizes) expect(path).not.toMatch(/blockly|codemirror/i)
})

async function previewFrame(page: Page): Promise<Frame> {
  const handle = await page.getByTestId('preview-frame').elementHandle()
  const frame = await handle?.contentFrame()
  if (!frame) throw new Error('no preview frame')
  return frame
}

test('the preview shows a change in less than 300 ms', async ({ page }, info) => {
  await newProject(page, 'Mesure')
  await addComponent(page, 'Button')
  const text = page.getByRole('textbox', { name: 'texte', exact: true })
  await text.fill('Avant')
  await text.fill('Après')
  await openBlocks(page)
  const frame = await previewFrame(page)
  const button = frame.locator('[data-rx-name="Bouton1"]')
  await expect(button).toHaveText('Après')
  await page.waitForTimeout(500)

  const times: number[] = []
  for (let i = 0; i < 12; i++) {
    const expected = i % 2 === 0 ? 'Avant' : 'Après'
    // The preview notes when the button changes; the studio, when the edit is made (undo or
    // redo of the project, as from the keyboard). Both clocks are the machine's.
    await frame.evaluate((want) => {
      const target = document.querySelector('[data-rx-name="Bouton1"]')
      const w = window as unknown as { rxSeenAt?: number }
      w.rxSeenAt = undefined
      const observer = new MutationObserver(() => {
        const now = document.querySelector('[data-rx-name="Bouton1"]')
        if (now?.textContent === want) {
          w.rxSeenAt = performance.timeOrigin + performance.now()
          observer.disconnect()
        }
      })
      observer.observe(target?.closest('body') ?? document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      })
    }, expected)
    const startedAt = await page.evaluate(
      (undo) => {
        const at = performance.timeOrigin + performance.now()
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: undo ? 'z' : 'y', ctrlKey: true, bubbles: true }),
        )
        return at
      },
      i % 2 === 0,
    )
    await expect(button).toHaveText(expected)
    const seenAt = await frame.evaluate(() => (window as unknown as { rxSeenAt?: number }).rxSeenAt)
    times.push((seenAt ?? Number.NaN) - startedAt)
    await page.waitForTimeout(200)
  }
  const report = {
    medianMs: round(median(times)),
    maxMs: round(Math.max(...times)),
    times: times.map(round),
  }
  console.log('Preview update:', JSON.stringify(report))
  await info.attach('preview-update', { body: JSON.stringify(report, null, 2) })
  expect(times.every(Number.isFinite)).toBe(true)
  expect(median(times)).toBeLessThan(PREVIEW_BUDGET_MS)
})

test('a property shows on the canvas in less than 50 ms', async ({ page }, info) => {
  await newProject(page, 'Mesure')
  await addComponent(page, 'Button')
  const field = page.getByRole('textbox', { name: 'texte', exact: true })
  await expect(field).toBeVisible()
  await page.waitForTimeout(300)
  const times: number[] = []
  for (let i = 0; i < 20; i++) {
    const value = `Texte ${i}`
    const input = await field.elementHandle()
    const elapsed = await page.evaluate(
      async ([element, next]) => {
        const canvas = document.querySelector('[data-testid=canvas-screen]')
        if (!(element instanceof HTMLInputElement) || !canvas) return Number.NaN
        return new Promise<number>((resolve) => {
          let start = 0
          const observer = new MutationObserver(() => {
            const button = canvas.querySelector('[data-rx-type="Button"]')
            if (button?.textContent === next) {
              observer.disconnect()
              resolve(performance.now() - start)
            }
          })
          observer.observe(canvas, { subtree: true, childList: true, characterData: true })
          // What typing one character does: the field's value, then its `input` event.
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
          start = performance.now()
          setter?.call(element, next)
          element.dispatchEvent(new Event('input', { bubbles: true }))
        })
      },
      [input, value] as const,
    )
    times.push(elapsed)
    await page.waitForTimeout(50)
  }
  const report = {
    medianMs: round(median(times)),
    maxMs: round(Math.max(...times)),
    times: times.map(round),
  }
  console.log('Property edit:', JSON.stringify(report))
  await info.attach('property-edit', { body: JSON.stringify(report, null, 2) })
  expect(times.every(Number.isFinite)).toBe(true)
  expect(median(times)).toBeLessThan(PROPERTY_BUDGET_MS)
})
