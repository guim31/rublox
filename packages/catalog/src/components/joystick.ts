import { defineComponent } from '../component.ts'
import { event, prop } from '../define.ts'
import { SCENE_CHILD_OMIT } from './sprite.ts'

/** An on-screen joystick in a game scene (P2): its direction steers a sprite. */
export const Joystick = defineComponent({
  type: 'Joystick',
  category: 'game',
  icon: 'joystick',
  visible: true,
  container: false,
  junior: false,
  parents: ['GameScene'],
  omitCommon: SCENE_CHILD_OMIT,
  props: {
    x: prop.number({ default: 90, group: 'layout', junior: true, blocks: 'get-set' }),
    y: prop.number({ default: 550, group: 'layout', junior: true, blocks: 'get-set' }),
    size: prop.number({ default: 120, min: 40, max: 600, group: 'layout', junior: true }),
    color: prop.color({ default: '#5b4bff', group: 'style', junior: true }),
    keys: prop.enum(['none', 'arrows', 'wasd'], {
      default: 'arrows',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    dx: prop.number({ default: 0, group: 'advanced', blocks: 'get', state: true }),
    dy: prop.number({ default: 0, group: 'advanced', blocks: 'get', state: true }),
  },
  events: {
    move: event({ args: { dx: { kind: 'number' }, dy: { kind: 'number' } } }),
    release: event(),
  },
  strings: {
    fr: {
      label: 'Joystick',
      prefix: 'Joystick',
      description: 'Une manette à l’écran pour diriger un lutin.',
      help: 'Le joystick se pilote au doigt. Sa direction va de -1 à 1 : dx vers la droite, dy vers le bas. Multiplie-la par une vitesse pour faire avancer un lutin. Sur un ordinateur, il se pilote aussi au clavier (flèches, ou Z Q S D et W A S D) ; deux joysticks peuvent être tenus en même temps, chacun par un doigt.',
      example: 'À chaque image, mettre vitesse x de Lutin1 à dx de Joystick1 × 200',
      props: {
        x: 'x',
        y: 'y',
        size: 'taille',
        color: 'couleur',
        keys: 'touches du clavier',
        dx: 'direction x',
        dy: 'direction y',
      },
      events: { move: 'quand on bouge %1', release: 'quand on lâche %1' },
      methods: {},
      enums: { keys: { none: 'Aucune', arrows: 'Flèches', wasd: 'Z Q S D (ou W A S D)' } },
      args: { dx: 'direction x', dy: 'direction y' },
    },
    en: {
      label: 'Joystick',
      prefix: 'Joystick',
      description: 'An on-screen stick to steer a sprite.',
      help: 'Drive the joystick with a finger. Its direction goes from -1 to 1: dx to the right, dy downwards. Multiply it by a speed to move a sprite. On a computer, the keyboard drives it too (arrows, or W A S D and Z Q S D); two joysticks can be held at once, one finger each.',
      example: 'On every frame, set x speed of Sprite1 to dx of Joystick1 × 200',
      props: {
        x: 'x',
        y: 'y',
        size: 'size',
        color: 'color',
        keys: 'keyboard keys',
        dx: 'x direction',
        dy: 'y direction',
      },
      events: { move: 'when %1 moves', release: 'when %1 is released' },
      methods: {},
      enums: { keys: { none: 'None', arrows: 'Arrows', wasd: 'W A S D (or Z Q S D)' } },
      args: { dx: 'x direction', dy: 'y direction' },
    },
  },
})
