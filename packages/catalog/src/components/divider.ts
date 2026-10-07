import { defineComponent } from '../component.ts'
import { prop } from '../define.ts'

/** A thin line between parts of a screen. */
export const Divider = defineComponent({
  type: 'Divider',
  category: 'layout',
  icon: 'minus',
  visible: true,
  container: false,
  junior: true,
  omitCommon: ['background', 'borderWidth', 'borderColor', 'radius', 'shadow', 'padding'],
  commonDefaults: { margin: [4, 0, 4, 0] },
  props: {
    color: prop.color({ default: '@border', group: 'style', junior: true, blocks: 'get-set' }),
    thickness: prop.number({ default: 1, min: 1, max: 16, group: 'style', junior: true }),
    vertical: prop.boolean({ default: false, group: 'layout' }),
  },
  strings: {
    fr: {
      label: 'Séparateur',
      prefix: 'Separateur',
      description: 'Un trait qui sépare deux parties.',
      help: 'Un séparateur trace un trait fin, horizontal ou vertical (dans une ligne), pour séparer deux parties d’un écran.',
      example: 'Un séparateur entre le titre et la liste.',
      props: { color: 'couleur', thickness: 'épaisseur', vertical: 'vertical' },
      events: {},
      methods: {},
      enums: {},
    },
    en: {
      label: 'Divider',
      prefix: 'Divider',
      description: 'A line between two parts.',
      help: 'A divider draws a thin line, horizontal or vertical (in a row), to separate two parts of a screen.',
      example: 'A divider between the title and the list.',
      props: { color: 'color', thickness: 'thickness', vertical: 'vertical' },
      events: {},
      methods: {},
      enums: {},
    },
  },
})
