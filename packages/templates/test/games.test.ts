import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCALES, type Locale } from '@rublox/schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTENT_DIR, generate } from '../authoring/generate.ts'
import { localize, TEMPLATES, type Template, templateProject } from '../src/index.ts'
import { BOTS } from './bots.ts'
import { play } from './play.ts'

const games = TEMPLATES.filter((template) => BOTS[template.id])

/** Variable names by key, in one language. */
function names(template: Template, locale: Locale): Record<string, string> {
  return Object.fromEntries(
    (template.recipe.variables ?? []).map((variable) => [
      variable.key ?? '',
      String(localize(variable.name, locale)),
    ]),
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('game templates', () => {
  it('are up to date with authoring/ (pnpm --filter @rublox/templates content)', () => {
    for (const [path, content] of generate()) {
      const file = join(CONTENT_DIR, path)
      if (path.endsWith('.json')) {
        expect(JSON.parse(readFileSync(file, 'utf8')), path).toEqual(JSON.parse(String(content)))
      } else {
        const actual = readFileSync(file)
        expect(Buffer.compare(actual, Buffer.from(content)), path).toBe(0)
      }
    }
  })

  it('has a bot for each new game', () => {
    expect(games.map((game) => game.id).sort()).toEqual(Object.keys(BOTS).sort())
  })

  for (const template of games) {
    for (const locale of LOCALES) {
      it(`${template.id} (${locale}): a good player scores, a lazy one loses, Enter starts again`, async () => {
        const bot = BOTS[template.id]!
        const doc = templateProject(template, { locale, mode: template.mode })
        const good = await play(doc, 60, bot.good, names(template, locale))
        expect(
          good.logs.filter((entry) => entry.level !== 'log'),
          'console',
        ).toEqual([])
        const best = Math.max(
          ...good.samples.map((sample) =>
            Number(sample[names(template, locale).score ?? 'score'] ?? 0),
          ),
        )
        expect(best, 'score of a good player').toBeGreaterThanOrEqual(bot.goodScore)
        good.engine.dispose()

        const lazy = await play(doc, bot.lazySeconds, bot.lazy, names(template, locale))
        expect(
          lazy.logs.filter((entry) => entry.level !== 'log'),
          'console',
        ).toEqual([])
        const states = lazy.samples.map((sample) => sample[names(template, locale).state ?? ''])
        const over = states.indexOf('over')
        expect(over, 'a lazy player loses').toBeGreaterThan(0)
        expect(states.slice(over), 'Enter starts again').toContain('play')
        lazy.engine.dispose()
      })
    }
  }
})
