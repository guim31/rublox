import { defineComponent } from '../component.ts'
import { prop } from '../define.ts'

/** Children in a grid of equal columns, filled row by row. */
export const Grid = defineComponent({
  type: 'Grid',
  category: 'layout',
  icon: 'layout-grid',
  visible: true,
  container: true,
  junior: false,
  props: {
    columns: prop.number({
      default: 2,
      min: 1,
      max: 6,
      group: 'layout',
      junior: true,
      blocks: 'get-set',
    }),
    gap: prop.number({ default: 12, min: 0, max: 200, group: 'layout', junior: true }),
    alignItems: prop.enum(['start', 'center', 'end', 'stretch'], {
      default: 'stretch',
      group: 'layout',
    }),
  },
  strings: {
    fr: {
      label: 'Grille',
      prefix: 'Grille',
      description: 'Range des composants en colonnes égales.',
      help: 'Une grille place ses composants dans des colonnes de même largeur, ligne après ligne. Choisis le nombre de colonnes.',
      example: 'Une grille de 3 colonnes avec 9 boutons fait un pavé de morpion.',
      props: { columns: 'colonnes', gap: 'écart', alignItems: 'alignement' },
      events: {},
      methods: {},
      enums: {
        alignItems: { start: 'En haut', center: 'Au centre', end: 'En bas', stretch: 'Étirer' },
      },
    },
    en: {
      label: 'Grid',
      prefix: 'Grid',
      description: 'Arranges components in equal columns.',
      help: 'A grid places its components in columns of the same width, row after row. Choose the number of columns.',
      example: 'A 3-column grid with 9 buttons makes a tic-tac-toe board.',
      props: { columns: 'columns', gap: 'gap', alignItems: 'alignment' },
      events: {},
      methods: {},
      enums: {
        alignItems: { start: 'Top', center: 'Center', end: 'Bottom', stretch: 'Stretch' },
      },
    },
  },
})
