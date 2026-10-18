import type { games as fr } from '../fr/games.ts'

/** Strings of J10 (the game templates). */
export const games: typeof fr = {
  studio: {
    newProject: {
      categoriesLabel: 'Template categories',
      categories: {
        all: 'All',
        games: 'Games',
        fun: 'For fun',
        tools: 'Everyday helpers',
        learn: 'To learn',
      },
      blankSection: 'To begin',
      modeHint: {
        junior: 'For beginners, in Junior mode',
        studio: 'To go further, in Studio mode',
      },
      preparing: 'Getting the pictures and sounds ready…',
      filesFailed: 'The pictures and sounds of this template could not be loaded.',
    },
  },
}
