import type { Messages } from '../types.ts'
import { blocks as baseBlocks } from './blocks.ts'
import { game } from './game.ts'
import { runtime as baseRuntime } from './runtime.ts'
import { studio as baseStudio } from './studio.ts'

const studio = { ...baseStudio, game: game.studio }
const blocks = { ...baseBlocks, game: game.blocks }
const runtime = { ...baseRuntime, game: game.runtime }

export const en: Messages = { studio, blocks, runtime }
