import { defineComponent } from '../component.ts'
import { prop } from '../define.ts'

export const ProgressBar = defineComponent({
  type: 'ProgressBar',
  category: 'display',
  icon: 'loader',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { width: 'fill' },
  props: {
    value: prop.number({
      default: 40,
      min: 0,
      max: 100,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    color: prop.color({ default: '@primary', group: 'style', junior: true, blocks: 'get-set' }),
    trackColor: prop.color({ default: '@surface', group: 'style' }),
    thickness: prop.number({ default: 10, min: 2, max: 48, group: 'style' }),
  },
  strings: {
    fr: {
      label: 'Barre de progression',
      prefix: 'Progression',
      description: 'Montre où on en est, de 0 à 100.',
      help: 'Une barre de progression se remplit selon sa valeur, de 0 (vide) à 100 (pleine) : un chargement, une jauge de vie, un score.',
      example: 'Mettre Progression1.valeur à Progression1.valeur + 10',
      props: {
        value: 'valeur',
        color: 'couleur',
        trackColor: 'couleur du fond',
        thickness: 'épaisseur',
      },
      events: {},
      methods: {},
      enums: {},
    },
    en: {
      label: 'Progress bar',
      prefix: 'Progress',
      description: 'Shows how far along, from 0 to 100.',
      help: 'A progress bar fills according to its value, from 0 (empty) to 100 (full): a loading, a health bar, a score.',
      example: 'Set Progress1.value to Progress1.value + 10',
      props: { value: 'value', color: 'color', trackColor: 'track color', thickness: 'thickness' },
      events: {},
      methods: {},
      enums: {},
    },
  },
})
