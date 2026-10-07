import type { Locale, ProjectDoc, UiMode } from '@rublox/schema'
import billSplitEn from '../../../content/templates/bill-split/en.json' with { type: 'json' }
import billSplitFr from '../../../content/templates/bill-split/fr.json' with { type: 'json' }
import billSplit from '../../../content/templates/bill-split/template.json' with { type: 'json' }
import catchStarEn from '../../../content/templates/catch-star/en.json' with { type: 'json' }
import catchStarFr from '../../../content/templates/catch-star/fr.json' with { type: 'json' }
import catchStar from '../../../content/templates/catch-star/template.json' with { type: 'json' }
import choresEn from '../../../content/templates/chores/en.json' with { type: 'json' }
import choresFr from '../../../content/templates/chores/fr.json' with { type: 'json' }
import chores from '../../../content/templates/chores/template.json' with { type: 'json' }
import converterEn from '../../../content/templates/converter/en.json' with { type: 'json' }
import converterFr from '../../../content/templates/converter/fr.json' with { type: 'json' }
import converter from '../../../content/templates/converter/template.json' with { type: 'json' }
import diceEn from '../../../content/templates/dice/en.json' with { type: 'json' }
import diceFr from '../../../content/templates/dice/fr.json' with { type: 'json' }
import dice from '../../../content/templates/dice/template.json' with { type: 'json' }
import drawingEn from '../../../content/templates/drawing/en.json' with { type: 'json' }
import drawingFr from '../../../content/templates/drawing/fr.json' with { type: 'json' }
import drawing from '../../../content/templates/drawing/template.json' with { type: 'json' }
import helloEn from '../../../content/templates/hello/en.json' with { type: 'json' }
import helloFr from '../../../content/templates/hello/fr.json' with { type: 'json' }
import hello from '../../../content/templates/hello/template.json' with { type: 'json' }
import quizEn from '../../../content/templates/quiz/en.json' with { type: 'json' }
import quizFr from '../../../content/templates/quiz/fr.json' with { type: 'json' }
import quiz from '../../../content/templates/quiz/template.json' with { type: 'json' }
import scoreboardEn from '../../../content/templates/scoreboard/en.json' with { type: 'json' }
import scoreboardFr from '../../../content/templates/scoreboard/fr.json' with { type: 'json' }
import scoreboard from '../../../content/templates/scoreboard/template.json' with { type: 'json' }
import shoppingEn from '../../../content/templates/shopping/en.json' with { type: 'json' }
import shoppingFr from '../../../content/templates/shopping/fr.json' with { type: 'json' }
import shopping from '../../../content/templates/shopping/template.json' with { type: 'json' }
import tabsEn from '../../../content/templates/tabs/en.json' with { type: 'json' }
import tabsFr from '../../../content/templates/tabs/fr.json' with { type: 'json' }
import tabs from '../../../content/templates/tabs/template.json' with { type: 'json' }
import toothbrushEn from '../../../content/templates/toothbrush/en.json' with { type: 'json' }
import toothbrushFr from '../../../content/templates/toothbrush/fr.json' with { type: 'json' }
import toothbrush from '../../../content/templates/toothbrush/template.json' with { type: 'json' }
import { buildProjectOrThrow } from './build.ts'
import type { AppSpec } from './spec.ts'

/** Texts of a template card, in one language. */
export type TemplateTexts = { title: string; description: string }

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
  recipe: AppSpec
  texts: Record<Locale, TemplateTexts>
}

// Content is data (`content/`, SPEC § 6.2): a template is a `template.json` (the recipe of
// the app) and one text file per language. Adding one = a folder + one line below.
function template(data: unknown, fr: unknown, en: unknown): Template {
  return {
    ...(data as Omit<Template, 'texts'>),
    texts: { fr: fr as TemplateTexts, en: en as TemplateTexts },
  }
}

export const TEMPLATES: readonly Template[] = [
  template(dice, diceFr, diceEn),
  template(chores, choresFr, choresEn),
  template(scoreboard, scoreboardFr, scoreboardEn),
  template(quiz, quizFr, quizEn),
  template(toothbrush, toothbrushFr, toothbrushEn),
  template(drawing, drawingFr, drawingEn),
  template(hello, helloFr, helloEn),
  template(shopping, shoppingFr, shoppingEn),
  template(billSplit, billSplitFr, billSplitEn),
  template(converter, converterFr, converterEn),
  template(tabs, tabsFr, tabsEn),
  template(catchStar, catchStarFr, catchStarEn),
].sort((a, b) => a.order - b.order)

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((entry) => entry.id === id)
}

/** A new project from a template, in the language of the app being built. */
export function templateProject(
  template: Template,
  input: { locale: Locale; mode: UiMode; name?: string; now?: Date },
): ProjectDoc {
  return buildProjectOrThrow(template.recipe, {
    locale: input.locale,
    mode: input.mode,
    name: input.name ?? template.texts[input.locale].title,
    now: input.now,
  })
}
