import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

const POINT_FIELDS = { label: 'string', value: 'string' } as const

/** A chart (SPEC § 4.5): bars, lines or a pie, fed by a list or a table. */
export const Chart = defineComponent({
  type: 'Chart',
  category: 'maps',
  icon: 'chart-column',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { width: 'fill', height: 240 },
  props: {
    chartType: prop.enum(['bar', 'line', 'pie'], {
      default: 'bar',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    title: prop.string({ default: '', group: 'content', junior: true, blocks: 'get-set' }),
    points: prop.list({
      default: {
        fr: [
          { label: 'Lun', value: '3' },
          { label: 'Mar', value: '5' },
          { label: 'Mer', value: '2' },
          { label: 'Jeu', value: '6' },
        ],
        en: [
          { label: 'Mon', value: '3' },
          { label: 'Tue', value: '5' },
          { label: 'Wed', value: '2' },
          { label: 'Thu', value: '6' },
        ],
      },
      itemFields: POINT_FIELDS,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    source: prop.binding({ fields: POINT_FIELDS, group: 'content' }),
    color: prop.color({ default: '@primary', group: 'style', junior: true, blocks: 'get-set' }),
    showValues: prop.boolean({ default: true, group: 'style', blocks: 'get-set' }),
  },
  events: {
    pointClick: event({
      junior: true,
      args: { index: arg('number'), label: arg('string'), value: arg('number') },
    }),
  },
  methods: {
    addPoint: method({
      junior: true,
      args: { label: arg('string'), value: arg('number', { default: 4 }) },
    }),
    clear: method(),
  },
  strings: {
    fr: {
      label: 'Graphique',
      prefix: 'Graphique',
      description: 'Des barres, une courbe ou un camembert.',
      help: 'Un graphique montre des nombres : en barres, en courbe ou en secteurs (camembert). Chaque point a une étiquette et une valeur. Remplis-le dans l’inspecteur, avec « ajouter un point », ou branche-le sur une table (une colonne pour les étiquettes, une pour les valeurs).',
      example: 'Quand Bouton1 est cliqué, ajouter à Graphique1 le point étiquette "Ven" valeur 4',
      props: {
        chartType: 'type',
        title: 'titre',
        points: 'points',
        source: 'source (table)',
        color: 'couleur',
        showValues: 'afficher les valeurs',
      },
      events: { pointClick: 'quand un point de %1 est touché' },
      methods: {
        addPoint: 'ajouter à %1 le point étiquette %2 valeur %3',
        clear: 'vider %1',
      },
      enums: { chartType: { bar: 'Barres', line: 'Courbe', pie: 'Secteurs' } },
      args: { index: 'position', label: 'étiquette', value: 'valeur' },
    },
    en: {
      label: 'Chart',
      prefix: 'Chart',
      description: 'Bars, a line or a pie.',
      help: 'A chart shows numbers: as bars, a line or a pie. Each point has a label and a value. Fill it in the inspector, with “add a point”, or bind it to a table (one column for the labels, one for the values).',
      example: 'When Button1 is clicked, add to Chart1 the point label "Fri" value 4',
      props: {
        chartType: 'type',
        title: 'title',
        points: 'points',
        source: 'source (table)',
        color: 'color',
        showValues: 'show the values',
      },
      events: { pointClick: 'when a point of %1 is tapped' },
      methods: {
        addPoint: 'add to %1 the point label %2 value %3',
        clear: 'clear %1',
      },
      enums: { chartType: { bar: 'Bars', line: 'Line', pie: 'Pie' } },
      args: { index: 'position', label: 'label', value: 'value' },
    },
  },
})
