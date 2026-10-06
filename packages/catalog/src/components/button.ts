import { defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'

export const Button = defineComponent({
  type: 'Button',
  category: 'base',
  icon: 'square-mouse-pointer',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { radius: 12, padding: [12, 20, 12, 20] },
  props: {
    text: prop.string({
      default: { fr: 'Bouton', en: 'Button' },
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    variant: prop.enum(['filled', 'outline', 'ghost'], {
      default: 'filled',
      group: 'style',
      junior: true,
    }),
    color: prop.color({
      default: '@primary',
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    textColor: prop.color({ default: '', group: 'style', blocks: 'get-set' }),
    fontSize: prop.number({
      default: 16,
      min: 8,
      max: 96,
      group: 'style',
      blocks: 'get-set',
    }),
    disabled: prop.boolean({
      default: false,
      group: 'advanced',
      blocks: 'get-set',
    }),
  },
  events: {
    click: event({ junior: true }),
    longPress: event(),
  },
  strings: {
    fr: {
      label: 'Bouton',
      prefix: 'Bouton',
      description: 'Un bouton sur lequel on appuie.',
      help: 'Un bouton déclenche une action quand on appuie dessus : utilise le bloc « quand Bouton1 est cliqué ».',
      example: 'Quand Bouton1 est cliqué, mettre Texte1.texte à "Bonjour"',
      props: {
        text: 'texte',
        variant: 'style',
        color: 'couleur',
        textColor: 'couleur du texte',
        fontSize: 'taille du texte',
        disabled: 'désactivé',
      },
      events: {
        click: 'quand %1 est cliqué',
        longPress: 'quand %1 est appuyé longtemps',
      },
      methods: {},
      enums: {
        variant: { filled: 'Plein', outline: 'Contour', ghost: 'Discret' },
      },
    },
    en: {
      label: 'Button',
      prefix: 'Button',
      description: 'Something to tap.',
      help: 'A button runs an action when tapped: use the "when Button1 is clicked" block.',
      example: 'When Button1 is clicked, set Text1.text to "Hello"',
      props: {
        text: 'text',
        variant: 'style',
        color: 'color',
        textColor: 'text color',
        fontSize: 'text size',
        disabled: 'disabled',
      },
      events: {
        click: 'when %1 is clicked',
        longPress: 'when %1 is long pressed',
      },
      methods: {},
      enums: {
        variant: { filled: 'Filled', outline: 'Outline', ghost: 'Ghost' },
      },
    },
  },
})
