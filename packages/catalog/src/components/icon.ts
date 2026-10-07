import { defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'

/** A pictogram from the icon set (ICON_NAMES). */
export const Icon = defineComponent({
  type: 'Icon',
  category: 'base',
  icon: 'star',
  visible: true,
  container: false,
  junior: true,
  props: {
    icon: prop.icon({ default: 'star', group: 'content', junior: true, blocks: 'get-set' }),
    size: prop.number({
      default: 32,
      min: 8,
      max: 256,
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    color: prop.color({ default: '@primary', group: 'style', junior: true, blocks: 'get-set' }),
    strokeWidth: prop.number({ default: 2, min: 0.5, max: 4, step: 0.5, group: 'style' }),
    label: prop.string({ default: '', group: 'advanced' }),
  },
  events: { click: event({ junior: true }) },
  strings: {
    fr: {
      label: 'Icône',
      prefix: 'Icone',
      description: 'Un petit dessin : cœur, étoile, maison…',
      help: 'Une icône affiche un pictogramme choisi dans la liste. Change sa taille et sa couleur ; donne-lui une description si elle sert de bouton.',
      example: 'Quand Icone1 est cliquée, mettre Icone1.icône à "heart"',
      props: {
        icon: 'icône',
        size: 'taille',
        color: 'couleur',
        strokeWidth: 'épaisseur du trait',
        label: 'description',
      },
      events: { click: 'quand %1 est cliquée' },
      methods: {},
      enums: {},
    },
    en: {
      label: 'Icon',
      prefix: 'Icon',
      description: 'A small drawing: heart, star, house…',
      help: 'An icon shows a pictogram chosen from the list. Change its size and color; describe it when it works as a button.',
      example: 'When Icon1 is clicked, set Icon1.icon to "heart"',
      props: {
        icon: 'icon',
        size: 'size',
        color: 'color',
        strokeWidth: 'stroke width',
        label: 'description',
      },
      events: { click: 'when %1 is clicked' },
      methods: {},
      enums: {},
    },
  },
})
