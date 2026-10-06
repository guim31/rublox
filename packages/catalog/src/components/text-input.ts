import { defineComponent } from '../component.ts'
import { event, method, prop } from '../define.ts'

export const TextInput = defineComponent({
  type: 'TextInput',
  category: 'base',
  icon: 'text-cursor-input',
  visible: true,
  container: false,
  junior: true,
  commonDefaults: { radius: 10, borderWidth: 1 },
  props: {
    text: prop.string({ default: '', group: 'content', junior: true, blocks: 'get-set' }),
    placeholder: prop.string({
      default: { fr: 'Écris ici…', en: 'Type here…' },
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    inputType: prop.enum(['text', 'multiline', 'password', 'number', 'email'], {
      default: 'text',
      group: 'content',
      junior: true,
    }),
    fontSize: prop.number({ default: 16, min: 8, max: 64, group: 'style' }),
    disabled: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
  },
  events: {
    change: event({ junior: true }),
    submit: event(),
  },
  methods: {
    focus: method(),
    clear: method({ junior: true }),
  },
  strings: {
    fr: {
      label: 'Champ de texte',
      prefix: 'Champ',
      description: 'Une case où écrire.',
      help: 'Un champ de texte permet d’écrire : un prénom, un nombre, un mot de passe… Lis ce qui est écrit avec « texte de Champ1 ».',
      example: 'Mettre Texte1.texte à "Bonjour " + Champ1.texte',
      props: {
        text: 'texte',
        placeholder: 'texte indicatif',
        inputType: 'type',
        fontSize: 'taille du texte',
        disabled: 'désactivé',
      },
      events: { change: 'quand %1 change', submit: 'quand %1 est validé' },
      methods: { focus: 'placer le curseur dans %1', clear: 'vider %1' },
      enums: {
        inputType: {
          text: 'Une ligne',
          multiline: 'Plusieurs lignes',
          password: 'Mot de passe',
          number: 'Nombre',
          email: 'E-mail',
        },
      },
    },
    en: {
      label: 'Text input',
      prefix: 'Input',
      description: 'A box to type in.',
      help: 'A text input lets people type: a name, a number, a password… Read what was typed with "text of Input1".',
      example: 'Set Text1.text to "Hello " + Input1.text',
      props: {
        text: 'text',
        placeholder: 'placeholder',
        inputType: 'type',
        fontSize: 'text size',
        disabled: 'disabled',
      },
      events: { change: 'when %1 changes', submit: 'when %1 is submitted' },
      methods: { focus: 'put the cursor in %1', clear: 'clear %1' },
      enums: {
        inputType: {
          text: 'One line',
          multiline: 'Several lines',
          password: 'Password',
          number: 'Number',
          email: 'E-mail',
        },
      },
    },
  },
})
