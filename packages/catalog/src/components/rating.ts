import { defineComponent } from '../component.ts'
import { arg, event, prop } from '../define.ts'

export const Rating = defineComponent({
  type: 'Rating',
  category: 'input',
  icon: 'star-half',
  visible: true,
  container: false,
  junior: true,
  props: {
    value: prop.number({
      default: 0,
      min: 0,
      max: 10,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    max: prop.number({ default: 5, min: 1, max: 10, group: 'content', junior: true }),
    size: prop.number({ default: 32, min: 12, max: 96, group: 'style' }),
    color: prop.color({ default: '#f5b400', group: 'style', junior: true }),
    readOnly: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
  },
  events: { change: event({ junior: true, args: { value: arg('number') } }) },
  strings: {
    fr: {
      label: 'Note en étoiles',
      prefix: 'Note',
      description: 'Donner une note de 1 à 5 étoiles.',
      help: 'Une note en étoiles se touche pour choisir combien d’étoiles donner. Sa valeur va de 0 (aucune) au maximum.',
      example: 'Quand Note1 change, si valeur de Note1 = 5, afficher le message "Merci !"',
      props: {
        value: 'note',
        max: 'nombre d’étoiles',
        size: 'taille',
        color: 'couleur',
        readOnly: 'lecture seule',
      },
      events: { change: 'quand %1 change' },
      methods: {},
      enums: {},
      args: { value: 'valeur' },
    },
    en: {
      label: 'Star rating',
      prefix: 'Rating',
      description: 'Give a mark from 1 to 5 stars.',
      help: 'A star rating is tapped to choose how many stars to give. Its value goes from 0 (none) to the maximum.',
      example: 'When Rating1 changes, if value of Rating1 = 5, show the message "Thanks!"',
      props: {
        value: 'rating',
        max: 'number of stars',
        size: 'size',
        color: 'color',
        readOnly: 'read only',
      },
      events: { change: 'when %1 changes' },
      methods: {},
      enums: {},
      args: { value: 'value' },
    },
  },
})
