import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

export const SpeechRecognition = defineComponent({
  type: 'SpeechRecognition',
  category: 'device',
  icon: 'audio-lines',
  visible: false,
  container: false,
  junior: false,
  props: {
    language: prop.enum(['auto', 'fr-FR', 'en-US', 'en-GB', 'es-ES', 'de-DE', 'it-IT'], {
      default: 'auto',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    listening: prop.boolean({ default: false, group: 'content', state: true }),
    lastText: prop.string({ default: '', group: 'content', state: true }),
    ...availableProp(),
  },
  events: { result: event({ args: { text: arg('string') } }), ...errorEvent() },
  methods: {
    listen: method({ async: true, returns: 'string' }),
    stop: method(),
  },
  strings: {
    fr: {
      label: 'Reconnaissance vocale',
      prefix: 'Ecoute',
      description: 'Transforme ce qu’on dit en texte.',
      help: 'La reconnaissance vocale écoute une phrase et la transforme en texte. Elle marche dans Chrome et Safari, pas partout : vérifie « disponible ». Le téléphone demande l’accès au micro.',
      example: 'Mettre Texte1.texte à écouter avec Ecoute1',
      props: { language: 'langue', listening: 'en écoute', lastText: 'dernier texte entendu' },
      events: { result: 'quand %1 a compris une phrase' },
      methods: { listen: 'écouter avec %1', stop: 'arrêter d’écouter avec %1' },
      enums: {
        language: {
          auto: 'Celle de l’appli',
          'fr-FR': 'Français',
          'en-US': 'Anglais (États-Unis)',
          'en-GB': 'Anglais (Royaume-Uni)',
          'es-ES': 'Espagnol',
          'de-DE': 'Allemand',
          'it-IT': 'Italien',
        },
      },
      args: { text: 'texte' },
    },
    en: {
      label: 'Speech recognition',
      prefix: 'Listener',
      description: 'Turns what is said into text.',
      help: 'Speech recognition listens to a sentence and turns it into text. It works in Chrome and Safari, not everywhere: check "available". The phone asks for microphone access.',
      example: 'Set Text1.text to listen with Listener1',
      props: { language: 'language', listening: 'listening', lastText: 'last text heard' },
      events: { result: 'when %1 understood a sentence' },
      methods: { listen: 'listen with %1', stop: 'stop listening with %1' },
      enums: {
        language: {
          auto: 'The app’s',
          'fr-FR': 'French',
          'en-US': 'English (US)',
          'en-GB': 'English (UK)',
          'es-ES': 'Spanish',
          'de-DE': 'German',
          'it-IT': 'Italian',
        },
      },
      args: { text: 'text' },
    },
  },
})
