import { defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'

export const Image = defineComponent({
  type: 'Image',
  category: 'base',
  icon: 'image',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { height: 180, radius: 12 },
  props: {
    src: prop.asset({
      default: '',
      assetKind: 'image',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    fit: prop.enum(['cover', 'contain', 'fill'], {
      default: 'cover',
      group: 'style',
      junior: true,
    }),
    alt: prop.string({ default: '', group: 'content' }),
  },
  events: {
    click: event({ junior: true }),
  },
  strings: {
    fr: {
      label: 'Image',
      prefix: 'Image',
      description: 'Affiche une photo ou un dessin.',
      help: 'Une image affiche une photo ou un dessin de ton projet, ou une adresse https:. Pense à la décrire pour les personnes qui ne la voient pas.',
      example: 'Quand Image1 est cliquée, mettre Texte1.texte à "Miaou !"',
      props: { src: 'image', fit: 'ajustement', alt: 'description' },
      events: { click: 'quand %1 est cliquée' },
      methods: {},
      enums: { fit: { cover: 'Remplir', contain: 'Tout montrer', fill: 'Étirer' } },
    },
    en: {
      label: 'Image',
      prefix: 'Image',
      description: 'Shows a photo or a drawing.',
      help: 'An image shows a photo or a drawing from your project, or an https: address. Describe it for people who cannot see it.',
      example: 'When Image1 is clicked, set Text1.text to "Meow!"',
      props: { src: 'image', fit: 'fit', alt: 'description' },
      events: { click: 'when %1 is clicked' },
      methods: {},
      enums: { fit: { cover: 'Cover', contain: 'Show all', fill: 'Stretch' } },
    },
  },
})
