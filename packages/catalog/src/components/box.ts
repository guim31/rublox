import { containerProps } from '../common.ts'
import { containerStrings, defineComponent } from '../component.ts'
import { event } from '../define.ts'

const container = containerStrings()

/** A card: a column with a background, rounded corners and a light shadow. */
export const Box = defineComponent({
  type: 'Box',
  category: 'layout',
  icon: 'square-dashed',
  visible: true,
  container: true,
  junior: true,
  commonDefaults: { padding: 16, radius: 16, background: '@surface', shadow: 'small' },
  props: containerProps('column'),
  events: { click: event() },
  strings: {
    fr: {
      label: 'Boîte',
      prefix: 'Boite',
      description: 'Une carte qui regroupe des composants sur un fond.',
      help: 'Une boîte est une colonne avec un fond, des coins arrondis et une ombre légère : parfaite pour présenter une fiche, une question ou un résultat.',
      example: 'Mets une image, un titre et un bouton dans une boîte pour faire une carte.',
      props: container.fr.props,
      events: { click: 'quand %1 est cliquée' },
      methods: {},
      enums: container.fr.enums,
    },
    en: {
      label: 'Box',
      prefix: 'Box',
      description: 'A card that groups components on a background.',
      help: 'A box is a column with a background, rounded corners and a light shadow: perfect to show a profile, a question or a result.',
      example: 'Put an image, a title and a button in a box to make a card.',
      props: container.en.props,
      events: { click: 'when %1 is clicked' },
      methods: {},
      enums: container.en.enums,
    },
  },
})
