import type { ProjectDoc } from '@rublox/schema'
import { allBlocks } from './blocks.ts'
import type { Accent } from './model.ts'
import type { LearningProgress } from './progress.ts'

export const BADGE_IDS = [
  'first-app',
  'first-tutorial',
  'five-tutorials',
  'loop',
  'variable',
  'function',
  'two-screens',
  'slow-motion',
  'bug-hunter',
  'three-stars',
  'first-publish',
  'first-remix',
] as const

export type BadgeId = (typeof BADGE_IDS)[number]

export type Badge = {
  id: BadgeId
  /** An emoji. */
  icon: string
  accent: Accent
  /** `false` while the feature that earns it does not exist (publication: J4, remix: J6). */
  available: boolean
}

/** Badges and progression (SPEC § 4.10). Their texts are in `@rublox/i18n` (`learn.badges`). */
export const BADGES: readonly Badge[] = [
  { id: 'first-app', icon: '🚀', accent: 'indigo', available: true },
  { id: 'first-tutorial', icon: '🎓', accent: 'mint', available: true },
  { id: 'five-tutorials', icon: '🏅', accent: 'yellow', available: true },
  { id: 'loop', icon: '🔁', accent: 'coral', available: true },
  { id: 'variable', icon: '📦', accent: 'yellow', available: true },
  { id: 'function', icon: '🧩', accent: 'indigo', available: true },
  { id: 'two-screens', icon: '📱', accent: 'mint', available: true },
  { id: 'slow-motion', icon: '🐢', accent: 'mint', available: true },
  { id: 'bug-hunter', icon: '🔎', accent: 'coral', available: true },
  { id: 'three-stars', icon: '⭐', accent: 'yellow', available: true },
  { id: 'first-publish', icon: '🌍', accent: 'indigo', available: true },
  { id: 'first-remix', icon: '🎨', accent: 'coral', available: false },
]

const LOOPS = [
  'controls_repeat_ext',
  'controls_whileUntil',
  'controls_for',
  'controls_forEach',
  'rx_forever',
]
const VARIABLE_WRITES = ['variables_set', 'math_change']
const EVENT = /^rx_\w+_on_\w+$|^rx_app_start$/

/** Badges a project earns: blocks that run (inside an event or a function) count. */
export function badgesFromProject(doc: ProjectDoc): BadgeId[] {
  const earned: BadgeId[] = []
  const running = allBlocks(doc).filter(
    ({ enabled, ancestors }) =>
      enabled && ancestors.some((type) => EVENT.test(type) || type.startsWith('procedures_def')),
  )
  const has = (types: string[]) => running.some(({ block }) => types.includes(block.type))
  if (
    allBlocks(doc).some(({ block, enabled }) => enabled && EVENT.test(block.type)) &&
    running.length
  )
    earned.push('first-app')
  if (has(LOOPS)) earned.push('loop')
  if (has(VARIABLE_WRITES)) earned.push('variable')
  if (
    allBlocks(doc).some(
      ({ block, enabled }) => enabled && block.type.startsWith('procedures_def'),
    ) &&
    has(['procedures_callnoreturn', 'procedures_callreturn'])
  )
    earned.push('function')
  if (doc.screenOrder.length >= 2 && has(['rx_screen_open'])) earned.push('two-screens')
  return earned
}

/** Badges earned by the progression itself (tutorials finished, stars). */
export function badgesFromProgress(progress: LearningProgress): BadgeId[] {
  const earned: BadgeId[] = []
  const done = Object.values(progress.tutorials).filter((t) => t.status === 'done').length
  if (done >= 1) earned.push('first-tutorial')
  if (done >= 5) earned.push('five-tutorials')
  if (Object.values(progress.challenges).some((c) => c.stars >= 3)) earned.push('three-stars')
  return earned
}
