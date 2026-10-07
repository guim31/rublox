import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, method } from '../define.ts'

export const Vibrator = defineComponent({
  type: 'Vibrator',
  category: 'device',
  icon: 'vibrate',
  visible: false,
  container: false,
  junior: true,
  props: availableProp(),
  events: errorEvent(),
  methods: { vibrate: method({ junior: true, args: { seconds: arg('number') } }) },
  strings: {
    fr: {
      label: 'Vibreur',
      prefix: 'Vibreur',
      description: 'Fait vibrer le téléphone.',
      help: 'Le vibreur fait vibrer le téléphone quelques instants. Les iPhone ne le permettent pas aux applis web : « disponible » vaut alors faux.',
      example: 'Quand Bouton1 est cliqué, faire vibrer Vibreur1 pendant 0.3 seconde',
      props: {},
      events: {},
      methods: { vibrate: 'faire vibrer %1 pendant %2 seconde(s)' },
      enums: {},
    },
    en: {
      label: 'Vibrator',
      prefix: 'Vibrator',
      description: 'Makes the phone vibrate.',
      help: 'The vibrator makes the phone vibrate for a moment. iPhones do not allow it for web apps: "available" is then false.',
      example: 'When Button1 is clicked, vibrate Vibrator1 for 0.3 second',
      props: {},
      events: {},
      methods: { vibrate: 'vibrate %1 for %2 second(s)' },
      enums: {},
    },
  },
})
