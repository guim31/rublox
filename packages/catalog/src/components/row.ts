import { containerProps } from '../common.ts'
import { containerStrings, defineComponent } from '../component.ts'

const container = containerStrings()

export const Row = defineComponent({
  type: 'Row',
  category: 'layout',
  icon: 'columns-3',
  visible: true,
  container: true,
  junior: true,
  props: containerProps('row'),
  strings: {
    fr: {
      label: 'Ligne',
      prefix: 'Ligne',
      description: 'Range des composants côte à côte.',
      help: 'Une ligne place ses composants les uns à côté des autres, de gauche à droite.',
      example: 'Mets deux boutons dans une ligne pour les avoir côte à côte.',
      props: container.fr.props,
      events: {},
      methods: {},
      enums: container.fr.enums,
    },
    en: {
      label: 'Row',
      prefix: 'Row',
      description: 'Puts components side by side.',
      help: 'A row places its components next to each other, from left to right.',
      example: 'Put two buttons in a row to have them side by side.',
      props: container.en.props,
      events: {},
      methods: {},
      enums: container.en.enums,
    },
  },
})
