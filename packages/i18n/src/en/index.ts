import type { Messages } from '../types.ts'
import { blocks as baseBlocks } from './blocks.ts'
import { catalog } from './catalog.ts'
import { j6 } from './gallery.ts'
import { game } from './game.ts'
import { player } from './publish.ts'
import { runtime as baseRuntime } from './runtime.ts'
import { studio as baseStudio } from './studio.ts'

const studio = { ...baseStudio, game: game.studio, ...j6.studio }
const blocks = { ...baseBlocks, game: game.blocks }
const runtime = { ...baseRuntime, game: game.runtime, ...j6.runtime }

export const en: Messages = { studio, blocks, runtime, catalog, player }
