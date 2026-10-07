import { defineComponent } from '../component.ts'
import { arg, event, prop } from '../define.ts'

export const TimePicker = defineComponent({
  type: 'TimePicker',
  category: 'input',
  icon: 'clock',
  visible: true,
  container: false,
  junior: false,
  commonDefaults: { radius: 10, borderWidth: 1 },
  props: {
    value: prop.time({ default: '', group: 'content', junior: true, blocks: 'get-set' }),
    fontSize: prop.number({ default: 16, min: 8, max: 64, group: 'style' }),
    disabled: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
  },
  events: { change: event({ junior: true, args: { value: arg('time') } }) },
  strings: {
    fr: {
      label: 'Choix d’heure',
      prefix: 'Heure',
      description: 'Choisir une heure.',
      help: 'Un choix d’heure ouvre l’horloge du téléphone. L’heure se lit sous la forme "09:30", vide si rien n’est choisi.',
      example: 'Quand Heure1 change, mettre Texte1.texte à "Réveil à " + heure de Heure1',
      props: { value: 'heure', fontSize: 'taille du texte', disabled: 'désactivé' },
      events: { change: 'quand %1 change' },
      methods: {},
      enums: {},
      args: { value: 'valeur' },
    },
    en: {
      label: 'Time picker',
      prefix: 'Time',
      description: 'Pick a time.',
      help: 'A time picker opens the phone’s clock. The time reads like "09:30", empty when none is picked.',
      example: 'When Time1 changes, set Text1.text to "Alarm at " + time of Time1',
      props: { value: 'time', fontSize: 'text size', disabled: 'disabled' },
      events: { change: 'when %1 changes' },
      methods: {},
      enums: {},
      args: { value: 'value' },
    },
  },
})
