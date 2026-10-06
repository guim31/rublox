import { defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'

export const Text = defineComponent({
  type: 'Text',
  category: 'base',
  icon: 'type',
  visible: true,
  container: false,
  junior: true,
  props: {
    text: prop.string({
      default: { fr: 'Texte', en: 'Text' },
      group: 'content',
      junior: true,
      blocks: 'get-set',
      multiline: true,
    }),
    fontSize: prop.number({
      default: 16,
      min: 8,
      max: 160,
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    color: prop.color({
      default: '@text',
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    bold: prop.boolean({
      default: false,
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    italic: prop.boolean({ default: false, group: 'style' }),
    align: prop.enum(['start', 'center', 'end'], {
      default: 'start',
      group: 'style',
      junior: true,
    }),
  },
  events: {
    click: event(),
  },
  strings: {
    fr: {
      label: 'Texte',
      prefix: 'Texte',
      description: 'Affiche des mots ou des nombres.',
      help: 'Un texte affiche un message. Tes blocs peuvent le changer pendant que l’appli tourne.',
      example: 'Mettre Texte1.texte à "Score : " + score',
      props: {
        text: 'texte',
        fontSize: 'taille',
        color: 'couleur',
        bold: 'gras',
        italic: 'italique',
        align: 'alignement du texte',
      },
      events: { click: 'quand %1 est cliqué' },
      methods: {},
      enums: {
        align: { start: 'À gauche', center: 'Centré', end: 'À droite' },
      },
    },
    en: {
      label: 'Text',
      prefix: 'Text',
      description: 'Shows words or numbers.',
      help: 'A text shows a message. Your blocks can change it while the app runs.',
      example: 'Set Text1.text to "Score: " + score',
      props: {
        text: 'text',
        fontSize: 'size',
        color: 'color',
        bold: 'bold',
        italic: 'italic',
        align: 'text alignment',
      },
      events: { click: 'when %1 is clicked' },
      methods: {},
      enums: { align: { start: 'Left', center: 'Centered', end: 'Right' } },
    },
  },
})
