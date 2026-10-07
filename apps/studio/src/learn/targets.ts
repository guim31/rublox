import { messages } from '@rublox/i18n'
import { nameOf } from '@rublox/learn'
import type { Locale, ProjectDoc } from '@rublox/schema'

function visible(element: Element | null): HTMLElement | null {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return null
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? (element as HTMLElement) : null
}

/** The category of Blockly's toolbox whose label is `label`. */
function toolboxCategory(label: string): HTMLElement | null {
  for (const element of document.querySelectorAll('.blocklyToolboxCategory')) {
    const text = element.querySelector('.blocklyToolboxCategoryLabel')?.textContent?.trim()
    if (text === label) return visible(element)
  }
  return null
}

/**
 * The element a tutorial or the tour points at (see `Target` in `@rublox/learn`). Studio
 * elements carry `data-tour` (or the `data-testid` they already had); toolbox categories are
 * found by their label, which is the component's current name.
 */
export function findTarget(
  target: string,
  doc: ProjectDoc | null,
  locale: Locale,
): HTMLElement | null {
  const [kind, value = ''] = target.split(/:(.*)/s)
  const [type = '', n] = value.split('.')
  const nth = n ? Number(n) : 1
  switch (kind) {
    case 'palette':
      if (!value) return visible(document.querySelector('[data-tour="palette"]'))
      return visible(document.querySelector(`[data-testid="palette-${CSS.escape(value)}"]`))
    case 'layer':
      return doc
        ? visible(
            document.querySelector(
              `[data-testid="layer-${CSS.escape(nameOf(doc, type, nth, doc.meta.locale))}"]`,
            ),
          )
        : null
    case 'toolbox':
      return doc ? toolboxCategory(nameOf(doc, type, nth, doc.meta.locale)) : null
    case 'toolbox-category': {
      const labels = messages[locale].blocks.categories as Record<string, string>
      return toolboxCategory(labels[value] ?? value)
    }
    case 'canvas':
      return visible(document.querySelector('[data-testid="canvas-screen"]'))
    case 'preview':
      return visible(document.querySelector('[data-testid="preview-frame"]'))
    case 'workspace':
      return visible(document.querySelector('[data-testid="blockly-workspace"]'))
    case 'screen-picker':
      return visible(document.querySelector('[data-testid="screen-picker"]'))
    default:
      return visible(document.querySelector(`[data-tour="${CSS.escape(target)}"]`))
  }
}

/**
 * What a bubble sits beside: the panel holding the target when it is marked
 * `data-tour-anchor` (the palette), so that the bubble does not hide the target's neighbours.
 */
export function anchorOf(element: HTMLElement): HTMLElement {
  return element.closest<HTMLElement>('[data-tour-anchor]') ?? element
}

/** The open flyout of the toolbox, which a bubble must not cover. */
export function flyoutRect(): DOMRect | null {
  for (const element of document.querySelectorAll('.blocklyFlyout')) {
    const rect = element.getBoundingClientRect()
    if (rect.width > 20 && rect.height > 20 && getComputedStyle(element).display !== 'none')
      return rect
  }
  return null
}
