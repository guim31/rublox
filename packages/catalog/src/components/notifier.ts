import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, event, method } from '../define.ts'

/** Local notifications (no server): shown now or after a delay, while the app is open. */
export const Notifier = defineComponent({
  type: 'Notifier',
  category: 'device',
  icon: 'bell',
  visible: false,
  container: false,
  junior: false,
  props: availableProp(),
  events: { click: event(), ...errorEvent() },
  methods: {
    notify: method({ async: true, args: { title: arg('string'), text: arg('string') } }),
    notifyLater: method({
      async: true,
      args: { seconds: arg('number'), title: arg('string'), text: arg('string') },
    }),
  },
  strings: {
    fr: {
      label: 'Notifications locales',
      prefix: 'Notification',
      description: 'Affiche une notification sur le téléphone.',
      help: 'Une notification apparaît en haut du téléphone, même si l’appli est en arrière-plan. La première fois, le téléphone demande l’autorisation. Sur iPhone, l’appli doit être installée sur l’écran d’accueil.',
      example: 'Notifier avec Notification1 le titre "Pause !" et le texte "Bois un verre d’eau"',
      props: {},
      events: { click: 'quand une notification de %1 est touchée' },
      methods: {
        notify: 'notifier avec %1 le titre %2 et le texte %3',
        notifyLater: 'dans %2 seconde(s), notifier avec %1 le titre %3 et le texte %4',
      },
      enums: {},
    },
    en: {
      label: 'Local notifications',
      prefix: 'Notification',
      description: 'Shows a notification on the phone.',
      help: 'A notification shows at the top of the phone, even when the app is in the background. The first time, the phone asks for permission. On iPhone, the app must be installed on the home screen.',
      example: 'Notify with Notification1 the title "Break!" and the text "Drink some water"',
      props: {},
      events: { click: 'when a notification of %1 is tapped' },
      methods: {
        notify: 'notify with %1 the title %2 and the text %3',
        notifyLater: 'in %2 second(s), notify with %1 the title %3 and the text %4',
      },
      enums: {},
    },
  },
})
