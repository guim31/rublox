import { BUZZY_BEE } from './buzzy-bee.ts'
import { CLOUD_HOPPER } from './cloud-hopper.ts'
import { GALAXY_PATROL } from './galaxy-patrol.ts'
import { PUCK_CLASH } from './puck-clash.ts'
import { ROBO_DASH } from './robo-dash.ts'
import type { GameSource } from './types.ts'
import { WIGGLE_SNAKE } from './wiggle-snake.ts'

/** The game templates (J10), in their order in the "New project" dialog. */
export const GAMES: readonly GameSource[] = [
  BUZZY_BEE,
  CLOUD_HOPPER,
  WIGGLE_SNAKE,
  ROBO_DASH,
  GALAXY_PATROL,
  PUCK_CLASH,
]
