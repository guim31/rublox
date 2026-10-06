import { availableProp } from '../common.ts'
import { defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'

export const Battery = defineComponent({
  type: 'Battery',
  category: 'sensors',
  icon: 'battery',
  visible: false,
  container: false,
  junior: false,
  props: {
    level: prop.number({ default: 100, group: 'content', state: true }),
    charging: prop.boolean({ default: false, group: 'content', state: true }),
    ...availableProp(),
  },
  events: { change: event() },
  strings: {
    fr: {
      label: 'Batterie',
      prefix: 'Batterie',
      description: 'Le niveau de la batterie (Android, Chrome).',
      help: 'La batterie donne le niveau de charge (0 à 100) et dit si le téléphone se recharge. Seuls Chrome et les navigateurs Android la fournissent : vérifie « disponible ».',
      example: 'Quand Batterie1 change, mettre Progression1.valeur à niveau de Batterie1',
      props: { level: 'niveau', charging: 'en charge' },
      events: { change: 'quand %1 change' },
      methods: {},
      enums: {},
    },
    en: {
      label: 'Battery',
      prefix: 'Battery',
      description: 'The battery level (Android, Chrome).',
      help: 'The battery gives the charge level (0 to 100) and says whether the phone is charging. Only Chrome and Android browsers provide it: check "available".',
      example: 'When Battery1 changes, set Progress1.value to level of Battery1',
      props: { level: 'level', charging: 'charging' },
      events: { change: 'when %1 changes' },
      methods: {},
      enums: {},
    },
  },
})
