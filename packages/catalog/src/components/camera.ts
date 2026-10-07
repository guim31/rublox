import { errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { method, prop } from '../define.ts'

/** Takes a photo with the phone's own camera screen. */
export const Camera = defineComponent({
  type: 'Camera',
  category: 'device',
  icon: 'camera',
  visible: false,
  container: false,
  junior: true,
  props: {
    facing: prop.enum(['back', 'front'], { default: 'back', group: 'content', junior: true }),
    lastPhoto: prop.asset({ default: '', assetKind: 'image', group: 'content', state: true }),
  },
  events: errorEvent(),
  methods: { takePhoto: method({ junior: true, async: true, returns: 'asset' }) },
  strings: {
    fr: {
      label: 'Appareil photo',
      prefix: 'Photo',
      description: 'Prend une photo avec l’appareil du téléphone.',
      help: 'L’appareil photo ouvre la caméra du téléphone. La photo prise se met dans une Image ; si la personne annule, le résultat est vide.',
      example: 'Quand Bouton1 est cliqué, mettre Image1.image à prendre une photo avec Photo1',
      props: { facing: 'caméra', lastPhoto: 'dernière photo' },
      events: {},
      methods: { takePhoto: 'prendre une photo avec %1' },
      enums: { facing: { back: 'Arrière', front: 'Avant (selfie)' } },
    },
    en: {
      label: 'Camera',
      prefix: 'Camera',
      description: 'Takes a photo with the phone’s camera.',
      help: 'The camera opens the phone’s camera. Put the photo in an Image; if the person cancels, the result is empty.',
      example: 'When Button1 is clicked, set Image1.image to take a photo with Camera1',
      props: { facing: 'camera', lastPhoto: 'last photo' },
      events: {},
      methods: { takePhoto: 'take a photo with %1' },
      enums: { facing: { back: 'Back', front: 'Front (selfie)' } },
    },
  },
})
