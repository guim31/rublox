import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

export const Location = defineComponent({
  type: 'Location',
  category: 'sensors',
  icon: 'map-pin',
  visible: false,
  container: false,
  junior: true,
  props: {
    watch: prop.boolean({ default: false, group: 'content', junior: true }),
    highAccuracy: prop.boolean({ default: true, group: 'advanced' }),
    latitude: prop.number({ default: 0, group: 'content', state: true }),
    longitude: prop.number({ default: 0, group: 'content', state: true }),
    accuracy: prop.number({ default: 0, group: 'content', state: true }),
    ...availableProp(),
  },
  events: {
    change: event({
      junior: true,
      args: { latitude: arg('number'), longitude: arg('number'), accuracy: arg('number') },
    }),
    ...errorEvent(),
  },
  methods: {
    update: method({ junior: true, async: true }),
    start: method(),
    stop: method(),
  },
  strings: {
    fr: {
      label: 'Localisation',
      prefix: 'Position',
      description: 'Où se trouve le téléphone (latitude, longitude).',
      help: 'La localisation donne la position du téléphone. Le téléphone demande l’autorisation la première fois ; si la personne refuse, l’événement « a un problème » le dit. « suivre » met à jour la position quand on bouge.',
      example: 'Quand Position1 change, mettre Texte1.texte à latitude de Position1',
      props: {
        watch: 'suivre en continu',
        highAccuracy: 'haute précision',
        latitude: 'latitude',
        longitude: 'longitude',
        accuracy: 'précision (mètres)',
      },
      events: { change: 'quand %1 change' },
      methods: {
        update: 'mettre à jour %1',
        start: 'suivre %1 en continu',
        stop: 'arrêter de suivre %1',
      },
      enums: {},
      args: { latitude: 'latitude', longitude: 'longitude', accuracy: 'précision' },
    },
    en: {
      label: 'Location',
      prefix: 'Location',
      description: 'Where the phone is (latitude, longitude).',
      help: 'Location gives the phone’s position. The phone asks for permission the first time; if the person refuses, the "has a problem" event says so. "follow" updates the position while moving.',
      example: 'When Location1 changes, set Text1.text to latitude of Location1',
      props: {
        watch: 'follow continuously',
        highAccuracy: 'high accuracy',
        latitude: 'latitude',
        longitude: 'longitude',
        accuracy: 'accuracy (meters)',
      },
      events: { change: 'when %1 changes' },
      methods: { update: 'update %1', start: 'follow %1 continuously', stop: 'stop following %1' },
      enums: {},
      args: { latitude: 'latitude', longitude: 'longitude', accuracy: 'accuracy' },
    },
  },
})
