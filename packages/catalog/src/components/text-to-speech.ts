import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, method, prop } from '../define.ts'

export const TextToSpeech = defineComponent({
  type: 'TextToSpeech',
  category: 'device',
  icon: 'speech',
  visible: false,
  container: false,
  junior: true,
  props: {
    language: prop.enum(['auto', 'fr-FR', 'en-US', 'en-GB', 'es-ES', 'de-DE', 'it-IT'], {
      default: 'auto',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    rate: prop.number({
      default: 1,
      min: 0.5,
      max: 2,
      step: 0.1,
      group: 'content',
      blocks: 'get-set',
    }),
    pitch: prop.number({
      default: 1,
      min: 0,
      max: 2,
      step: 0.1,
      group: 'content',
      blocks: 'get-set',
    }),
    ...availableProp(),
  },
  events: errorEvent(),
  methods: {
    say: method({ junior: true, async: true, args: { text: arg('string') } }),
    stop: method(),
  },
  strings: {
    fr: {
      label: 'Synthèse vocale',
      prefix: 'Voix',
      description: 'Le téléphone lit un texte à voix haute.',
      help: 'La synthèse vocale lit un texte avec une voix du téléphone. Le bloc « dire » attend la fin de la phrase. Les voix disponibles dépendent du téléphone.',
      example: 'Quand Bouton1 est cliqué, faire dire à Voix1 "Bonjour !"',
      props: { language: 'langue', rate: 'vitesse', pitch: 'hauteur de la voix' },
      events: {},
      methods: { say: 'faire dire à %1 %2', stop: 'faire taire %1' },
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
    },
    en: {
      label: 'Text to speech',
      prefix: 'Voice',
      description: 'The phone reads a text aloud.',
      help: 'Text to speech reads a text with one of the phone’s voices. The "say" block waits for the end of the sentence. Available voices depend on the phone.',
      example: 'When Button1 is clicked, make Voice1 say "Hello!"',
      props: { language: 'language', rate: 'speed', pitch: 'pitch' },
      events: {},
      methods: { say: 'make %1 say %2', stop: 'silence %1' },
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
    },
  },
})
