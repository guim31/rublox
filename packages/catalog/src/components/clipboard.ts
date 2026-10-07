import { errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, method } from '../define.ts'

export const Clipboard = defineComponent({
  type: 'Clipboard',
  category: 'device',
  icon: 'clipboard',
  visible: false,
  container: false,
  junior: false,
  props: {},
  events: errorEvent(),
  methods: {
    copy: method({ async: true, args: { text: arg('string') } }),
    paste: method({ async: true, returns: 'string' }),
  },
  strings: {
    fr: {
      label: 'Presse-papiers',
      prefix: 'PressePapiers',
      description: 'Copie et colle du texte.',
      help: 'Le presse-papiers copie un texte pour le coller ailleurs, ou lit ce qui a été copié. Lire le presse-papiers demande souvent une autorisation.',
      example: 'Quand Bouton1 est cliqué, copier avec PressePapiers1 le texte Texte1.texte',
      props: {},
      events: {},
      methods: { copy: 'copier avec %1 le texte %2', paste: 'texte copié dans %1' },
      enums: {},
    },
    en: {
      label: 'Clipboard',
      prefix: 'Clipboard',
      description: 'Copies and pastes text.',
      help: 'The clipboard copies a text to paste elsewhere, or reads what was copied. Reading the clipboard often needs a permission.',
      example: 'When Button1 is clicked, copy with Clipboard1 the text Text1.text',
      props: {},
      events: {},
      methods: { copy: 'copy with %1 the text %2', paste: 'text copied in %1' },
      enums: {},
    },
  },
})
