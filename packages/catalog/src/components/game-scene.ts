import { defineComponent } from '../component.ts'
import { event, method, prop } from '../define.ts'

/** Types that live in a game scene, placed by `x` and `y`. */
export const SCENE_CHILD_TYPES = ['Sprite', 'SceneText', 'Joystick'] as const

/**
 * Keys a game hears (J10): arrows, space, enter, and the letters of the two usual sets of
 * direction keys (W A S D on a QWERTY keyboard, Z Q S D on an AZERTY one).
 */
export const GAME_KEYS = [
  'left',
  'right',
  'up',
  'down',
  'space',
  'enter',
  'w',
  'a',
  's',
  'd',
  'z',
  'q',
] as const
export type GameKey = (typeof GAME_KEYS)[number]

export const SWIPE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const

const KEY_LABELS = {
  fr: {
    left: 'flèche gauche',
    right: 'flèche droite',
    up: 'flèche du haut',
    down: 'flèche du bas',
    space: 'espace',
    enter: 'entrée',
    w: 'W',
    a: 'A',
    s: 'S',
    d: 'D',
    z: 'Z',
    q: 'Q',
  },
  en: {
    left: 'left arrow',
    right: 'right arrow',
    up: 'up arrow',
    down: 'down arrow',
    space: 'space',
    enter: 'enter',
    w: 'W',
    a: 'A',
    s: 'S',
    d: 'D',
    z: 'Z',
    q: 'Q',
  },
}

