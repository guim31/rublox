import { availableProp, errorEvent } from '../common.ts'
import { defineComponent } from '../component.ts'
import { arg, event, method, prop } from '../define.ts'

export const AudioRecorder = defineComponent({
  type: 'AudioRecorder',
  category: 'device',
  icon: 'mic',
  visible: false,
  container: false,
  junior: false,
  props: {
    recording: prop.boolean({ default: false, group: 'content', state: true }),
    lastRecording: prop.asset({ default: '', assetKind: 'sound', group: 'content', state: true }),
    ...availableProp(),
  },
  events: { done: event({ args: { sound: arg('asset') } }), ...errorEvent() },
  methods: {
    start: method({ async: true }),
    stop: method({ async: true, returns: 'asset' }),
  },
  strings: {
    fr: {
      label: 'Enregistreur audio',
      prefix: 'Enregistreur',
      description: 'Enregistre la voix avec le micro.',
      help: 'Un enregistreur capte le son du micro. « arrêter » donne l’enregistrement : mets-le dans un Son pour l’écouter. Le téléphone demande l’autorisation du micro la première fois.',
      example: 'Mettre Son1.son à arrêter Enregistreur1',
      props: { recording: 'en train d’enregistrer', lastRecording: 'dernier enregistrement' },
      events: { done: 'quand %1 a fini d’enregistrer' },
      methods: { start: 'commencer à enregistrer avec %1', stop: 'arrêter %1' },
      enums: {},
      args: { sound: 'son' },
    },
    en: {
      label: 'Audio recorder',
      prefix: 'Recorder',
      description: 'Records a voice with the microphone.',
      help: 'A recorder captures the microphone’s sound. "stop" gives the recording: put it in a Sound to listen to it. The phone asks for microphone permission the first time.',
      example: 'Set Sound1.sound to stop Recorder1',
      props: { recording: 'recording', lastRecording: 'last recording' },
      events: { done: 'when %1 has finished recording' },
      methods: { start: 'start recording with %1', stop: 'stop %1' },
      enums: {},
      args: { sound: 'sound' },
    },
  },
})
