import type { Locale, ProjectDoc, Screen, UiMode } from '@rublox/schema'
import { createComponent, createProject } from '../project.ts'
import { getComponentDef, SCREEN_TYPE } from '../registry.ts'
import {
  bool,
  call,
  eventValue,
  get,
  join,
  log,
  num,
  on,
  openScreen,
  set,
  stacks,
  text,
  toast,
  variable,
} from './blocks.ts'

/** A component of the demo, with a fixed id (the blocks refer to it) and its children. */
type Spec = {
  id: string
  type: string
  props?: Record<string, unknown>
  children?: Spec[]
}

const c = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children?: Spec[],
): Spec => ({ id, type, props, children })

/** Builds a screen from specs: names come from the catalog prefixes, in the app's language. */
function buildScreen(
  locale: Locale,
  name: string,
  title: string,
  rootId: string,
  visual: Spec[],
  nonVisual: Spec[] = [],
): Screen {
  const components: Screen['components'] = {}
  const names = [name]
  const add = (spec: Spec): string => {
    const node = createComponent(spec.type, locale, names)
    names.push(node.name)
    node.props = { ...node.props, ...spec.props }
    if (spec.children) node.children = spec.children.map(add)
    components[spec.id] = node
    return spec.id
  }
  components[rootId] = {
    type: SCREEN_TYPE,
    name,
    props: { title },
    children: visual.map(add),
  }
  return { name, rootId, components, nonVisual: nonVisual.map(add) }
}

const TEXTS = {
  fr: {
    name: 'Démo du catalogue',
    home: 'Accueil',
    inputs: 'Saisie',
    lists: 'Listes',
    media: 'Medias',
    device: 'Appareil',
    sensors: 'Capteurs',
    homeTitle: 'Tous les composants',
    intro:
      '## Bienvenue !\nCette appli utilise **chaque composant** de Rublox. Les onglets du bas mènent aux autres écrans.\n- Touche les boutons\n- Regarde la console',
    visits: 'Visites sur ce téléphone : ',
    more: 'Encore',
    reset: 'Zéro',
    hello: 'Coucou',
    qr: 'https://example.com',
    star: 'Une étoile !',
    firstName: 'Ton prénom',
    agree: 'J’ai compris',
    sound: 'Son activé',
    chosen: 'Choisi : ',
    options: ['Pomme', 'Banane', 'Cerise'],
    list: ['Lundi', 'Mardi', 'Mercredi'],
    add: 'Ajouter',
    newItem: 'Nouveau jour',
    cards: [
      { image: '', title: 'Chat', subtitle: 'Il dort beaucoup' },
      { image: '', title: 'Chien', subtitle: 'Il aime courir' },
    ],
    tiles: [
      { image: '', title: 'Soleil', subtitle: '' },
      { image: '', title: 'Lune', subtitle: '' },
      { image: '', title: 'Étoile', subtitle: '' },
    ],
    see: 'Voir',
    cameraOn: 'Allumer la caméra',
    photo: 'Photo',
    clear: 'Effacer le dessin',
    ticks: 'Le minuteur a sonné : ',
    say: 'Parler',
    speech: 'Bonjour, je suis ton téléphone !',
    listen: 'Écouter',
    vibrate: 'Vibrer',
    takePhoto: 'Prendre une photo',
    pick: 'Choisir une photo',
    share: 'Partager',
    shareText: 'Regarde mon appli Rublox !',
    copy: 'Copier',
    notify: 'Notifier',
    notifyTitle: 'Rublox',
    notifyText: 'Une notification de la démo',
    scan: 'Scanner un QR code',
    record: 'Enregistrer 3 s',
    play: 'Jouer le son',
    goSensors: 'Voir les capteurs',
    where: 'Où suis-je ?',
    motion: 'Mouvement',
    shake: 'Secoué !',
    online: 'En ligne : ',
    battery: 'Batterie : ',
    result: 'Résultat',
    greet: 'Bonjour ',
  },
  en: {
    name: 'Catalog demo',
    home: 'Home',
    inputs: 'Inputs',
    lists: 'Lists',
    media: 'Media',
    device: 'Device',
    sensors: 'Sensors',
    homeTitle: 'Every component',
    intro:
      '## Welcome!\nThis app uses **every component** of Rublox. The tabs at the bottom lead to the other screens.\n- Tap the buttons\n- Look at the console',
    visits: 'Visits on this phone: ',
    more: 'More',
    reset: 'Zero',
    hello: 'Hello',
    qr: 'https://example.com',
    star: 'A star!',
    firstName: 'Your first name',
    agree: 'I understand',
    sound: 'Sound on',
    chosen: 'Chosen: ',
    options: ['Apple', 'Banana', 'Cherry'],
    list: ['Monday', 'Tuesday', 'Wednesday'],
    add: 'Add',
    newItem: 'New day',
    cards: [
      { image: '', title: 'Cat', subtitle: 'Sleeps a lot' },
      { image: '', title: 'Dog', subtitle: 'Loves to run' },
    ],
    tiles: [
      { image: '', title: 'Sun', subtitle: '' },
      { image: '', title: 'Moon', subtitle: '' },
      { image: '', title: 'Star', subtitle: '' },
    ],
    see: 'See',
    cameraOn: 'Turn the camera on',
    photo: 'Photo',
    clear: 'Clear the drawing',
    ticks: 'The timer rang: ',
    say: 'Speak',
    speech: 'Hello, I am your phone!',
    listen: 'Listen',
    vibrate: 'Vibrate',
    takePhoto: 'Take a photo',
    pick: 'Pick a photo',
    share: 'Share',
    shareText: 'Look at my Rublox app!',
    copy: 'Copy',
    notify: 'Notify',
    notifyTitle: 'Rublox',
    notifyText: 'A notification from the demo',
    scan: 'Scan a QR code',
    record: 'Record 3 s',
    play: 'Play the sound',
    goSensors: 'See the sensors',
    where: 'Where am I?',
    motion: 'Motion',
    shake: 'Shaken!',
    online: 'Online: ',
    battery: 'Battery: ',
    result: 'Result',
    greet: 'Hello ',
  },
} satisfies Record<Locale, unknown>

