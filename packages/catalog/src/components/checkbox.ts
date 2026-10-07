import { defineComponent } from '../component.ts'
import { arg, event, prop } from '../define.ts'

export const Checkbox = defineComponent({
  type: 'Checkbox',
  category: 'input',
  icon: 'square-check',
  visible: true,
  container: false,
  junior: true,
  props: {
    text: prop.string({
      default: { fr: 'Case à cocher', en: 'Checkbox' },
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    checked: prop.boolean({ default: false, group: 'content', junior: true, blocks: 'get-set' }),
    color: prop.color({ default: '@primary', group: 'style', junior: true }),
    fontSize: prop.number({ default: 16, min: 8, max: 64, group: 'style' }),
    disabled: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
  },
  events: { change: event({ junior: true, args: { checked: arg('boolean') } }) },
  strings: {
    fr: {
      label: 'Case à cocher',
      prefix: 'Case',
      description: 'Une case qu’on coche ou décoche.',
      help: 'Une case à cocher vaut vrai quand elle est cochée. Lis-la avec « coché de Case1 », ou réagis avec « quand Case1 change ».',
      example: 'Quand Case1 change, si coché de Case1, afficher le message "Merci !"',
      props: {
        text: 'texte',
        checked: 'coché',
        color: 'couleur',
        fontSize: 'taille du texte',
        disabled: 'désactivé',
      },
      events: { change: 'quand %1 change' },
      methods: {},
      enums: {},
      args: { checked: 'coché' },
    },
    en: {
      label: 'Checkbox',
      prefix: 'Checkbox',
      description: 'A box to tick or untick.',
      help: 'A checkbox is true when it is ticked. Read it with "checked of Checkbox1", or react with "when Checkbox1 changes".',
      example: 'When Checkbox1 changes, if checked of Checkbox1, show the message "Thanks!"',
      props: {
        text: 'text',
        checked: 'checked',
        color: 'color',
        fontSize: 'text size',
        disabled: 'disabled',
      },
      events: { change: 'when %1 changes' },
      methods: {},
      enums: {},
      args: { checked: 'checked' },
    },
  },
})
