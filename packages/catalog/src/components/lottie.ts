import { errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { event, method, prop } from '../define.ts'

export const Lottie = defineComponent({
  type: 'Lottie',
  category: 'media',
  icon: 'sparkles',
  visible: true,
  container: false,
  junior: false,
  commonDefaults: { width: 200, height: 200, alignSelf: 'center' },
  props: {
    src: prop.asset({ default: '', assetKind: 'lottie', group: 'content', junior: true }),
    autoplay: prop.boolean({ default: true, group: 'content', junior: true }),
    loop: prop.boolean({ default: true, group: 'content', junior: true, blocks: 'get-set' }),
    speed: prop.number({
      default: 1,
      min: 0.1,
      max: 4,
      step: 0.1,
      group: 'content',
      blocks: 'get-set',
    }),
  },
  events: { complete: event(), ...errorEvent() },
  methods: { play: method(), pause: method(), stop: method() },
  strings: {
    fr: {
      label: 'Animation Lottie',
      prefix: 'Animation',
      description: 'Une animation légère au format Lottie (.json).',
      help: 'Une animation Lottie est un dessin animé très léger, au format .json. Envoie le fichier dans l’inspecteur, puis lance-la ou arrête-la avec ses blocs.',
      example: 'Quand Bouton1 est cliqué, lire Animation1',
      props: {
        src: 'animation',
        autoplay: 'lecture automatique',
        loop: 'en boucle',
        speed: 'vitesse',
      },
      events: { complete: 'quand %1 est finie' },
      methods: { play: 'lire %1', pause: 'mettre %1 en pause', stop: 'arrêter %1' },
      enums: {},
    },
    en: {
      label: 'Lottie animation',
      prefix: 'Animation',
      description: 'A light animation in the Lottie format (.json).',
      help: 'A Lottie animation is a very light cartoon, in the .json format. Upload the file in the inspector, then start or stop it with its blocks.',
      example: 'When Button1 is clicked, play Animation1',
      props: { src: 'animation', autoplay: 'autoplay', loop: 'loop', speed: 'speed' },
      events: { complete: 'when %1 completes' },
      methods: { play: 'play %1', pause: 'pause %1', stop: 'stop %1' },
      enums: {},
    },
  },
})
