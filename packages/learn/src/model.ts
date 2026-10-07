import type { Locale, UiMode } from '@rublox/schema'
import type { Condition } from './conditions.ts'

/** The mascot's faces (`apps/studio/src/components/brand.tsx`). */
export type Mood = 'happy' | 'wave' | 'think' | 'cheer' | 'oops'

/** Accent colours of the design system, used for cards and badges. */
export type Accent = 'indigo' | 'coral' | 'yellow' | 'mint'

/**
 * What a project starts with: components on the start screen (localized texts as `{fr, en}`),
 * and extra empty screens.
 */
export type StarterSpec = {
  components?: { type: string; props?: Record<string, unknown> }[]
  screens?: number
}

/**
 * Where the bubble points. Each value is resolved by the studio (`data-tour` attributes, or a
 * search in Blockly's toolbox):
 *
 * - `palette:<Type>`, `layer:<Type>` (the first component of that type), `inspector:<prop>`
 * - `tab:design`, `tab:blocks`, `screen-picker`, `canvas`, `preview`, `slow-motion`, `help`
 * - `toolbox:<Type>`: the toolbox category of the first component of that type
 * - `toolbox-category:<key>`: a general category (`control`, `math`, `interface`…)
 * - `workspace`: the blocks workspace
 * - `tab:data`, and in the Data tab (J5) `data:add-table`, `data:add-api`, `data:mode`,
 *   `data:grid`, `data:add-row`, `data:base-url`, `data:params`, `data:try`, `data:response`
 */
export type Target = string

export type TutorialStep = {
  id: string
  target?: Target
  /** Validates the step when it becomes true; none, or `manual`, shows a "Next" button. */
  check?: Condition
  mood?: Mood
}

export type StepTexts = { text: string; hint?: string }

export type TutorialTexts = {
  title: string
  summary: string
  /** Shown when the tutorial is finished. */
  done: string
  steps: Record<string, StepTexts>
}

/** A tutorial, read from `content/tutorials/<id>/` (SPEC § 4.10). */
export type Tutorial = {
  id: string
  mode: UiMode
  order: number
  minutes: number
  accent: Accent
  /** An emoji, drawn on the tutorial's card. */
  icon: string
  /** Component types it needs: a tutorial whose components do not exist yet is hidden. */
  requires: string[]
  starter?: StarterSpec
  steps: TutorialStep[]
  texts: Record<Locale, TutorialTexts>
}

export type ChallengeTexts = {
  title: string
  goal: string
  /** What each star asks, in order. */
  stars: [string, string, string]
  hint?: string
}

/** A challenge: a goal, an optional starting project, and up to three stars (SPEC § 4.10). */
export type Challenge = {
  id: string
  mode: UiMode
  order: number
  accent: Accent
  icon: string
  requires: string[]
  starter?: StarterSpec
  stars: [Condition, Condition, Condition]
  texts: Record<Locale, ChallengeTexts>
}
