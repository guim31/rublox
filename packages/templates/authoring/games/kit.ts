import {
  type Block,
  bool,
  call,
  cmp,
  fn,
  join,
  note,
  num,
  on,
  or,
  run,
  set,
  setVar,
  str,
  type Text,
  v,
  when,
} from '../dsl.ts'
import { COMMON_SOUNDS } from './sfx.ts'
import { button, panel } from './svg.ts'
import type { ArtSource, ComponentSource, SoundSource } from './types.ts'

/**
 * What every game template shares (J10): a title screen (name, "Play", best score), the game,
 * an end screen ("Play again"), the best score kept on the phone, and their blocks, written
 * once here so that the six games read the same way. The title and the end are drawn in the
 * scene, above the game: starting again is instant.
 */

export const FN = {
  settings: { fr: 'réglages', en: 'settings' },
  title: { fr: 'montrer l’écran titre', en: 'show the title screen' },
  start: { fr: 'lancer la partie', en: 'start a game' },
  end: { fr: 'finir la partie', en: 'end the game' },
  score: { fr: 'afficher le score', en: 'show the score' },
}

/** The variables of every game: the score, the best one (kept on the phone), the state. */
export const KIT_VARIABLES = [
  { key: 'score', name: { fr: 'score', en: 'score' }, initial: 0 },
  { key: 'best', name: { fr: 'record', en: 'best' }, kind: 'stored' as const, initial: 0 },
  { key: 'state', name: { fr: 'étape', en: 'stage' }, initial: 'title' },
]

/**
 * The values of `state`: on the title screen, playing, just lost (a short pause before the
 * end screen), on the end screen.
 */
export const STATE = { title: 'title', play: 'play', lost: 'lost', over: 'over' }

export const CHANGE_ME = {
  fr: 'Change-moi ! Ces nombres règlent le jeu : essaie d’autres valeurs.',
  en: 'Change me! These numbers tune the game: try other values.',
}

export type KitOptions = {
  scene: string
  /** The game's name, big on the title screen. */
  title: Text
  /** How to play, under the name. */
  hint: Text
  /** What the end screen says. */
  overTitle: Text
  /** Colours of the texts on the game's background. */
  textColor: string
  /** Colours of the buttons and of the end panel. */
  buttonColor: [string, string]
  panelColor: [string, string]
  /** Where the title and its hint stand (y). */
  titleY?: number
  titleSize?: number
  /** How far under the title the hint stands. */
  hintGap?: number
  /** Where the score stands during a game (y), and its colour. */
  scoreY?: number
  scoreColor?: string
  /** Where the best score stands on the title screen (y). */
  bestY?: number
  /** A light glow around the texts (for dark texts); off for light texts on a dark game. */
  glow?: boolean
}

const PLAY = { fr: 'Jouer', en: 'Play' }
const AGAIN = { fr: 'Rejouer', en: 'Play again' }
const BEST = { fr: 'Record : ', en: 'Best: ' }
const SCORE = { fr: 'Score : ', en: 'Score: ' }

const TITLE_GROUP = ['titleText', 'hintText', 'playButton', 'playLabel', 'bestText']
const OVER_GROUP = ['panel', 'overText', 'finalText', 'recordText', 'replayButton', 'replayLabel']

const text = (
  key: string,
  name: Text,
  value: Text,
  x: number,
  y: number,
  size: number,
  color: string,
  extra: Record<string, unknown> = {},
): ComponentSource => ({
  key,
  type: 'SceneText',
  name,
  props: { text: value, x, y, fontSize: size, color, ...extra },
})

/** Texts drawn on the game itself (not on a button or the panel) follow the `glow` option. */
const onGame = (o: KitOptions) => (o.glow === false ? { outline: false } : {})