const sprite = { kind: 'component', componentType: 'Sprite' } as const

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
    worldWidth: prop.number({
      default: 0,
      min: 0,
      max: 20000,
      group: 'layout',
      blocks: 'get-set',
    }),
    worldHeight: prop.number({
      default: 0,
      min: 0,
      max: 20000,
      group: 'layout',
      blocks: 'get-set',
    }),
    cameraX: prop.number({ default: 0, group: 'advanced', blocks: 'get-set' }),
    cameraY: prop.number({ default: 0, group: 'advanced', blocks: 'get-set' }),
  },
  events: {
    start: event({ junior: true }),
    frame: event({ args: { dt: { kind: 'number' } }, skipIfBusy: true }),
    tap: event({ junior: true, args: { x: { kind: 'number' }, y: { kind: 'number' } } }),
    keyDown: event({
      junior: true,
      filter: { kind: 'enum', values: GAME_KEYS },
      args: { key: { kind: 'string' } },
    }),
    keyUp: event({
      filter: { kind: 'enum', values: GAME_KEYS },
      args: { key: { kind: 'string' } },
    }),
    swipe: event({
      junior: true,
      filter: { kind: 'enum', values: SWIPE_DIRECTIONS },
      args: { direction: { kind: 'string' } },
    }),
  },
  methods: {
    pause: method({ junior: true }),
    resume: method({ junior: true }),
    deleteClones: method(),
    follow: method({ junior: true, args: { target: sprite } }),
    stopFollowing: method(),
    shake: method({ args: { seconds: { kind: 'number', default: 0.3 } } }),
    isKeyPressed: method({
      junior: true,
      args: { key: { kind: 'enum', values: GAME_KEYS, default: 'space' } },
      returns: 'boolean',
    }),
  },
  strings: {
    fr: {
      label: 'Scène de jeu',
      prefix: 'Scene',
      description: 'Un terrain de jeu où les lutins bougent librement.',
      help: 'La scène de jeu est un terrain de taille fixe, agrandi ou réduit pour remplir sa place sur l’écran. Pose dessus des lutins et des textes, place-les où tu veux, puis fais-les bouger avec des blocs. Le jeu tourne à 60 images par seconde et se met en pause quand l’appli est cachée. Pour un niveau plus grand que l’écran, donne une largeur (ou une hauteur) au monde, puis demande à la caméra de suivre ton héros. Le jeu entend aussi le clavier (flèches, espace) et les glissements du doigt. Pendant que la scène est en pause, une boucle ne s’arrête pas à chaque image : c’est le moment de construire un niveau d’un coup.',
      example:
        'Quand Scene1 démarre, répéter indéfiniment : créer un clone de Pomme, attendre 1 seconde',
      props: {
        sceneWidth: 'largeur de la scène',
        sceneHeight: 'hauteur de la scène',
        backgroundImage: 'image de fond',
        edges: 'bords',
        paused: 'en pause',
        worldWidth: 'largeur du monde (0 = la scène)',
        worldHeight: 'hauteur du monde (0 = la scène)',
        cameraX: 'x de la caméra',
        cameraY: 'y de la caméra',
      },
      events: {
        start: 'quand %1 démarre',
        frame: 'à chaque image de %1',
        tap: 'quand on touche %1',
        keyDown: 'quand on appuie sur %2 dans %1',
        keyUp: 'quand on lâche %2 dans %1',
        swipe: 'quand on glisse le doigt %2 sur %1',
      },
      methods: {
        pause: 'mettre %1 en pause',
        resume: 'relancer %1',
        deleteClones: 'supprimer tous les clones de %1',
        follow: 'caméra de %1 : suivre %2',
        stopFollowing: 'caméra de %1 : arrêter de suivre',
        shake: 'secouer %1 pendant %2 s',
        isKeyPressed: 'touche %2 enfoncée dans %1',
      },
      enums: {
        edges: { stop: 'Arrêtent', bounce: 'Font rebondir', pass: 'Laissent sortir' },
      },
      args: {
        dt: 'temps écoulé (s)',
        x: 'x du doigt',
        y: 'y du doigt',
        key: 'touche',
        direction: 'direction',
      },
      filters: {
        keyDown: { any: 'une touche', ...KEY_LABELS.fr },
        keyUp: { any: 'une touche', ...KEY_LABELS.fr },
        swipe: {
          any: 'dans un sens',
          up: 'vers le haut',
          down: 'vers le bas',
          left: 'vers la gauche',
          right: 'vers la droite',
        },
      },
      argValues: { key: KEY_LABELS.fr },
    },
    en: {
      label: 'Game scene',
      prefix: 'Scene',
      description: 'A playground where sprites move freely.',
      help: 'The game scene is a stage of fixed size, scaled up or down to fill its place on the screen. Put sprites and texts on it, place them anywhere, then make them move with blocks. The game runs at 60 frames per second and pauses while the app is hidden. For a level bigger than the screen, give the world a width (or a height), then ask the camera to follow your hero. The game also hears the keyboard (arrows, space) and finger swipes. While the scene is paused, a loop does not stop at every frame: the right moment to build a level in one go.',
      example: 'When Scene1 starts, forever: create a clone of Apple, wait 1 second',
      props: {
        sceneWidth: 'scene width',
        sceneHeight: 'scene height',
        backgroundImage: 'background image',
        edges: 'edges',
        paused: 'paused',
        worldWidth: 'world width (0 = the scene)',
        worldHeight: 'world height (0 = the scene)',
        cameraX: 'camera x',
        cameraY: 'camera y',
      },
      events: {
        start: 'when %1 starts',
        frame: 'on every frame of %1',
        tap: 'when %1 is tapped',
        keyDown: 'when %2 is pressed in %1',
        keyUp: 'when %2 is released in %1',
        swipe: 'when a finger swipes %2 on %1',
      },
      methods: {
        pause: 'pause %1',
        resume: 'resume %1',
        deleteClones: 'delete every clone in %1',
        follow: 'camera of %1: follow %2',
        stopFollowing: 'camera of %1: stop following',
        shake: 'shake %1 for %2 s',
        isKeyPressed: 'key %2 is down in %1',
      },
      enums: {
        edges: { stop: 'Stop', bounce: 'Bounce', pass: 'Let through' },
      },
      args: {
        dt: 'elapsed time (s)',
        x: 'finger x',
        y: 'finger y',
        key: 'key',
        direction: 'direction',
      },
      filters: {
        keyDown: { any: 'any key', ...KEY_LABELS.en },
        keyUp: { any: 'any key', ...KEY_LABELS.en },
        swipe: { any: 'any way', up: 'up', down: 'down', left: 'left', right: 'right' },
      },
      argValues: { key: KEY_LABELS.en },
    },
  },
})
