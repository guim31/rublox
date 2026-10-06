import { defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'

export const Network = defineComponent({
  type: 'Network',
  category: 'sensors',
  icon: 'wifi',
  visible: false,
  container: false,
  junior: false,
  props: {
    online: prop.boolean({ default: true, group: 'content', state: true }),
  },
  events: { online: event(), offline: event() },
  strings: {
    fr: {
      label: 'Réseau',
      prefix: 'Reseau',
      description: 'Savoir si le téléphone est connecté à Internet.',
      help: 'Le réseau dit si le téléphone est en ligne, et prévient quand la connexion se coupe ou revient.',
      example: 'Quand Reseau1 se coupe, afficher le message bref "Hors ligne"',
      props: { online: 'en ligne' },
      events: { online: 'quand %1 revient', offline: 'quand %1 se coupe' },
      methods: {},
      enums: {},
    },
    en: {
      label: 'Network',
      prefix: 'Network',
      description: 'Whether the phone is connected to the Internet.',
      help: 'Network says whether the phone is online, and tells when the connection drops or comes back.',
      example: 'When Network1 drops, show the short message "Offline"',
      props: { online: 'online' },
      events: { online: 'when %1 comes back', offline: 'when %1 drops' },
      methods: {},
      enums: {},
    },
  },
})
