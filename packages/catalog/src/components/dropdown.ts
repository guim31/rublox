import { defineComponent } from '../component.ts'
import { arg, event, prop } from '../define.ts'

export const Dropdown = defineComponent({
  type: 'Dropdown',
  category: 'input',
  icon: 'list-collapse',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { radius: 10, borderWidth: 1 },
  props: {
    options: prop.list({
      default: { fr: ['Rouge', 'Vert', 'Bleu'], en: ['Red', 'Green', 'Blue'] },
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    selected: prop.string({ default: '', group: 'content', junior: true, blocks: 'get-set' }),
    placeholder: prop.string({
      default: { fr: 'Choisis…', en: 'Choose…' },
      group: 'content',
      blocks: 'get-set',
    }),
    selectedIndex: prop.number({ default: 0, group: 'content', state: true }),
    fontSize: prop.number({ default: 16, min: 8, max: 64, group: 'style' }),
    disabled: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
  },
  events: {
    change: event({ junior: true, args: { value: arg('string'), index: arg('number') } }),
  },
  strings: {
    fr: {
      label: 'Liste déroulante',
      prefix: 'Choix',
      description: 'Choisir une réponse dans une liste.',
      help: 'Une liste déroulante propose des choix (un par ligne dans l’inspecteur). « choisi » est le texte de la réponse, « position du choix » son numéro (à partir de 1, 0 si rien).',
      example: 'Quand Choix1 change, mettre Texte1.texte à choisi de Choix1',
      props: {
        options: 'choix possibles',
        selected: 'choisi',
        placeholder: 'texte indicatif',
        selectedIndex: 'position du choix',
        fontSize: 'taille du texte',
        disabled: 'désactivé',
      },
      events: { change: 'quand %1 change' },
      methods: {},
      enums: {},
      args: { value: 'valeur', index: 'position' },
    },
    en: {
      label: 'Dropdown',
      prefix: 'Dropdown',
      description: 'Pick an answer from a list.',
      help: 'A dropdown offers choices (one per line in the inspector). "selected" is the text of the answer, "selected position" its number (from 1, 0 when none).',
      example: 'When Dropdown1 changes, set Text1.text to selected of Dropdown1',
      props: {
        options: 'options',
        selected: 'selected',
        placeholder: 'placeholder',
        selectedIndex: 'selected position',
        fontSize: 'text size',
        disabled: 'disabled',
      },
      events: { change: 'when %1 changes' },
      methods: {},
      enums: {},
      args: { value: 'value', index: 'position' },
    },
  },
})
