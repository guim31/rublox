import type { Locale, UiMode } from '@rublox/schema'
import type { AppSpec } from './spec.ts'

/** Texts of a template card, in one language. */
export type TemplateTexts = { title: string; description: string }

/** The groups of the "New project" dialog (J10), in their order. */
export const TEMPLATE_CATEGORIES = ['games', 'fun', 'tools', 'learn'] as const
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

/** A project to start from (SPEC § 4.8), offered when a project is created. */
export type Template = {
  id: string
  order: number
  /** The mode it suits best (the dialog shows it, it does not hide it). */
  mode: UiMode
  /** An emoji for the card. */
  icon: string
  /** A colour of the Rublox palette for the card: indigo, coral, yellow, mint. */
  accent: 'indigo' | 'coral' | 'yellow' | 'mint'
  category: TemplateCategory
  /**
   * An animated picture of the app for its card (J10, the games): a file of the template's
   * folder. Without one, the card shows the first screen in miniature.
   */
  cover?: string
  recipe: AppSpec
  texts: Record<Locale, TemplateTexts>
}

// Content is data (`content/`, SPEC § 6.2): a template is a `template.json` (the recipe of
// the app) and one text file per language. Adding one = a folder + one line below (a game:
// `authoring/games/` and `games.ts`).
export function template(data: unknown, fr: unknown, en: unknown): Template {
  return {
    ...(data as Omit<Template, 'texts'>),
    texts: { fr: fr as TemplateTexts, en: en as TemplateTexts },
  }
}
