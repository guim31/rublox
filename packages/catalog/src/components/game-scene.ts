import { defineComponent } from '../component.ts'
import { event, method, prop } from '../define.ts'

/** Types that live in a game scene, placed by `x` and `y`. */
export const SCENE_CHILD_TYPES = ['Sprite', 'SceneText', 'Joystick'] as const

/**
 * The game scene (SPEC § 4.4, Jeu): a stage of fixed logical size, scaled to fit the space it
 * gets, whose children are placed freely. It runs the game loop.
 */
export const GameScene = defineComponent({
  type: 'GameScene',
  category: 'game',
  icon: 'gamepad-2',
  visible: true,
  container: true,
  junior: true,
  freeLayout: true,
  accepts: SCENE_CHILD_TYPES,
  omitCommon: ['padding'],
  commonDefaults: { width: 'fill', grow: true, background: '#cdeafe', radius: 0 },
  props: {
    sceneWidth: prop.number({
      default: 360,
      min: 100,
      max: 4000,
      group: 'layout',
      junior: true,
      blocks: 'get',
    }),
    sceneHeight: prop.number({
      default: 640,
      min: 100,
      max: 4000,
      group: 'layout',
      junior: true,
      blocks: 'get',
    }),
    backgroundImage: prop.asset({
      default: '',
      assetKind: 'image',
      group: 'style',
      junior: true,
      blocks: 'get-set',
    }),
    edges: prop.enum(['stop', 'bounce', 'pass'], {
      default: 'stop',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    paused: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
  },
  events: {
    start: event({ junior: true }),
    frame: event({ args: { dt: { kind: 'number' } }, skipIfBusy: true }),
    tap: event({ junior: true, args: { x: { kind: 'number' }, y: { kind: 'number' } } }),
  },
  methods: {
    pause: method({ junior: true }),
    resume: method({ junior: true }),
    deleteClones: method(),
  },
  strings: {
    fr: {
      label: 'Scène de jeu',
      prefix: 'Scene',
      description: 'Un terrain de jeu où les lutins bougent librement.',
      help: 'La scène de jeu est un terrain de taille fixe, agrandi ou réduit pour remplir sa place sur l’écran. Pose dessus des lutins et des textes, place-les où tu veux, puis fais-les bouger avec des blocs. Le jeu tourne à 60 images par seconde et se met en pause quand l’appli est cachée.',
      example: 'Quand Scene1 démarre, répéter indéfiniment : créer un clone de Pomme, attendre 1 seconde',
      props: {
        sceneWidth: 'largeur de la scène',
        sceneHeight: 'hauteur de la scène',
        backgroundImage: 'image de fond',
        edges: 'bords',
        paused: 'en pause',
      },
      events: {
        start: 'quand %1 démarre',
        frame: 'à chaque image de %1',
        tap: 'quand on touche %1',
      },
      methods: {
        pause: 'mettre %1 en pause',
        resume: 'relancer %1',
        deleteClones: 'supprimer tous les clones de %1',
      },
      enums: {
        edges: { stop: 'Arrêtent', bounce: 'Font rebondir', pass: 'Laissent sortir' },
      },
      eventArgs: {
        frame: { dt: 'temps écoulé (s)' },
        tap: { x: 'x du doigt', y: 'y du doigt' },
      },
    },
    en: {
      label: 'Game scene',
      prefix: 'Scene',
      description: 'A playground where sprites move freely.',
      help: 'The game scene is a stage of fixed size, scaled up or down to fill its place on the screen. Put sprites and texts on it, place them anywhere, then make them move with blocks. The game runs at 60 frames per second and pauses while the app is hidden.',
      example: 'When Scene1 starts, forever: create a clone of Apple, wait 1 second',
      props: {
        sceneWidth: 'scene width',
        sceneHeight: 'scene height',
        backgroundImage: 'background image',
        edges: 'edges',
        paused: 'paused',
      },
      events: {
        start: 'when %1 starts',
        frame: 'on every frame of %1',
        tap: 'when %1 is tapped',
      },
      methods: {
        pause: 'pause %1',
        resume: 'resume %1',
        deleteClones: 'delete every clone in %1',
      },
      enums: {
        edges: { stop: 'Stop', bounce: 'Bounce', pass: 'Let through' },
      },
      eventArgs: {
        frame: { dt: 'elapsed time (s)' },
        tap: { x: 'finger x', y: 'finger y' },
      },
    },
  },
})
