import type { Messages } from '../types.ts'

/** Strings of the game mode (J7). */
export const game: {
  blocks: Messages['blocks']['game']
  runtime: Messages['runtime']['game']
  studio: Messages['studio']['game']
} = {
  blocks: {
    eventValue: '%1 of the event',
    eventValueTooltip: 'A value the event brings (elapsed time, the other sprite…).',
    eventValueOutside: 'This block only works inside its own "when …" block.',
  },
  runtime: {
    tooManyClones: 'There are already {{count}} clones: {{name}} does not create a new one.',
  },
  studio: {
    demos: {
      catchGame: 'Open the game demo: Catch the fruit',
      bouncing: 'Open the game demo: 50 bouncing sprites',
    },
    demoCreating: 'Getting the demo ready…',
    demoFailed: 'The demo could not be created. Try again.',
    costumes: {
      title: 'Costumes',
      costume: 'Costume {{n}}',
      empty: 'No costume: add an emoji or a picture.',
      add: 'Add a costume',
      emoji: 'Emoji or letter',
      emojiPlaceholder: 'e.g. 🚀',
      addEmoji: 'Add',
      suggestions: 'Ideas',
      images: 'Project pictures',
      upload: 'Upload a picture',
      remove: 'Remove costume {{n}}',
      moveEarlier: 'Move costume {{n}} earlier',
    },
    canvas: {
      move: 'Move: drag, or arrow keys (Shift: 10 at a time)',
      resize: 'Resize',
      rotate: 'Rotate (Shift: by 15°)',
      sceneOnly: 'Sprites, scene texts and joysticks go in a game scene.',
      notInScene: 'A game scene only takes sprites, scene texts and joysticks.',
      keyboardHelp: 'Arrows: move. Alt + arrows: size. R or Shift + R: rotate. Escape: deselect.',
    },
  },
}
