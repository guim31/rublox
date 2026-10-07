import { defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'

export const QrCode = defineComponent({
  type: 'QrCode',
  category: 'display',
  icon: 'qr-code',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { width: 180, height: 180, alignSelf: 'center' },
  props: {
    text: prop.string({
      default: 'https://example.com',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    color: prop.color({ default: '#000000', group: 'style' }),
    backgroundColor: prop.color({ default: '#ffffff', group: 'style' }),
  },
  events: { click: event() },
  strings: {
    fr: {
      label: 'QR code',
      prefix: 'QRcode',
      description: 'Transforme un texte ou un lien en QR code.',
      help: 'Un QR code se scanne avec un autre téléphone pour lire son texte ou ouvrir son lien. Garde un fond clair pour qu’il se lise bien.',
      example: 'Mettre QRcode1.texte à Champ1.texte',
      props: { text: 'texte', color: 'couleur', backgroundColor: 'couleur du fond' },
      events: { click: 'quand %1 est cliqué' },
      methods: {},
      enums: {},
    },
    en: {
      label: 'QR code',
      prefix: 'QRcode',
      description: 'Turns a text or a link into a QR code.',
      help: 'A QR code is scanned with another phone to read its text or open its link. Keep a light background so that it reads well.',
      example: 'Set QRcode1.text to Input1.text',
      props: { text: 'text', color: 'color', backgroundColor: 'background color' },
      events: { click: 'when %1 is clicked' },
      methods: {},
      enums: {},
    },
  },
})
