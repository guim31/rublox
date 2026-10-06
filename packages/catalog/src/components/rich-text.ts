import { defineComponent } from '../component.ts'
import { prop } from '../define.ts'

export const RichText = defineComponent({
  type: 'RichText',
  category: 'display',
  icon: 'file-text',
  visible: true,
  container: false,
  junior: false,
  props: {
    text: prop.string({
      default: {
        fr: '# Titre\nDu texte en **gras**, en *italique* et une liste :\n- un\n- deux',
        en: '# Title\nSome **bold** and *italic* text, and a list:\n- one\n- two',
      },
      group: 'content',
      junior: true,
      blocks: 'get-set',
      multiline: true,
    }),
    fontSize: prop.number({ default: 16, min: 8, max: 64, group: 'style', blocks: 'get-set' }),
    color: prop.color({ default: '@text', group: 'style' }),
    linkColor: prop.color({ default: '@primary', group: 'style' }),
  },
  strings: {
    fr: {
      label: 'Texte riche',
      prefix: 'TexteRiche',
      description: 'Du texte mis en forme : titres, gras, listes, liens.',
      help: 'Un texte riche se met en forme avec Markdown : # pour un titre, **gras**, *italique*, - pour une liste, [texte](https://…) pour un lien.',
      example: 'Mettre TexteRiche1.texte à "**Bravo** " + nom',
      props: {
        text: 'texte',
        fontSize: 'taille du texte',
        color: 'couleur',
        linkColor: 'couleur des liens',
      },
      events: {},
      methods: {},
      enums: {},
    },
    en: {
      label: 'Rich text',
      prefix: 'RichText',
      description: 'Formatted text: headings, bold, lists, links.',
      help: 'Rich text is formatted with Markdown: # for a heading, **bold**, *italic*, - for a list, [text](https://…) for a link.',
      example: 'Set RichText1.text to "**Well done** " + name',
      props: { text: 'text', fontSize: 'text size', color: 'color', linkColor: 'link color' },
      events: {},
      methods: {},
      enums: {},
    },
  },
})
