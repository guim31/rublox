import { defineComponent } from '../component.ts'
import { method, prop } from '../define.ts'

export const PhotoPicker = defineComponent({
  type: 'PhotoPicker',
  category: 'device',
  icon: 'images',
  visible: false,
  container: false,
  junior: true,
  props: {
    lastPhoto: prop.asset({ default: '', assetKind: 'image', group: 'content', state: true }),
  },
  methods: { pick: method({ junior: true, async: true, returns: 'asset' }) },
  strings: {
    fr: {
      label: 'Choix de photo',
      prefix: 'Galerie',
      description: 'Choisit une photo du téléphone.',
      help: 'Le choix de photo ouvre la galerie du téléphone. La photo choisie se met dans une Image ; si la personne annule, le résultat est vide.',
      example: 'Mettre Image1.image à choisir une photo avec Galerie1',
      props: { lastPhoto: 'dernière photo' },
      events: {},
      methods: { pick: 'choisir une photo avec %1' },
      enums: {},
    },
    en: {
      label: 'Photo picker',
      prefix: 'Gallery',
      description: 'Picks a photo from the phone.',
      help: 'The photo picker opens the phone’s gallery. Put the chosen photo in an Image; if the person cancels, the result is empty.',
      example: 'Set Image1.image to pick a photo with Gallery1',
      props: { lastPhoto: 'last photo' },
      events: {},
      methods: { pick: 'pick a photo with %1' },
      enums: {},
    },
  },
})
