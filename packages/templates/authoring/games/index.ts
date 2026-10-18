import { BUZZY_BEE } from './buzzy-bee.ts'
import { ROBO_DASH } from './robo-dash.ts'
import type { GameSource } from './types.ts'
import { WIGGLE_SNAKE } from './wiggle-snake.ts'

/** The game templates (J10), in their order in the "New project" dialog. */
export const GAMES: readonly GameSource[] = [BUZZY_BEE, WIGGLE_SNAKE, ROBO_DASH]