/** The texts and buttons of the title and end screens, to put last in the scene (in front). */
export function kitComponents(o: KitOptions): ComponentSource[] {
  const titleY = o.titleY ?? 190
  return [
    text(
      'scoreText',
      { fr: 'TexteScore', en: 'ScoreText' },
      '0',
      180,
      o.scoreY ?? 56,
      44,
      o.scoreColor ?? o.textColor,
      {
        ...onGame(o),
        visible: false,
      },
    ),
    text(
      'titleText',
      { fr: 'TexteTitre', en: 'TitleText' },
      o.title,
      180,
      titleY,
      o.titleSize ?? 42,
      o.textColor,
      onGame(o),
    ),
    text(
      'hintText',
      { fr: 'TexteAide', en: 'HintText' },
      o.hint,
      180,
      titleY + (o.hintGap ?? 62),
      19,
      o.textColor,
      {
        ...onGame(o),
        bold: false,
      },
    ),
    {
      key: 'playButton',
      type: 'Sprite',
      name: { fr: 'BoutonJouer', en: 'PlayButton' },
      props: {
        costumes: ['asset:button'],
        x: 180,
        y: 470,
        width: 220,
        height: 80,
        collision: 'none',
      },
    },
    text('playLabel', { fr: 'TexteJouer', en: 'PlayLabel' }, PLAY, 180, 466, 32, '#ffffff', {
      outline: false,
    }),
    text(
      'bestText',
      { fr: 'TexteRecord', en: 'BestText' },
      '',
      180,
      o.bestY ?? 550,
      22,
      o.textColor,
      onGame(o),
    ),
    {
      key: 'panel',
      type: 'Sprite',
      name: { fr: 'Panneau', en: 'Panel' },
      props: {
        costumes: ['asset:panel'],
        x: 180,
        y: 360,
        width: 300,
        height: 340,
        collision: 'none',
        visible: false,
      },
    },
    text('overText', { fr: 'TexteFin', en: 'EndText' }, o.overTitle, 180, 245, 36, '#2d1f3d', {
      visible: false,
      outline: false,
    }),
    text(
      'finalText',
      { fr: 'TexteScoreFinal', en: 'FinalScoreText' },
      SCORE,
      180,
      308,
      28,
      '#2d1f3d',
      {
        visible: false,
        outline: false,
      },
    ),
    text('recordText', { fr: 'TexteMeilleur', en: 'RecordText' }, BEST, 180, 352, 22, '#2d1f3d', {
      visible: false,
      outline: false,
      bold: false,
    }),
    {
      key: 'replayButton',
      type: 'Sprite',
      name: { fr: 'BoutonRejouer', en: 'AgainButton' },
      props: {
        costumes: ['asset:button'],
        x: 180,
        y: 480,
        width: 220,
        height: 80,
        collision: 'none',
        visible: false,
      },
    },
    text('replayLabel', { fr: 'TexteRejouer', en: 'AgainLabel' }, AGAIN, 180, 476, 30, '#ffffff', {
      visible: false,
      outline: false,
    }),
  ]
}

/** The sounds every game has: a click, the end of a game, a new record. */
export function kitSounds(): Record<string, SoundSource> {
  return {
    click: { name: { fr: 'clic', en: 'click' }, wav: COMMON_SOUNDS.click() },
    over: { name: { fr: 'fin de partie', en: 'game over' }, wav: COMMON_SOUNDS.gameOver() },
    record: { name: { fr: 'nouveau record', en: 'new record' }, wav: COMMON_SOUNDS.win() },
  }
}

export const kitSoundComponents = (): ComponentSource[] => [
  {
    key: 'sndClick',
    type: 'Sound',
    name: { fr: 'SonClic', en: 'ClickSound' },
    props: { src: 'asset:click' },
  },
  {
    key: 'sndOver',
    type: 'Sound',
    name: { fr: 'SonFin', en: 'OverSound' },
    props: { src: 'asset:over' },
  },
  {
    key: 'sndRecord',
    type: 'Sound',
    name: { fr: 'SonRecord', en: 'RecordSound' },
    props: { src: 'asset:record' },
  },
]

export function kitArt(o: KitOptions): Record<string, ArtSource> {
  return {
    button: { name: { fr: 'bouton', en: 'button' }, svg: button(220, 80, ...o.buttonColor) },
    panel: { name: { fr: 'panneau', en: 'panel' }, svg: panel(300, 340, ...o.panelColor) },
  }
}

const show = (prefix: string, keys: string[], value: boolean, kinds: Record<string, string>) =>
  keys.map((key) => set(`${prefix}-${key}`, kinds[key] ?? 'SceneText', key, 'visible', bool(value)))

const KINDS: Record<string, string> = {
  playButton: 'Sprite',
  replayButton: 'Sprite',
  panel: 'Sprite',
}

