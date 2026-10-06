import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { addComponent, newProject, openBlocks, usePrefs } from './helpers.ts'

/** Axe on the main pages (SPEC § 7), in both modes and both themes. Blockly's own SVG is left out. */
for (const mode of ['junior', 'studio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe: ${mode}, ${theme}`, async ({ page }) => {
      // No fade-in while axe measures contrasts.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await usePrefs(page, { mode, theme, locale: 'fr' })
      const check = async () => {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .exclude('.injectionDiv')
          .exclude('[data-testid=preview-frame]')
          .exclude('[data-testid=canvas-screen]')
          .analyze()
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
          ),
        ).toEqual([])
      }
      await page.goto('/')
      await check()
      await newProject(page)
      await addComponent(page, 'Button')
      await check()
      await openBlocks(page)
      await check()
    })
  }
}
