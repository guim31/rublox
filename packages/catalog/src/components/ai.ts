import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, method, prop } from '../define.ts'

/**
 * The AI component (J6, SPEC § 4.12): generates a text, describes an image. Billed to whoever
 * runs it in the editor, and to the owner of a published app, which must allow it. Offered in
 * the palette only when the instance has an AI key and the account may use it.
 */
export const AI = defineComponent({
  type: 'AI',
  category: 'data',
  icon: 'sparkles',
  visible: false,
  container: false,
  junior: false,
  props: {
    instructions: prop.string({
      default: '',
      group: 'content',
      multiline: true,
      blocks: 'get-set',
    }),
    busy: prop.boolean({ default: false, group: 'advanced', state: true }),
    ...availableProp(),
  },
  events: errorEvent(),
  methods: {
    generate: method({ async: true, returns: 'string', args: { prompt: arg('string') } }),
    describe: method({
      async: true,
      returns: 'string',
      args: { image: arg('asset'), question: arg('string') },
    }),
  },
  strings: {
    fr: {
      label: 'IA',
      prefix: 'IA',
      description: 'Écrit un texte ou décrit une image, avec l’assistant IA.',
      help: 'L’IA répond à une demande écrite (« invente une blague sur les chats ») ou décrit une image (une photo prise avec l’appareil photo). Ses « consignes » s’ajoutent à chaque demande (« Tu es un pirate »). Elle met quelques secondes à répondre ; si elle n’est pas disponible (appli publiée sans autorisation, quota du jour atteint), elle répond un texte vide et déclenche « a un problème ».',
      example: 'Quand Bouton1 est cliqué, mettre Texte1.texte à réponse de IA1 à Champ1.texte',
      props: {
        instructions: 'consignes',
        busy: 'en train de répondre',
      },
      events: {},
      methods: {
        generate: 'réponse de %1 à %2',
        describe: 'description par %1 de l’image %2 question %3',
      },
      enums: {},
    },
    en: {
      label: 'AI',
      prefix: 'AI',
      description: 'Writes a text or describes an image, with the AI assistant.',
      help: 'The AI answers a written request (“make up a joke about cats”) or describes an image (a photo taken with the camera). Its “instructions” are added to every request (“You are a pirate”). It takes a few seconds to answer; when it is not available (a published app without permission, today’s quota reached), it answers an empty text and fires “has a problem”.',
      example: 'When Button1 is clicked, set Text1.text to answer of AI1 to TextInput1.text',
      props: {
        instructions: 'instructions',
        busy: 'answering',
      },
      events: {},
      methods: {
        generate: 'answer of %1 to %2',
        describe: 'description by %1 of image %2 question %3',
      },
      enums: {},
    },
  },
})
