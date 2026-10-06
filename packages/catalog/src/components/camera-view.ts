import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { method, prop } from '../define.ts'

/** The live picture of a camera, inside the screen. */
export const CameraView = defineComponent({
  type: 'CameraView',
  category: 'media',
  icon: 'camera',
  visible: true,
  container: false,
  junior: false,
  commonDefaults: { width: 'fill', height: 280, radius: 12, background: '#000000' },
  props: {
    facing: prop.enum(['back', 'front'], {
      default: 'back',
      group: 'content',
      junior: true,
      blocks: 'get-set',
    }),
    autostart: prop.boolean({ default: false, group: 'content', junior: true }),
    mirror: prop.boolean({ default: true, group: 'style' }),
    running: prop.boolean({ default: false, group: 'content', state: true }),
    ...availableProp(),
  },
  events: errorEvent(),
  methods: {
    start: method({ async: true }),
    stop: method(),
    takePhoto: method({ returns: 'asset' }),
  },
  strings: {
    fr: {
      label: 'Vue caméra',
      prefix: 'VueCamera',
      description: 'Montre ce que filme la caméra, dans l’écran.',
      help: 'Une vue caméra affiche l’image de la caméra en direct. Démarre-la avec son bloc : le téléphone demande l’autorisation la première fois. « prendre une photo » donne une image à mettre dans une Image.',
      example: 'Quand Bouton1 est cliqué, mettre Image1.image à prendre une photo avec VueCamera1',
      props: {
        facing: 'caméra',
        autostart: 'démarrer à l’ouverture',
        mirror: 'effet miroir (avant)',
        running: 'allumée',
      },
      events: {},
      methods: {
        start: 'démarrer %1',
        stop: 'éteindre %1',
        takePhoto: 'prendre une photo avec %1',
      },
      enums: { facing: { back: 'Arrière', front: 'Avant (selfie)' } },
    },
    en: {
      label: 'Camera view',
      prefix: 'CameraView',
      description: 'Shows what the camera films, inside the screen.',
      help: 'A camera view shows the camera’s live picture. Start it with its block: the phone asks for permission the first time. "take a photo" gives an image to put in an Image.',
      example: 'When Button1 is clicked, set Image1.image to take a photo with CameraView1',
      props: {
        facing: 'camera',
        autostart: 'start when the screen opens',
        mirror: 'mirror (front)',
        running: 'on',
      },
      events: {},
      methods: { start: 'start %1', stop: 'turn off %1', takePhoto: 'take a photo with %1' },
      enums: { facing: { back: 'Back', front: 'Front (selfie)' } },
    },
  },
})
