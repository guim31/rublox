import { defineComponent } from '../component.ts'
import { event, method, prop } from '../define.ts'

export const WebView = defineComponent({
  type: 'WebView',
  category: 'media',
  icon: 'globe',
  visible: true,
  container: false,
  junior: false,
  commonDefaults: { width: 'fill', height: 320, borderWidth: 1, radius: 12 },
  props: {
    url: prop.string({
      default: 'https://example.com',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
  },
  events: { load: event() },
  methods: { reload: method() },
  strings: {
    fr: {
      label: 'Page web',
      prefix: 'PageWeb',
      description: 'Affiche une page d’un site (adresse https://).',
      help: 'Une page web montre un site dans ton appli. Seules les adresses https:// marchent, et certains sites refusent de s’afficher dans une autre appli.',
      example: 'Mettre PageWeb1.adresse à "https://fr.wikipedia.org"',
      props: { url: 'adresse' },
      events: { load: 'quand %1 est chargée' },
      methods: { reload: 'recharger %1' },
      enums: {},
    },
    en: {
      label: 'Web page',
      prefix: 'WebPage',
      description: 'Shows a page of a website (https:// address).',
      help: 'A web page shows a website inside your app. Only https:// addresses work, and some sites refuse to show inside another app.',
      example: 'Set WebPage1.address to "https://en.wikipedia.org"',
      props: { url: 'address' },
      events: { load: 'when %1 has loaded' },
      methods: { reload: 'reload %1' },
      enums: {},
    },
  },
})
