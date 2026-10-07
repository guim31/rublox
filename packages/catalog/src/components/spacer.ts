import { defineComponent } from '../component.ts'

/** Empty room between components; with "grow" it pushes the next ones to the end. */
export const Spacer = defineComponent({
  type: 'Spacer',
  category: 'layout',
  icon: 'move-vertical',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { height: 24, width: 24 },
  omitCommon: ['background', 'borderWidth', 'borderColor', 'radius', 'shadow', 'opacity'],
  props: {},
  strings: {
    fr: {
      label: 'Espace',
      prefix: 'Espace',
      description: 'Un vide entre deux composants.',
      help: 'Un espace ne montre rien : il écarte les composants. Avec « grandir pour remplir », il pousse les suivants au bout de la ligne ou de l’écran.',
      example: 'Un espace qui grandit entre deux boutons les envoie de chaque côté.',
      props: {},
      events: {},
      methods: {},
      enums: {},
    },
    en: {
      label: 'Space',
      prefix: 'Space',
      description: 'Empty room between two components.',
      help: 'A space shows nothing: it keeps components apart. With "grow to fill", it pushes the next ones to the end of the row or the screen.',
      example: 'A growing space between two buttons sends them to each side.',
      props: {},
      events: {},
      methods: {},
      enums: {},
    },
  },
})