const button = (id: string, label: string, props: Record<string, unknown> = {}) =>
  c(id, 'Button', { text: label, ...props })

/**
 * An app that uses every component of the catalog, with blocks for each one: the checklist of
 * `docs/compatibilite.md` is run on it on real phones. Tabs navigation, a stored variable and
 * a function shared by the screens (app workspace) are in it too.
 */
export function createDemoProject(input: {
  locale: Locale
  mode: UiMode
  id?: string
  now?: Date
}): ProjectDoc {
  const L = TEXTS[input.locale]
  const doc = createProject({ name: L.name, ...input })
  const homeId = doc.screenOrder[0] ?? 'home'
  const ids = {
    home: homeId,
    inputs: 'inputs',
    lists: 'lists',
    media: 'media',
    device: 'device',
    sensors: 'sensors',
  }

  const home = buildScreen(input.locale, L.home, L.homeTitle, doc.screens[homeId]?.rootId ?? 'r1', [
    c('card', 'Box', {}, [
      c('richText', 'RichText', { text: L.intro }),
      c('visits', 'Text', { text: L.visits, bold: true }),
    ]),
    c('iconRow', 'Row', {}, [
      c('star', 'Icon', { icon: 'star', color: '#f5b400' }),
      c('space', 'Spacer', { grow: true }),
      c('heart', 'Icon', { icon: 'heart', color: '@secondary' }),
    ]),
    c('divider', 'Divider'),
    c('grid', 'Grid', { columns: 3 }, [
      button('more', L.more),
      button('reset', L.reset, { variant: 'outline' }),
      button('hello', L.hello, { variant: 'ghost' }),
    ]),
    c('progress', 'ProgressBar', { value: 30 }),
    c('row2', 'Row', { justify: 'between' }, [
      c('spinner', 'Spinner'),
      c('qr', 'QrCode', { text: L.qr, width: 120, height: 120 }),
    ]),
    c('picture', 'Image', { height: 120 }),
  ])

  const inputs = buildScreen(input.locale, L.inputs, L.inputs, 'r-inputs', [
    c('field', 'TextInput', { placeholder: L.firstName }),
    c('check', 'Checkbox', { text: L.agree }),
    c('switch', 'Switch', { text: L.sound, on: true }),
    c('slider', 'Slider', { value: 20 }),
    c('dropdown', 'Dropdown', { options: L.options }),
    c('when', 'Column', { gap: 8 }, [c('date', 'DatePicker'), c('time', 'TimePicker')]),
    c('rating', 'Rating', { value: 3 }),
    c('result', 'Text', { text: L.result, bold: true, align: 'center' }),
  ])

  const lists = buildScreen(input.locale, L.lists, L.lists, 'r-lists', [
    c('addRow', 'Row', {}, [
      c('newItem', 'TextInput', { placeholder: L.newItem, grow: true }),
      button('add', L.add),
    ]),
    c('list', 'ListView', { items: L.list }),
    c('cards', 'DataList', { items: L.cards, buttonText: L.see }),
    c('tiles', 'DataGrid', { items: L.tiles, columns: 3 }),
  ])

  const media = buildScreen(input.locale, L.media, L.media, 'r-media', [
    c('video', 'Video', { height: 140 }),
    c('lottie', 'Lottie', { width: 120, height: 120 }),
    c('web', 'WebView', { height: 160 }),
    c('camRow', 'Row', {}, [
      button('cameraOn', L.cameraOn, { grow: true }),
      button('photo', L.photo, { variant: 'outline' }),
    ]),
    c('cameraView', 'CameraView', { height: 160 }),
    c('snapshot', 'Image', { height: 100, fit: 'contain' }),
    c('canvas', 'Canvas', { height: 200 }),
    button('clear', L.clear, { variant: 'ghost' }),
  ])

  const deviceButtons: [string, string][] = [
    ['say', L.say],
    ['listen', L.listen],
    ['vibrate', L.vibrate],
    ['takePhoto', L.takePhoto],
    ['pick', L.pick],
    ['share', L.share],
    ['copy', L.copy],
    ['notify', L.notify],
    ['scan', L.scan],
    ['record', L.record],
    ['play', L.play],
    ['goSensors', L.goSensors],
  ]
  const device = buildScreen(
    input.locale,
    L.device,
    L.device,
    'r-device',
    [
      c('ticks', 'Text', { text: L.ticks }),
      c(
        'deviceGrid',
        'Grid',
        { columns: 2, gap: 8 },
        deviceButtons.map(([id, label]) => button(`b-${id}`, label, { fontSize: 14 })),
      ),
      c('deviceResult', 'Text', { text: L.result, align: 'center' }),
      c('photoResult', 'Image', { height: 100, fit: 'contain' }),
    ],
    [
      c('timer', 'Timer', { interval: 5 }),
      c('sound', 'Sound'),
      c('recorder', 'AudioRecorder'),
      c('voice', 'TextToSpeech'),
      c('listener', 'SpeechRecognition'),
      c('vibrator', 'Vibrator'),
      c('camera', 'Camera'),
      c('gallery', 'PhotoPicker'),
      c('share', 'Share'),
      c('clipboard', 'Clipboard'),
      c('notifier', 'Notifier'),
      c('scanner', 'QrScanner'),
    ],
  )

  const sensors = buildScreen(
    input.locale,
    L.sensors,
    L.sensors,
    'r-sensors',
    [
      button('where', L.where),
      c('position', 'Text', { text: '—' }),
      button('motionStart', L.motion, { variant: 'outline' }),
      c('tilt', 'Text', { text: '—' }),
      c('network', 'Text', { text: L.online }),
      c('battery', 'Text', { text: L.battery }),
    ],
    [
      c('location', 'Location'),
      c('motion', 'Motion'),
      c('batteryInfo', 'Battery'),
      c('net', 'Network'),
    ],
  )

  doc.screenOrder = [homeId, ids.inputs, ids.lists, ids.media, ids.device, ids.sensors]
  doc.screens = {
    [homeId]: home,
    [ids.inputs]: inputs,
    [ids.lists]: lists,
    [ids.media]: media,
    [ids.device]: device,
    [ids.sensors]: sensors,
  }
  doc.settings.navigation = {
    kind: 'tabs',
    startScreen: homeId,
    items: [
      { screen: homeId, icon: 'house' },
      { screen: ids.inputs, icon: 'pencil' },
      { screen: ids.lists, icon: 'list' },
      { screen: ids.media, icon: 'film' },
      { screen: ids.device, icon: 'smartphone' },
    ],
  }
  doc.variables.stored.push({
    id: 'visits',
    name: input.locale === 'fr' ? 'visites' : 'visits',
    initial: 0,
  })

  // The app workspace: count the visits (kept on the phone) and a function every screen calls.
  doc.blocks.app = stacks(
    {
      type: 'rx_app_start',
      x: 20,
      y: 20,
      inputs: {
        DO: {
          block: {
            type: 'math_change',
            fields: { VAR: { id: 'visits' } },
            inputs: { DELTA: { block: num(1) } },
          },
        },
      },
    },
    {
      type: 'procedures_defreturn',
      x: 20,
      y: 200,
      extraState: { params: [{ name: 'who', id: 'p-who' }] },
      fields: { NAME: 'greet' },
      inputs: { RETURN: { block: join(text(L.greet), variable('p-who')) } },
    },
  )

  const greet = (value: ReturnType<typeof text>) => ({
    type: 'rx_app_call_value',
    fields: { FUNCTION: 'greet' },
    extraState: { params: ['who'] },
    inputs: { ARG0: { block: value } },
  })
  const root = (screen: Screen) => screen.rootId
  const result = (value: ReturnType<typeof text>) => set('Text', 'result', 'text', value)

  doc.blocks[homeId] = stacks(
    on('Screen', 'open', root(home), [
      set('Text', 'visits', 'text', join(text(L.visits), variable('visits'))),
    ]),
    on('Button', 'click', 'more', [
      set('ProgressBar', 'progress', 'value', {
        type: 'math_arithmetic',
        fields: { OP: 'ADD' },
        inputs: {
          A: { block: get('ProgressBar', 'progress', 'value') },
          B: { block: num(10) },
        },
      }),
    ]),
    on('Button', 'click', 'reset', [set('ProgressBar', 'progress', 'value', num(0))]),
    on('Button', 'click', 'hello', [toast(greet(text('Rublox')))]),
    on('Icon', 'click', 'star', [toast(text(L.star))]),
    on('Icon', 'click', 'heart', [set('Icon', 'heart', 'size', num(48))]),
    on('Box', 'click', 'card', [log(text(L.homeTitle))]),
    on('QrCode', 'click', 'qr', [log(get('QrCode', 'qr', 'text'))]),
  )

  doc.blocks[ids.inputs] = stacks(
    on('TextInput', 'change', 'field', [result(greet(get('TextInput', 'field', 'text')))]),
    on('Checkbox', 'change', 'check', [
      result(join(text(L.agree), text(' : '), eventValue('checked'))),
    ]),
    on('Switch', 'change', 'switch', [result(join(text(L.sound), text(' : '), eventValue('on')))]),
    on('Slider', 'change', 'slider', [result(eventValue('value'))]),
    on('Dropdown', 'change', 'dropdown', [result(join(text(L.chosen), eventValue('value')))]),
    on('DatePicker', 'change', 'date', [result(eventValue('value'))]),
    on('TimePicker', 'change', 'time', [result(eventValue('value'))]),
    on('Rating', 'change', 'rating', [result(join(eventValue('value'), text(' ★')))]),
  )

  doc.blocks[ids.lists] = stacks(
    on('Button', 'click', 'add', [
      call('ListView', 'list', 'addItem', [get('TextInput', 'newItem', 'text')]),
      call('TextInput', 'newItem', 'clear'),
    ]),
    on('ListView', 'itemClick', 'list', [
      toast(join(eventValue('index'), text(' · '), eventValue('item'))),
    ]),
    on('DataList', 'itemClick', 'cards', [toast(eventValue('subtitle'))]),
    on('DataList', 'buttonClick', 'cards', [toast(eventValue('title'))]),
    on('DataGrid', 'itemClick', 'tiles', [toast(eventValue('title'))]),
  )

  doc.blocks[ids.media] = stacks(
    on('Button', 'click', 'cameraOn', [call('CameraView', 'cameraView', 'start')]),
    on('Button', 'click', 'photo', [
      set('Image', 'snapshot', 'src', call('CameraView', 'cameraView', 'takePhoto')),
    ]),
    on('CameraView', 'error', 'cameraView', [toast(eventValue('message'))]),
    on('Canvas', 'touch', 'canvas', [
      call('Canvas', 'canvas', 'drawCircle', [eventValue('x'), eventValue('y'), num(12)]),
    ]),
    on('Button', 'click', 'clear', [call('Canvas', 'canvas', 'clear')]),
    on('Video', 'ended', 'video', [log(text('video'))]),
    on('Lottie', 'complete', 'lottie', [log(text('lottie'))]),
    on('WebView', 'load', 'web', [log(get('WebView', 'web', 'url'))]),
  )

  const deviceResult = (value: ReturnType<typeof text>) =>
    set('Text', 'deviceResult', 'text', value)
  const error = (type: string, id: string) =>
    on(type, 'error', id, [deviceResult(eventValue('message'))])
  doc.blocks[ids.device] = stacks(
    on('Timer', 'tick', 'timer', [
      set('Text', 'ticks', 'text', join(text(L.ticks), eventValue('count'))),
    ]),
    on('Button', 'click', 'b-say', [call('TextToSpeech', 'voice', 'say', [text(L.speech)])]),
    on('Button', 'click', 'b-listen', [
      deviceResult(call('SpeechRecognition', 'listener', 'listen')),
    ]),
    on('Button', 'click', 'b-vibrate', [call('Vibrator', 'vibrator', 'vibrate', [num(0.3)])]),
    on('Button', 'click', 'b-takePhoto', [
      set('Image', 'photoResult', 'src', call('Camera', 'camera', 'takePhoto')),
    ]),
    on('Button', 'click', 'b-pick', [
      set('Image', 'photoResult', 'src', call('PhotoPicker', 'gallery', 'pick')),
    ]),
    on('Button', 'click', 'b-share', [
      call('Share', 'share', 'share', [text(L.shareText), text('https://example.com')]),
    ]),
    on('Button', 'click', 'b-copy', [
      call('Clipboard', 'clipboard', 'copy', [text(L.shareText)]),
      toast(call('Clipboard', 'clipboard', 'paste')),
    ]),
    on('Button', 'click', 'b-notify', [
      call('Notifier', 'notifier', 'notify', [text(L.notifyTitle), text(L.notifyText)]),
    ]),
    on('Button', 'click', 'b-scan', [deviceResult(call('QrScanner', 'scanner', 'scan'))]),
    on('Button', 'click', 'b-record', [
      call('AudioRecorder', 'recorder', 'start'),
      { type: 'rx_wait', inputs: { SECONDS: { block: num(3) } } },
      set('Sound', 'sound', 'src', call('AudioRecorder', 'recorder', 'stop')),
    ]),
    on('Button', 'click', 'b-play', [call('Sound', 'sound', 'play')]),
    on('Button', 'click', 'b-goSensors', [openScreen(ids.sensors)]),
    on('Sound', 'ended', 'sound', [log(text('sound'))]),
    on('AudioRecorder', 'done', 'recorder', [log(eventValue('sound'))]),
    on('SpeechRecognition', 'result', 'listener', [log(eventValue('text'))]),
    on('QrScanner', 'scan', 'scanner', [log(eventValue('text'))]),
    on('Notifier', 'click', 'notifier', [log(text(L.notify))]),
    error('Sound', 'sound'),
    error('AudioRecorder', 'recorder'),
    error('TextToSpeech', 'voice'),
    error('SpeechRecognition', 'listener'),
    error('Vibrator', 'vibrator'),
    error('Camera', 'camera'),
    error('Share', 'share'),
    error('Clipboard', 'clipboard'),
    error('Notifier', 'notifier'),
    error('QrScanner', 'scanner'),
  )

  const position = (value: ReturnType<typeof text>) => set('Text', 'position', 'text', value)
  doc.blocks[ids.sensors] = stacks(
    on('Screen', 'open', root(sensors), [
      set('Text', 'network', 'text', join(text(L.online), get('Network', 'net', 'online'))),
      set(
        'Text',
        'battery',
        'text',
        join(text(L.battery), get('Battery', 'batteryInfo', 'level'), text(' %')),
      ),
    ]),
    on('Button', 'click', 'where', [call('Location', 'location', 'update')]),
    on('Location', 'change', 'location', [
      position(join(eventValue('latitude'), text(', '), eventValue('longitude'))),
    ]),
    on('Location', 'error', 'location', [position(eventValue('message'))]),
    on('Button', 'click', 'motionStart', [call('Motion', 'motion', 'start')]),
    on('Motion', 'change', 'motion', [
      set(
        'Text',
        'tilt',
        'text',
        join(
          get('Motion', 'motion', 'beta'),
          text('° / '),
          get('Motion', 'motion', 'gamma'),
          text('°'),
        ),
      ),
    ]),
    on('Motion', 'shake', 'motion', [toast(text(L.shake))]),
    on('Motion', 'error', 'motion', [set('Text', 'tilt', 'text', eventValue('message'))]),
    on('Battery', 'change', 'batteryInfo', [
      set(
        'Text',
        'battery',
        'text',
        join(text(L.battery), get('Battery', 'batteryInfo', 'level'), text(' %')),
      ),
    ]),
    on('Network', 'online', 'net', [
      set('Text', 'network', 'text', join(text(L.online), bool(true))),
    ]),
    on('Network', 'offline', 'net', [
      set('Text', 'network', 'text', join(text(L.online), bool(false))),
    ]),
  )
  return doc
}

/** Component types the demo does not use: empty when it covers the whole palette. */
export function typesMissingFromDemo(doc: ProjectDoc, types: readonly string[]): string[] {
  const used = new Set(
    Object.values(doc.screens).flatMap((screen) =>
      Object.values(screen.components).map((n) => n.type),
    ),
  )
  return types.filter((type) => getComponentDef(type)?.palette !== false && !used.has(type))
}
