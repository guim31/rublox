import { defineComponent } from '../component.ts'
import { arg, event, prop } from '../define.ts'

export const Switch = defineComponent({
  type: 'Switch',
  category: 'input',
  icon: 'toggle-right',
  visible: true,
  container: false,
  junior: true,
  props: {
    text: prop.string({
      default: { fr: 'Interrupteur', en: 'Switch' },
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    on: prop.boolean({ default: false, group: 'content', junior: true, blocks: 'get-set' }),
    color: prop.color({ default: '@primary', group: 'style', junior: true }),
    fontSize: prop.number({ default: 16, min: 8, max: 64, group: 'style' }),
    disabled: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
  },
  events: { change: event({ junior: true, args: { on: arg('boolean') } }) },
  strings: {
    fr: {
      label: 'Interrupteur',
      prefix: 'Interrupteur',
      description: 'Un bouton qu’on allume ou éteint.',
      help: 'Un interrupteur est allumé (vrai) ou éteint (faux). Pratique pour un réglage : son, mode nuit…',
      example: 'Quand Interrupteur1 change, mettre Son1.volume à 0',
      props: {
        text: 'texte',
        on: 'allumé',
        color: 'couleur',
        fontSize: 'taille du texte',
        disabled: 'désactivé',
      },
      events: { change: 'quand %1 change' },
      methods: {},
      enums: {},
      args: { on: 'allumé' },
    },
    en: {
      label: 'Switch',
      prefix: 'Switch',
      description: 'A toggle to turn on or off.',
      help: 'A switch is on (true) or off (false). Handy for a setting: sound, night mode…',
      example: 'When Switch1 changes, set Sound1.volume to 0',
      props: {
        text: 'text',
        on: 'on',
        color: 'color',
        fontSize: 'text size',
        disabled: 'disabled',
      },
      events: { change: 'when %1 changes' },
      methods: {},
      enums: {},
      args: { on: 'on' },
    },
  },
})
