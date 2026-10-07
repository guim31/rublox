import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, method } from '../define.ts'

export const Share = defineComponent({
  type: 'Share',
  category: 'device',
  icon: 'share-2',
  visible: false,
  container: false,
  junior: true,
  props: availableProp(),
  events: errorEvent(),
  methods: {
    share: method({ junior: true, async: true, args: { text: arg('string'), url: arg('string') } }),
  },
  strings: {
    fr: {
      label: 'Partage',
      prefix: 'Partage',
      description: 'Partage un texte ou un lien avec une autre appli.',
      help: 'Le partage ouvre la fenêtre de partage du téléphone (messages, e-mail…). Sans elle (ordinateur), le texte est copié dans le presse-papiers.',
      example:
        'Quand Bouton1 est cliqué, partager avec Partage1 le texte "Mon score : 12" et le lien ""',
      props: {},
      events: {},
      methods: { share: 'partager avec %1 le texte %2 et le lien %3' },
      enums: {},
    },
    en: {
      label: 'Share',
      prefix: 'Share',
      description: 'Shares a text or a link with another app.',
      help: 'Share opens the phone’s share sheet (messages, e-mail…). Without it (computer), the text is copied to the clipboard.',
      example: 'When Button1 is clicked, share with Share1 the text "My score: 12" and the link ""',
      props: {},
      events: {},
      methods: { share: 'share with %1 the text %2 and the link %3' },
      enums: {},
    },
  },
})
