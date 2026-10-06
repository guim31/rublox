import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

/** A simple list of texts. */
export const ListView = defineComponent({
  type: 'ListView',
  category: 'lists',
  icon: 'list',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { radius: 12, borderWidth: 1 },
  props: {
    items: prop.list({
      default: { fr: ['Pommes', 'Pain', 'Lait'], en: ['Apples', 'Bread', 'Milk'] },
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    fontSize: prop.number({ default: 16, min: 8, max: 64, group: 'style' }),
    textColor: prop.color({ default: '@text', group: 'style' }),
    dividers: prop.boolean({ default: true, group: 'style' }),
    selectedItem: prop.string({ default: '', group: 'content', state: true }),
    selectedIndex: prop.number({ default: 0, group: 'content', state: true }),
  },
  events: {
    itemClick: event({ junior: true, args: { item: arg('string'), index: arg('number') } }),
  },
  methods: {
    addItem: method({ junior: true, args: { item: arg('string') } }),
    removeItem: method({ args: { index: arg('number') } }),
    clear: method({ junior: true }),
  },
  strings: {
    fr: {
      label: 'Liste simple',
      prefix: 'Liste',
      description: 'Une liste de textes qu’on peut toucher.',
      help: 'Une liste simple affiche des textes les uns sous les autres. Ajoute ou retire des éléments avec ses blocs ; « quand un élément est touché » donne l’élément et sa position (à partir de 1).',
      example:
        'Quand Liste1 : un élément est touché, afficher le message valeur élément de l’événement',
      props: {
        items: 'éléments',
        fontSize: 'taille du texte',
        textColor: 'couleur du texte',
        dividers: 'traits entre les éléments',
        selectedItem: 'élément touché',
        selectedIndex: 'position touchée',
      },
      events: { itemClick: 'quand un élément de %1 est touché' },
      methods: {
        addItem: 'ajouter à %1 l’élément %2',
        removeItem: 'retirer de %1 l’élément n° %2',
        clear: 'vider %1',
      },
      enums: {},
      args: { item: 'élément', index: 'position' },
    },
    en: {
      label: 'List',
      prefix: 'List',
      description: 'A list of texts that can be tapped.',
      help: 'A list shows texts one below the other. Add or remove items with its blocks; "when an item is tapped" gives the item and its position (from 1).',
      example: 'When an item of List1 is tapped, show the message event value item',
      props: {
        items: 'items',
        fontSize: 'text size',
        textColor: 'text color',
        dividers: 'lines between items',
        selectedItem: 'tapped item',
        selectedIndex: 'tapped position',
      },
      events: { itemClick: 'when an item of %1 is tapped' },
      methods: {
        addItem: 'add to %1 the item %2',
        removeItem: 'remove from %1 item number %2',
        clear: 'clear %1',
      },
      enums: {},
      args: { item: 'item', index: 'position' },
    },
  },
})
