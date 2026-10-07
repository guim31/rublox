import { errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { event, method, prop } from '../define.ts'

export const Sound = defineComponent({
  type: 'Sound',
  category: 'device',
  icon: 'music',
  visible: false,
  container: false,
  junior: true,
  props: {
    src: prop.asset({
      default: '',
      assetKind: 'sound',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    volume: prop.number({
      default: 100,
      min: 0,
      max: 100,
      step: 5,
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    loop: prop.boolean({ default: false, group: 'content', blocks: 'get-set' }),
    playing: prop.boolean({ default: false, group: 'content', state: true }),
  },
  events: { ended: event(), ...errorEvent() },
  methods: {
    play: method({ junior: true }),
    playUntilDone: method({ async: true }),
    pause: method(),
    stop: method({ junior: true }),
  },
  strings: {
    fr: {
      label: 'Son',
      prefix: 'Son',
      description: 'Joue un son ou une musique.',
      help: 'Un son joue un fichier audio de ton projet. « jouer » lance le son et passe au bloc suivant ; « jouer jusqu’au bout » attend qu’il soit fini. Sur téléphone, le premier son doit suivre un toucher.',
      example: 'Quand Bouton1 est cliqué, jouer Son1',
      props: { src: 'son', volume: 'volume', loop: 'en boucle', playing: 'en lecture' },
      events: { ended: 'quand %1 est fini' },
      methods: {
        play: 'jouer %1',
        playUntilDone: 'jouer %1 jusqu’au bout',
        pause: 'mettre %1 en pause',
        stop: 'arrêter %1',
      },
      enums: {},
    },
    en: {
      label: 'Sound',
      prefix: 'Sound',
      description: 'Plays a sound or some music.',
      help: 'A sound plays an audio file of your project. "play" starts it and goes on to the next block; "play until done" waits for its end. On a phone, the first sound must follow a tap.',
      example: 'When Button1 is clicked, play Sound1',
      props: { src: 'sound', volume: 'volume', loop: 'loop', playing: 'playing' },
      events: { ended: 'when %1 ends' },
      methods: {
        play: 'play %1',
        playUntilDone: 'play %1 until done',
        pause: 'pause %1',
        stop: 'stop %1',
      },
      enums: {},
    },
  },
})
