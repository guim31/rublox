import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { event, method, prop } from '../define.ts'

/** Accelerometer, gyroscope and orientation of the phone. */
export const Motion = defineComponent({
  type: 'Motion',
  category: 'sensors',
  icon: 'move-3d',
  visible: false,
  container: false,
  junior: true,
  props: {
    x: prop.number({ default: 0, group: 'content', state: true }),
    y: prop.number({ default: 0, group: 'content', state: true }),
    z: prop.number({ default: 0, group: 'content', state: true }),
    alpha: prop.number({ default: 0, group: 'content', state: true }),
    beta: prop.number({ default: 0, group: 'content', state: true }),
    gamma: prop.number({ default: 0, group: 'content', state: true }),
    ...availableProp(),
  },
  events: { change: event(), shake: event({ junior: true }), ...errorEvent() },
  methods: { start: method({ junior: true, async: true }), stop: method() },
  strings: {
    fr: {
      label: 'Mouvement',
      prefix: 'Mouvement',
      description: 'Les secousses et l’inclinaison du téléphone.',
      help: 'Le mouvement lit l’accéléromètre (x, y, z en m/s²) et l’orientation (alpha, bêta, gamma en degrés). Démarre-le avec son bloc, depuis un bouton : sur iPhone, l’autorisation se demande au premier toucher.',
      example: 'Quand Mouvement1 est secoué, mettre Texte1.texte à entier aléatoire de 1 à 6',
      props: {
        x: 'accélération x',
        y: 'accélération y',
        z: 'accélération z',
        alpha: 'orientation alpha (boussole)',
        beta: 'inclinaison avant-arrière (bêta)',
        gamma: 'inclinaison gauche-droite (gamma)',
      },
      events: { change: 'quand %1 change', shake: 'quand %1 est secoué' },
      methods: { start: 'démarrer %1', stop: 'arrêter %1' },
      enums: {},
    },
    en: {
      label: 'Motion',
      prefix: 'Motion',
      description: 'The phone’s shakes and tilt.',
      help: 'Motion reads the accelerometer (x, y, z in m/s²) and the orientation (alpha, beta, gamma in degrees). Start it with its block, from a button: on iPhone, permission is asked on the first tap.',
      example: 'When Motion1 is shaken, set Text1.text to random integer from 1 to 6',
      props: {
        x: 'acceleration x',
        y: 'acceleration y',
        z: 'acceleration z',
        alpha: 'orientation alpha (compass)',
        beta: 'front-back tilt (beta)',
        gamma: 'left-right tilt (gamma)',
      },
      events: { change: 'when %1 changes', shake: 'when %1 is shaken' },
      methods: { start: 'start %1', stop: 'stop %1' },
      enums: {},
    },
  },
})
