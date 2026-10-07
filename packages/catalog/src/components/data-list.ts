import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

const ITEM_FIELDS = { image: 'asset', title: 'string', subtitle: 'string' } as const

/** Drawn from a table of the Data tab (J5): image, title and subtitle columns. */
const source = () => prop.binding({ fields: ITEM_FIELDS, group: 'content', junior: true })

/** Rows with an image, a title, a subtitle and an optional button (template of SPEC § 4.4). */
export const DataList = defineComponent({
  type: 'DataList',
  category: 'lists',
  icon: 'list-video',
  visible: true,
  container: false,
  junior: false,
  props: {
    items: prop.list({
      default: {
        fr: [
          { image: '', title: 'Chat', subtitle: 'Miaou' },
          { image: '', title: 'Chien', subtitle: 'Ouaf' },
        ],
        en: [
          { image: '', title: 'Cat', subtitle: 'Meow' },
          { image: '', title: 'Dog', subtitle: 'Woof' },
        ],
      },
      itemFields: ITEM_FIELDS,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    source: source(),
    buttonText: prop.string({ default: '', group: 'content', blocks: 'get-set' }),
    imageShape: prop.enum(['square', 'round', 'none'], { default: 'square', group: 'style' }),
    gap: prop.number({ default: 8, min: 0, max: 48, group: 'layout' }),
    cardColor: prop.color({ default: '@surface', group: 'style' }),
    selectedIndex: prop.number({ default: 0, group: 'content', state: true }),
  },
  events: {
    itemClick: event({
      junior: true,
      args: {
        index: arg('number'),
        title: arg('string'),
        subtitle: arg('string'),
        row: arg('any'),
      },
    }),
    buttonClick: event({ args: { index: arg('number'), title: arg('string'), row: arg('any') } }),
  },
  methods: {
    addItem: method({
      args: { title: arg('string'), subtitle: arg('string'), image: arg('asset') },
    }),
    removeItem: method({ args: { index: arg('number') } }),
    clear: method(),
  },
  strings: {
    fr: {
      label: 'Liste de données',
      prefix: 'ListeDonnees',
      description: 'Des fiches avec image, titre et sous-titre.',
      help: 'Une liste de données affiche des fiches : une image, un titre, un sous-titre et, si tu lui donnes un texte, un bouton. Remplis-la dans l’inspecteur ou avec ses blocs, ou branche-la sur une table de l’onglet Données (« source ») : elle montre alors les lignes de la table, et se met à jour toute seule.',
      example:
        'Quand un élément de ListeDonnees1 est touché, afficher le message valeur titre de l’événement',
      props: {
        items: 'éléments',
        source: 'source (table)',
        buttonText: 'texte du bouton',
        imageShape: 'forme des images',
        gap: 'écart',
        cardColor: 'couleur des fiches',
        selectedIndex: 'position touchée',
      },
      events: {
        itemClick: 'quand un élément de %1 est touché',
        buttonClick: 'quand le bouton d’un élément de %1 est touché',
      },
      methods: {
        addItem: 'ajouter à %1 titre %2 sous-titre %3 image %4',
        removeItem: 'retirer de %1 l’élément n° %2',
        clear: 'vider %1',
      },
      enums: { imageShape: { square: 'Carrée', round: 'Ronde', none: 'Sans image' } },
      args: { index: 'position', title: 'titre', subtitle: 'sous-titre', row: 'ligne' },
    },
    en: {
      label: 'Data list',
      prefix: 'DataList',
      description: 'Cards with an image, a title and a subtitle.',
      help: 'A data list shows cards: an image, a title, a subtitle and, when you give it a text, a button. Fill it in the inspector or with its blocks, or bind it to a table of the Data tab (“source”): it then shows the rows of the table, and updates by itself.',
      example: 'When an item of DataList1 is tapped, show the message event value title',
      props: {
        items: 'items',
        source: 'source (table)',
        buttonText: 'button text',
        imageShape: 'image shape',
        gap: 'gap',
        cardColor: 'card color',
        selectedIndex: 'tapped position',
      },
      events: {
        itemClick: 'when an item of %1 is tapped',
        buttonClick: 'when the button of an item of %1 is tapped',
      },
      methods: {
        addItem: 'add to %1 title %2 subtitle %3 image %4',
        removeItem: 'remove from %1 item number %2',
        clear: 'clear %1',
      },
      enums: { imageShape: { square: 'Square', round: 'Round', none: 'No image' } },
      args: { index: 'position', title: 'title', subtitle: 'subtitle', row: 'row' },
    },
  },
})

/** The same items in a grid of tiles (image and title). */
export const DataGrid = defineComponent({
  type: 'DataGrid',
  category: 'lists',
  icon: 'layout-grid',
  visible: true,
  container: false,
  junior: false,
  props: {
    items: prop.list({
      default: {
        fr: [
          { image: '', title: 'Soleil', subtitle: '' },
          { image: '', title: 'Lune', subtitle: '' },
          { image: '', title: 'Étoile', subtitle: '' },
          { image: '', title: 'Nuage', subtitle: '' },
        ],
        en: [
          { image: '', title: 'Sun', subtitle: '' },
          { image: '', title: 'Moon', subtitle: '' },
          { image: '', title: 'Star', subtitle: '' },
          { image: '', title: 'Cloud', subtitle: '' },
        ],
      },
      itemFields: ITEM_FIELDS,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    source: source(),
    columns: prop.number({
      default: 2,
      min: 1,
      max: 6,
      group: 'layout',
      junior: true,
      blocks: 'get-set',
    }),
    gap: prop.number({ default: 8, min: 0, max: 48, group: 'layout' }),
    cardColor: prop.color({ default: '@surface', group: 'style' }),
    selectedIndex: prop.number({ default: 0, group: 'content', state: true }),
  },
  events: {
    itemClick: event({
      junior: true,
      args: { index: arg('number'), title: arg('string'), row: arg('any') },
    }),
  },
  methods: {
    addItem: method({ args: { title: arg('string'), image: arg('asset') } }),
    removeItem: method({ args: { index: arg('number') } }),
    clear: method(),
  },
  strings: {
    fr: {
      label: 'Grille de données',
      prefix: 'GrilleDonnees',
      description: 'Des vignettes avec image et titre, en grille.',
      help: 'Une grille de données affiche des vignettes (image et titre) sur plusieurs colonnes : une galerie, un menu d’emojis, des cartes à jouer. Elle peut aussi se brancher sur une table de l’onglet Données (« source »).',
      example:
        'Quand un élément de GrilleDonnees1 est touché, afficher le message valeur titre de l’événement',
      props: {
        items: 'éléments',
        source: 'source (table)',
        columns: 'colonnes',
        gap: 'écart',
        cardColor: 'couleur des vignettes',
        selectedIndex: 'position touchée',
      },
      events: { itemClick: 'quand un élément de %1 est touché' },
      methods: {
        addItem: 'ajouter à %1 titre %2 image %3',
        removeItem: 'retirer de %1 l’élément n° %2',
        clear: 'vider %1',
      },
      enums: {},
      args: { index: 'position', title: 'titre', row: 'ligne' },
    },
    en: {
      label: 'Data grid',
      prefix: 'DataGrid',
      description: 'Tiles with an image and a title, in a grid.',
      help: 'A data grid shows tiles (image and title) on several columns: a gallery, an emoji menu, playing cards. It can also be bound to a table of the Data tab (“source”).',
      example: 'When an item of DataGrid1 is tapped, show the message event value title',
      props: {
        items: 'items',
        source: 'source (table)',
        columns: 'columns',
        gap: 'gap',
        cardColor: 'tile color',
        selectedIndex: 'tapped position',
      },
      events: { itemClick: 'when an item of %1 is tapped' },
      methods: {
        addItem: 'add to %1 title %2 image %3',
        removeItem: 'remove from %1 item number %2',
        clear: 'clear %1',
      },
      enums: {},
      args: { index: 'position', title: 'title', row: 'row' },
    },
  },
})
