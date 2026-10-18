import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type Block, stamp, type Text } from './dsl.ts'
import { GAMES } from './games/index.ts'
import type { ComponentSource, GameSource } from './games/types.ts'

/**
 * Writes the game templates (J10) into `content/templates/<id>/` (run `pnpm --filter
 * @rublox/templates content` after a change here, then `pnpm format`; `test/games.test.ts`
 * fails while the files are out of date):
 *
 * - `template.json`: the card (order, mode, icon, accent, category) and the recipe, with its
 *   assets (file, kind, size, hash);
 * - `fr.json`, `en.json`: the card's texts;
 * - `assets/*.svg`, `assets/*.wav`: the pictures and sounds, made by `games/`;
 * - `cover.svg`: the animated picture of the "New project" dialog.
 */

export const CONTENT_DIR = join(import.meta.dirname, '../../../content/templates')

const pick = (text: Text, locale: 'fr' | 'en') => (typeof text === 'string' ? text : text[locale])

function componentSpec(source: ComponentSource): Record<string, unknown> {
  return {
    key: source.key,
    type: source.type,
    ...(source.name ? { name: source.name } : {}),
    ...(source.props ? { props: source.props } : {}),
    ...(source.children ? { children: source.children.map(componentSpec) } : {}),
  }
}

const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const size = (bytes: Uint8Array | string) =>
  typeof bytes === 'string' ? Buffer.byteLength(bytes) : bytes.length

/** The files of one game: path (relative to its folder) → content. */
function gameFiles(game: GameSource): Map<string, string | Uint8Array> {
  const files = new Map<string, string | Uint8Array>()
  const assets: Record<string, unknown>[] = []
  for (const [key, art] of Object.entries(game.art)) {
    const file = `${key}.svg`
    files.set(`assets/${file}`, art.svg)
    assets.push({
      key,
      file,
      name: art.name,
      kind: 'image',
      mime: 'image/svg+xml',
      size: size(art.svg),
      sha256: sha256(art.svg),
    })
  }
  for (const [key, sound] of Object.entries(game.sounds)) {
    const file = `${key}.wav`
    files.set(`assets/${file}`, sound.wav)
    assets.push({
      key,
      file,
      name: sound.name,
      kind: 'sound',
      mime: 'audio/wav',
      size: size(sound.wav),
      sha256: sha256(sound.wav),
    })
  }
  const recipe = {
    name: game.title,
    description: game.description,
    mode: game.mode,
    ...(game.theme ? { theme: game.theme } : {}),
    navigation: 'stack',
    variables: game.variables.map((variable) => ({
      key: variable.key,
      name: variable.name,
      kind: variable.kind ?? 'app',
      ...(variable.initial !== undefined ? { initial: variable.initial } : {}),
    })),
    screens: [
      {
        key: game.screen.key,
        name: game.screen.name,
        ...(game.screen.props ? { props: game.screen.props } : {}),
        components: game.components.map(componentSpec),
        blocks: stamp(game.blocks as Block[]),
      },
    ],
    assets,
  }
  files.set(
    'template.json',
    json({
      id: game.id,
      order: game.order,
      mode: game.mode,
      icon: game.icon,
      accent: game.accent,
      category: 'games',
      cover: 'cover.svg',
      recipe,
    }),
  )
  for (const locale of ['fr', 'en'] as const) {
    files.set(
      `${locale}.json`,
      json({ title: pick(game.title, locale), description: pick(game.description, locale) }),
    )
  }
  files.set('cover.svg', game.cover)
  return files
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/** Every file of the game templates, by path relative to `content/templates/`. */
export function generate(): Map<string, string | Uint8Array> {
  const files = new Map<string, string | Uint8Array>()
  for (const game of GAMES) {
    for (const [path, content] of gameFiles(game)) files.set(`${game.id}/${path}`, content)
  }
  return files
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = generate()
  for (const game of GAMES)
    rmSync(join(CONTENT_DIR, game.id, 'assets'), { recursive: true, force: true })
  for (const [path, content] of files) {
    const file = join(CONTENT_DIR, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
  console.log(`content/templates: ${files.size} files written (run pnpm format next)`)
}
