import { blocks as baseBlocks } from './blocks.ts'
import { catalog } from './catalog.ts'
import { collab } from './collab.ts'
import { data } from './data.ts'
import { explore } from './explore.ts'
import { j6 } from './gallery.ts'
import { game } from './game.ts'
import { player } from './publish.ts'
import { runtime as baseRuntime } from './runtime.ts'
import { studio as baseStudio } from './studio.ts'

const studio = {
  ...baseStudio,
  blockSheets: { ...baseStudio.blockSheets, ...data.blockSheets },
  game: game.studio,
  data: data.studio,
  ...j6.studio,
  collab,
  learn: { ...baseStudio.learn, badges: { ...baseStudio.learn.badges, ...explore.badges } },
  explore: explore.studio,
}
const blocks = { ...baseBlocks, game: game.blocks, data: data.blocks }
const runtime = {
  ...baseRuntime,
  friendly: { ...baseRuntime.friendly, ...data.runtime.friendly },
  game: game.runtime,
  data: data.runtime.data,
  ...j6.runtime,
}

export const fr = { studio, blocks, runtime, catalog, player }
