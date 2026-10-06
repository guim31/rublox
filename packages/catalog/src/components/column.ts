import { containerProps } from '../common.ts'
import { containerStrings, defineComponent } from '../component.ts'

const container = containerStrings()

export const Column = defineComponent({
  type: 'Column',
  category: 'layout',
  icon: 'rows-3',
  visible: true,
  container: true,
  junior: true,
  props: containerProps('column'),
  strings: {
    fr: {
      label: 'Colonne',
      prefix: 'Colonne',
      description: 'Empile des composants les uns sous les autres.',
      help: 'Une colonne place ses composants les uns sous les autres, de haut en bas.',
      example: 'Mets un titre et un texte dans une colonne pour les grouper.',
      props: container.fr.props,
      events: {},
      methods: {},
      enums: container.fr.enums,
    },
    en: {
      label: 'Column',
      prefix: 'Column',
      description: 'Stacks components on top of each other.',
      help: 'A column places its components one below the other, from top to bottom.',
      example: 'Put a title and a text in a column to group them.',
      props: container.en.props,
      events: {},
      methods: {},
      enums: container.en.enums,
    },
  },
})
