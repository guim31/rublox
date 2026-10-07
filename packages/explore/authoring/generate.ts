import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { APPS } from './apps.ts'
import { type Block, stamp, type Text } from './dsl.ts'
import type { AppSource, ComponentSource, LevelSource } from './types.ts'

/**
 * Writes the apps to take apart into `content/explore/` (run `pnpm --filter @rublox/explore
 * content` after a change here; `test/content.test.ts` fails while the JSON is out of date).
 *
 * - `<app>/app.json` (id, order, kind, icon, accent, levels), `fr.json`, `en.json`;
 * - `<app>/niveau-<n>/level.json` (the recipe, with `{ fr, en }` texts inside, the steps of
 *   the tour and the challenges with their checks), `fr.json`, `en.json` (their texts).
 */

export const CONTENT_DIR = join(import.meta.dirname, '../../../content/explore')

const LEVELS = [1, 2, 3, 4] as const

const pick = (text: Text | undefined, locale: 'fr' | 'en') =>
  text === undefined ? undefined : typeof text === 'string' ? text : text[locale]

function componentSpec(source: ComponentSource): Record<string, unknown> {
  return {
    key: source.key,
    type: source.type,
    ...(source.name ? { name: source.name } : {}),
    ...(source.props ? { props: source.props } : {}),
    ...(source.children ? { children: source.children.map(componentSpec) } : {}),
  }
}

function recipe(app: AppSource, source: LevelSource, n: number) {
  return {
    name: { fr: `${pick(app.title, 'fr')} ${n}`, en: `${pick(app.title, 'en')} ${n}` },
    mode: n <= 2 ? 'junior' : 'studio',
    ...(source.theme ? { theme: source.theme } : {}),
    navigation: 'stack',
    variables: source.variables.map((variable) => ({
      key: variable.key,
      name: variable.name,
      kind: variable.kind ?? 'app',
      ...(variable.initial !== undefined ? { initial: variable.initial } : {}),
    })),
    screens: source.screens.map((screen) => ({
      key: screen.key,
      name: screen.name,
      ...(screen.props ? { props: screen.props } : {}),
      components: screen.components.map(componentSpec),
      blocks: stamp(screen.blocks as Block[]),
    })),
    appBlocks: stamp(source.appBlocks ?? []),
  }
}

function texts(source: LevelSource, locale: 'fr' | 'en') {
  return {
    title: pick(source.title, locale),
    summary: pick(source.summary, locale),
    done: pick(source.done, locale),
    steps: Object.fromEntries(
      source.tour.map((step) => [
        step.id,
        { text: pick(step.text, locale), ...(step.hint ? { hint: pick(step.hint, locale) } : {}) },
      ]),
    ),
    challenges: Object.fromEntries(
      source.challenges.map((challenge) => [
        challenge.id,
        { text: pick(challenge.text, locale), hint: pick(challenge.hint, locale) },
      ]),
    ),
  }
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/** Every file of `content/explore/`, by path relative to it. */
export function generate(): Map<string, string> {
  const files = new Map<string, string>()
  for (const app of APPS) {
    files.set(
      `${app.id}/app.json`,
      json({
        id: app.id,
        order: app.order,
        kind: app.kind,
        icon: app.icon,
        accent: app.accent,
        levels: LEVELS.length,
      }),
    )
    for (const locale of ['fr', 'en'] as const) {
      files.set(
        `${app.id}/${locale}.json`,
        json({ title: pick(app.title, locale), summary: pick(app.summary, locale) }),
      )
    }
    for (const n of LEVELS) {
      const source = app.level(n)
      const folder = `${app.id}/niveau-${n}`
      files.set(
        `${folder}/level.json`,
        json({
          level: n,
          recipe: recipe(app, source, n),
          tour: source.tour.map(({ text: _text, hint: _hint, ...step }) => step),
          challenges: source.challenges.map(
            ({ text: _text, hint: _hint, ...challenge }) => challenge,
          ),
        }),
      )
      for (const locale of ['fr', 'en'] as const) {
        files.set(`${folder}/${locale}.json`, json(texts(source, locale)))
      }
    }
  }
  return files
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [path, content] of generate()) {
    const file = join(CONTENT_DIR, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
  console.log(`content/explore: ${generate().size} files written (run pnpm format next)`)
}