/**
 * The functions every game has. `onTitle`, `onStart` and `onEnd` are the game's own blocks,
 * run after the shared ones (place the hero, build the level, stop the timers…).
 */
export function kitBlocks(o: {
  scene: string
  onTitle: Block[]
  onStart: Block[]
  onEnd: Block[]
  /** Run last at the end of a game (the texts of the end screen may be changed there). */
  afterEnd?: Block[]
  /** Without a best score (a game for two): the end screen says who won instead. */
  noRecord?: boolean
  /** The score's text: the number alone by default. */
  scoreText?: Block[]
}): Block[] {
  return [
    note(
      fn('k-title', FN.title, [
        setVar('k-title-state', 'state', str(STATE.title)),
        ...show('k-title-hide', OVER_GROUP, false, KINDS),
        ...show('k-title-show', TITLE_GROUP, true, KINDS),
        set('k-title-score', 'SceneText', 'scoreText', 'visible', bool(false)),
        set('k-title-best', 'SceneText', 'bestText', 'text', join(str(BEST), v('best'))),
        ...o.onTitle,
      ]),
      {
        fr: 'L’écran titre : le nom du jeu, « Jouer » et le record.',
        en: 'The title screen: the game’s name, "Play" and the best score.',
      },
    ),
    note(
      fn('k-start', FN.start, [
        call('k-start-click', 'Sound', 'sndClick', 'play'),
        setVar('k-start-state', 'state', str(STATE.play)),
        setVar('k-start-score', 'score', num(0)),
        ...show('k-start-hide', TITLE_GROUP, false, KINDS),
        ...show('k-start-hide-over', OVER_GROUP, false, KINDS),
        set('k-start-score-text', 'SceneText', 'scoreText', 'visible', bool(true)),
        run('k-start-show', FN.score),
        ...o.onStart,
      ]),
      {
        fr: 'Une nouvelle partie : tout recommence à zéro.',
        en: 'A new game: everything starts again from zero.',
      },
    ),
    note(
      fn('k-end', FN.end, [
        setVar('k-end-state', 'state', str(STATE.over)),
        ...o.onEnd,
        ...(o.noRecord
          ? []
          : [
              when(
                'k-end-record',
                cmp(v('score'), '>', v('best')),
                [
                  note(setVar('k-end-best', 'best', v('score')), {
                    fr: 'Le record est une variable stockée : il reste sur le téléphone.',
                    en: 'The best score is a stored variable: it stays on the phone.',
                  }),
                  call('k-end-record-sound', 'Sound', 'sndRecord', 'play'),
                ],
                [call('k-end-over-sound', 'Sound', 'sndOver', 'play')],
              ),
              set('k-end-final', 'SceneText', 'finalText', 'text', join(str(SCORE), v('score'))),
              set(
                'k-end-record-text',
                'SceneText',
                'recordText',
                'text',
                join(str(BEST), v('best')),
              ),
            ]),
        ...(o.afterEnd ?? []),
        ...show('k-end-show', OVER_GROUP, true, KINDS),
      ]),
      {
        fr: 'Fin de la partie : le score, le record, et « Rejouer ».',
        en: 'End of the game: the score, the best one, and "Play again".',
      },
    ),
    fn(
      'k-score',
      FN.score,
      o.scoreText ?? [set('k-score-text', 'SceneText', 'scoreText', 'text', v('score'))],
    ),
    on('k-play', 'Sprite', 'playButton', 'tap', [
      when('k-play-if', cmp(v('state'), '=', str(STATE.title)), [run('k-play-start', FN.start)]),
    ]),
    on('k-again', 'Sprite', 'replayButton', 'tap', [
      when('k-again-if', cmp(v('state'), '=', str(STATE.over)), [run('k-again-start', FN.start)]),
    ]),
    note(
      on(
        'k-enter',
        'GameScene',
        o.scene,
        'keyDown',
        [
          when(
            'k-enter-if',
            or(cmp(v('state'), '=', str(STATE.title)), cmp(v('state'), '=', str(STATE.over))),
            [run('k-enter-start', FN.start)],
          ),
        ],
        'enter',
      ),
      {
        fr: 'Sur un ordinateur, Entrée lance une partie.',
        en: 'On a computer, Enter starts a game.',
      },
    ),
  ]
}
