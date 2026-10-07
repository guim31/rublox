import { defineComponent } from '../component.ts'
import { prop } from '../define.ts'

export const Spinner = defineComponent({
  type: 'Spinner',
  category: 'display',
  icon: 'loader-circle',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { alignSelf: 'center' },
  props: {
    size: prop.number({ default: 36, min: 12, max: 160, group: 'style', junior: true }),
    color: prop.color({ default: '@primary', group: 'style', junior: true, blocks: 'get-set' }),
    spinning: prop.boolean({ default: true, group: 'content', junior: true, blocks: 'get-set' }),
  },
  strings: {
    fr: {
      label: 'Indicateur de chargement',
      prefix: 'Chargement',
      description: 'Un rond qui tourne pendant une attente.',
      help: 'Un indicateur de chargement tourne pour faire patienter. Cache-le (visible à faux) quand l’attente est finie.',
      example: 'Mettre Chargement1.visible à faux',
      props: { size: 'taille', color: 'couleur', spinning: 'tourne' },
      events: {},
      methods: {},
      enums: {},
    },
    en: {
      label: 'Loading indicator',
      prefix: 'Loading',
      description: 'A circle that spins while waiting.',
      help: 'A loading indicator spins to say "please wait". Hide it (visible to false) when the wait is over.',
      example: 'Set Loading1.visible to false',
      props: { size: 'size', color: 'color', spinning: 'spinning' },
      events: {},
      methods: {},
      enums: {},
    },
  },
})
