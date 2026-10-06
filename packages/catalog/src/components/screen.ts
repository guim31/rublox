import { containerProps } from '../common.ts'
import { containerStrings, defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'

const container = containerStrings()

/** Root of every screen: a scrolling column. Not in the palette. */
export const Screen = defineComponent({
  type: 'Screen',
  category: 'layout',
  icon: 'smartphone',
  visible: true,
  container: true,
  junior: true,
  palette: false,
  omitCommon: [
    'visible',
    'width',
    'height',
    'grow',
    'alignSelf',
    'margin',
    'borderWidth',
    'borderColor',
    'radius',
    'shadow',
    'opacity',
  ],
  commonDefaults: { padding: 16, background: '@background' },
  props: {
    title: prop.string({ default: '', group: 'content', junior: true, blocks: 'get-set' }),
    ...containerProps('column'),
    scroll: prop.boolean({ default: true, group: 'advanced' }),
  },
  events: {
    open: event({ junior: true }),
  },
  strings: {
    fr: {
      label: 'Écran',
      prefix: 'Ecran',
      description: 'Une page de ton appli.',
      help: "L'écran contient tous les composants d'une page. Il défile si son contenu dépasse.",
      example: 'Quand Accueil s\'ouvre, mettre Texte1.texte à "Salut !"',
      props: { ...container.fr.props, title: 'titre', scroll: 'défilement' },
      events: { open: "quand %1 s'ouvre" },
      methods: {},
      enums: container.fr.enums,
    },
    en: {
      label: 'Screen',
      prefix: 'Screen',
      description: 'A page of your app.',
      help: 'The screen holds every component of a page. It scrolls when its content is too tall.',
      example: 'When Home opens, set Text1.text to "Hi!"',
      props: { ...container.en.props, title: 'title', scroll: 'scrolling' },
      events: { open: 'when %1 opens' },
      methods: {},
      enums: container.en.enums,
    },
  },
})
