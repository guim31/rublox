import type { Messages } from '../types.ts'

/** Strings of the game mode (J7). */
export const game: {
  blocks: Messages['blocks']['game']
  runtime: Messages['runtime']['game']
  studio: Messages['studio']['game']
} = {
  blocks: {
    eventArg: 'A value received by the "when …" block that holds this one.',
    eventArgMisplaced: 'This block only works inside its own "when …" block.',
    eventArgEmpty: 'received value',
  },
  runtime: {
    tooManyClones: 'There are already {{count}} clones: {{name}} does not create a new one.',
  },
  studio: {},
}
