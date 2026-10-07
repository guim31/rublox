import { type LevelChanges, levelChanges } from '@rublox/learn'
import type { Locale, ProjectDoc, UiMode } from '@rublox/schema'
import { buildProjectOrThrow, localize } from '@rublox/templates'
import { EXPLORE_APPS } from './content.ts'
import type { ExploreApp, ExploreLevel, LevelChallenge, TourStep } from './model.ts'

export function getExploreApp(id: string): ExploreApp | undefined {
  return EXPLORE_APPS.find((app) => app.id === id)
}

export function getLevel(app: string, level: number): ExploreLevel | undefined {
  return getExploreApp(app)?.levels.find((entry) => entry.level === level)
}

/** The id of a level in the progression: `<app>/<level>`. */
export const levelKey = (app: string, level: number) => `${app}/${level}`

/**
 * A level as a project, in the language of the app: the copy one works on. Its ids come from
 * the recipe (`stableIds`), so that two levels can be compared block by block, and it
 * remembers where it comes from (`meta.origin`).
 */
export function levelProject(
  level: ExploreLevel,
  input: { locale: Locale; mode?: UiMode; name?: string; now?: Date },
): ProjectDoc {
  const doc = buildProjectOrThrow(level.recipe, {
    locale: input.locale,
    mode: input.mode,
    name: input.name,
    now: input.now,
    stableIds: true,
  })
  doc.meta.origin = { kind: 'explore', app: level.app, level: level.level }
  return doc
}

/** The level a project was copied from, if any. */
export function levelOf(doc: ProjectDoc): ExploreLevel | undefined {
  const origin = doc.meta.origin
  return origin?.kind === 'explore' ? getLevel(origin.app, origin.level) : undefined
}

/** The tour and the challenges of a level, with their checks in one language. */
export function localLevel(
  level: ExploreLevel,
  locale: Locale,
): { tour: TourStep[]; challenges: LevelChallenge[] } {
  return {
    tour: localize(level.tour, locale),
    challenges: localize(level.challenges, locale),
  }
}

const changes = new Map<string, LevelChanges>()

/**
 * What a level adds or changes compared with the level before it, in one language (block
 * texts differ between languages). `null` for a first level.
 */
export function newInLevel(level: ExploreLevel, locale: Locale): LevelChanges | null {
  const previous = getLevel(level.app, level.level - 1)
  if (!previous) return null
  const key = `${levelKey(level.app, level.level)}:${locale}`
  let found = changes.get(key)
  if (!found) {
    found = levelChanges(levelProject(previous, { locale }), levelProject(level, { locale }))
    changes.set(key, found)
  }
  return found
}
