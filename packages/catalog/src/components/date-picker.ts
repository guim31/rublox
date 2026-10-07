import { defineComponent } from '../component.ts'
import { arg, event, prop } from '../define.ts'

export const DatePicker = defineComponent({
  type: 'DatePicker',
  category: 'input',
  icon: 'calendar',
  visible: true,
  container: false,
  junior: false,
  commonDefaults: { radius: 10, borderWidth: 1 },
  props: {
    value: prop.date({ default: '', group: 'content', junior: true, blocks: 'get-set' }),
    min: prop.date({ default: '', group: 'content', blocks: 'get-set' }),
    max: prop.date({ default: '', group: 'content', blocks: 'get-set' }),
    fontSize: prop.number({ default: 16, min: 8, max: 64, group: 'style' }),
    disabled: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
  },
  events: { change: event({ junior: true, args: { value: arg('date') } }) },
  strings: {
    fr: {
      label: 'Choix de date',
      prefix: 'Date',
      description: 'Choisir un jour dans un calendrier.',
      help: 'Un choix de date ouvre le calendrier du téléphone. La date se lit sous la forme "2026-10-06" (année-mois-jour), vide si rien n’est choisi.',
      example: 'Quand Date1 change, mettre Texte1.texte à "Rendez-vous le " + date de Date1',
      props: {
        value: 'date',
        min: 'date minimum',
        max: 'date maximum',
        fontSize: 'taille du texte',
        disabled: 'désactivé',
      },
      events: { change: 'quand %1 change' },
      methods: {},
      enums: {},
      args: { value: 'valeur' },
    },
    en: {
      label: 'Date picker',
      prefix: 'Date',
      description: 'Pick a day in a calendar.',
      help: 'A date picker opens the phone’s calendar. The date reads like "2026-10-06" (year-month-day), empty when none is picked.',
      example: 'When Date1 changes, set Text1.text to "Meeting on " + date of Date1',
      props: {
        value: 'date',
        min: 'earliest date',
        max: 'latest date',
        fontSize: 'text size',
        disabled: 'disabled',
      },
      events: { change: 'when %1 changes' },
      methods: {},
      enums: {},
      args: { value: 'value' },
    },
  },
})
