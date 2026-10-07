import { blocks as baseBlocks } from './blocks.ts'
import { catalog } from './catalog.ts'
import { game } from './game.ts'
import { player } from './publish.ts'
import { runtime as baseRuntime } from './runtime.ts'
import { studio as baseStudio } from './studio.ts'

const studio = { ...baseStudio, game: game.studio }
const blocks = { ...baseBlocks, game: game.blocks }
const runtime = { ...baseRuntime, game: game.runtime }

export const fr = { studio, blocks, runtime, catalog, player }
