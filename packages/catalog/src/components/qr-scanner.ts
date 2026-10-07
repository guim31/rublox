import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

export const QrScanner = defineComponent({
  type: 'QrScanner',
  category: 'device',
  icon: 'scan-line',
  visible: false,
  container: false,
  junior: true,
  props: {
    lastText: prop.string({ default: '', group: 'content', state: true }),
    ...availableProp(),
  },
  events: { scan: event({ args: { text: arg('string') } }), ...errorEvent() },
  methods: { scan: method({ junior: true, async: true, returns: 'string' }) },
  strings: {
    fr: {
      label: 'Lecteur de QR code',
      prefix: 'Scanner',
      description: 'Lit un QR code avec la caméra.',
      help: 'Le lecteur de QR code ouvre la caméra en plein écran et rend le texte du premier QR code vu. Si la personne annule, le résultat est vide.',
      example: 'Mettre Texte1.texte à scanner avec Scanner1',
      props: { lastText: 'dernier texte lu' },
      events: { scan: 'quand %1 a lu un QR code' },
      methods: { scan: 'scanner avec %1' },
      enums: {},
      args: { text: 'texte' },
    },
    en: {
      label: 'QR code scanner',
      prefix: 'Scanner',
      description: 'Reads a QR code with the camera.',
      help: 'The QR code scanner opens the camera full screen and gives the text of the first QR code it sees. If the person cancels, the result is empty.',
      example: 'Set Text1.text to scan with Scanner1',
      props: { lastText: 'last text read' },
      events: { scan: 'when %1 has read a QR code' },
      methods: { scan: 'scan with %1' },
      enums: {},
      args: { text: 'text' },
    },
  },
})
