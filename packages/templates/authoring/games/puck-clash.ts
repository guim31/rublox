import {
  and,
  type Block,
  bool,
  call,
  change,
  choose,
  cmp,
  fn,
  join,
  math,
  note,
  num,
  on,
  prop,
  random,
  run,
  set,
  setVar,
  sqrt,
  str,
  v,
  wait,
  when,
} from '../dsl.ts'
import {
  CHANGE_ME,
  FN,
  KIT_VARIABLES,
  kitArt,
  kitBlocks,
  kitComponents,
  kitSoundComponents,
  kitSounds,
  STATE,
} from './kit.ts'
import { melody, wav } from './sfx.ts'
import { coverStyle, embed, INK, ink, rgradient, svg, vgradient } from './svg.ts'
import type { GameSource } from './types.ts'

/**
 * Palet Éclair (Puck Clash): air hockey for two on the same phone, each holding one end. Two
 * joysticks steer the bats at the same time (one finger each, or W A S D and the arrows); the
 * puck bounces off the edges; the first to 7 goals wins. The number of wins of each colour is
 * kept on the phone.
 */

// Pictures

function rink(): string {
  const dots = Array.from({ length: 11 }, (_, i) => i * 64 + 40)
    .map(
      (y) =>
        `<circle cx="8" cy="${y}" r="2.5" fill="#7cf6ff"/><circle cx="352" cy="${y}" r="2.5" fill="#ff8ad8"/>`,
    )
    .join('')
  const holes: string[] = []
  for (let y = 36; y < 700; y += 36) {
    for (let x = 36; x < 340; x += 36)
      holes.push(`<circle cx="${x + ((y / 36) % 2) * 18}" cy="${y}" r="1.6" fill="#9fc6e8"/>`)
  }
  return svg(
    360,
    720,
    `<rect width="360" height="720" fill="#14193a"/>` +
      `<rect x="12" y="12" width="336" height="696" rx="36" fill="url(#ice)" stroke="#2a3366" stroke-width="6"/>` +
      holes.join('') +
      `<line x1="12" y1="360" x2="348" y2="360" stroke="#8a7cff" stroke-width="5"/>` +
      `<circle cx="180" cy="360" r="62" fill="none" stroke="#8a7cff" stroke-width="5"/>` +
      `<circle cx="180" cy="360" r="8" fill="#8a7cff"/>` +
      `<path d="M100 12 A80 80 0 0 0 260 12" fill="#ffd6ef" fill-opacity="0.5" stroke="#ff5bb5" stroke-width="5"/>` +
      `<path d="M100 708 A80 80 0 0 1 260 708" fill="#d6f6ff" fill-opacity="0.5" stroke="#36c9ff" stroke-width="5"/>` +
      `<rect x="118" y="2" width="124" height="14" rx="7" fill="#05081c" stroke="#ff5bb5" stroke-width="3"/>` +
      `<rect x="118" y="704" width="124" height="14" rx="7" fill="#05081c" stroke="#36c9ff" stroke-width="3"/>` +
      dots,
    vgradient('ice', [
      [0, '#eef3ff'],
      [0.5, '#ffffff'],
      [1, '#eaf7ff'],
    ]),
  )
}

function bat(color: string, dark: string, light: string): string {
  return svg(
    80,
    80,
    `<circle cx="40" cy="43" r="36" fill="${INK}" opacity="0.25"/>` +
      `<circle cx="40" cy="40" r="36" fill="url(#rim)" ${ink(3)}/>` +
      `<circle cx="40" cy="40" r="24" fill="${dark}" ${ink(2.5)}/>` +
      `<circle cx="40" cy="38" r="15" fill="url(#knob)" ${ink(3)}/>` +
      `<ellipse cx="34" cy="31" rx="6" ry="3.5" fill="#fff" opacity="0.7"/>`,
    rgradient('rim', [
      [0, light],
      [0.7, color],
      [1, dark],
    ]) +
      rgradient('knob', [
        [0, '#ffffff'],
        [0.5, light],
        [1, color],
      ]),
  )
}

function puck(glow: boolean): string {
  return svg(
    48,
    48,
    (glow ? `<circle cx="24" cy="24" r="23" fill="#ffe066" opacity="0.6"/>` : '') +
      `<circle cx="24" cy="24" r="19" fill="url(#p)" ${ink(3)}/>` +
      `<circle cx="24" cy="24" r="12" fill="none" stroke="#ffe066" stroke-width="3"/>` +
      `<ellipse cx="18" cy="17" rx="5" ry="3" fill="#fff" opacity="0.5"/>`,
    rgradient('p', [
      [0, '#5a5f7d'],
      [1, '#1c1f33'],
    ]),
  )
}

function spark(): string {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return `<path d="M${(32 + Math.cos(a) * 10).toFixed(1)} ${(32 + Math.sin(a) * 10).toFixed(1)} L${(32 + Math.cos(a) * 28).toFixed(1)} ${(32 + Math.sin(a) * 28).toFixed(1)}" stroke="#ffe066" stroke-width="5" stroke-linecap="round"/>`
  }).join('')
  return svg(64, 64, `${rays}<circle cx="32" cy="32" r="8" fill="#fff"/>`)
}

const ART = {
  rink: rink(),
  'bat-blue': bat('#2b9cff', '#0b5bb5', '#a6e1ff'),
  'bat-red': bat('#ff4f8b', '#b51d55', '#ffc2dc'),
  puck: puck(false),
  'puck-glow': puck(true),
  spark: spark(),
}

function cover(): string {
  return svg(
    340,
    220,
    coverStyle(
      '.puck { animation: zig 1.6s linear infinite; } ' +
        '.blue { animation: hitb 1.6s ease-in-out infinite; } .red { animation: hitr 1.6s ease-in-out infinite; } ' +
        '@keyframes zig { 0% { transform: translate(0, 0); } 25% { transform: translate(90px, -70px); } 50% { transform: translate(0, -140px); } 75% { transform: translate(-90px, -70px); } 100% { transform: translate(0, 0); } } ' +
        '@keyframes hitb { 0%, 100% { transform: translate(0, 8px); } 50% { transform: translate(0, -6px); } } ' +
        '@keyframes hitr { 0%, 100% { transform: translate(0, -6px); } 50% { transform: translate(0, 8px); } }',
    ) +
      `<g transform="rotate(-90 170 110)">${embed(ART.rink, -10, -63, 360, 346, 'rink')}</g>` +
      `<g class="puck">${embed(ART.puck, 150, 160, 40, 40, 'p')}</g>` +
      `<g class="blue">${embed(ART['bat-blue'], 140, 172, 60, 60, 'b')}</g>` +
      `<g class="red">${embed(ART['bat-red'], 140, -10, 60, 60, 'r')}</g>`,
  )
}

// Recipe

const scene = 'table'
const SERVE = { fr: 'remettre le palet', en: 'put the puck back' }
const GOAL = { fr: 'marquer un but', en: 'score a goal' }
const STEER = { fr: 'diriger les maillets', en: 'steer the bats' }
const LIMIT = { fr: 'garder le palet sous contrôle', en: 'keep the puck under control' }
const SCORES = { fr: 'afficher les buts', en: 'show the goals' }
const WINS = { fr: 'Victoires : Bleu ', en: 'Wins: Blue ' }
const RED = { fr: ' · Rouge ', en: ' · Red ' }

const play = () => cmp(v('state'), '=', str(STATE.play))
const minus = (value: Block) => math(num(0), '-', value)

const sprite = (key: string, name: { fr: string; en: string }, props: Record<string, unknown>) => ({
  key,
  type: 'Sprite',
  name,
  props: { collision: 'none', ...props },
})

const KIT = {
  scene,
  title: { fr: 'Palet Éclair', en: 'Puck Clash' },
  hint: {
    fr: 'À deux, chacun d’un côté du téléphone.\nUn joystick chacun. Premier à 7 buts !',
    en: 'Two players, one at each end of the phone.\nOne joystick each. First to 7 goals!',
  },
  overTitle: { fr: 'Victoire !', en: 'Victory!' },
  textColor: '#1b1f4b',
  titleY: 250,
  bestY: 560,
  buttonColor: ['#8a7cff', '#5b4bff'] as [string, string],
  panelColor: ['#f5f3ff', '#8a7cff'] as [string, string],
}

/** "keep a bat in its half": its y between `low` and `high`. */
const keepIn = (id: string, key: string, low: number, high: number) =>
  when(
    id,
    or2(
      cmp(prop('Sprite', key, 'y'), '<', num(low)),
      cmp(prop('Sprite', key, 'y'), '>', num(high)),
    ),
    [
      set(
        `${id}-y`,
        'Sprite',
        key,
        'y',
        choose(cmp(prop('Sprite', key, 'y'), '<', num(low)), num(low), num(high)),
      ),
      set(`${id}-vy`, 'Sprite', key, 'vy', num(0)),
    ],
  )

function or2(a: Block, b: Block): Block {
  return {
    type: 'logic_operation',
    fields: { OP: 'OR' },
    inputs: { A: { block: a }, B: { block: b } },
  }
}

function blocks(): Block[] {
  return [
    note(
      on('start', 'GameScene', scene, 'start', [
        run('start-settings', FN.settings),
        run('start-title', FN.title),
      ]),
      {
        fr: 'Au démarrage : les réglages, puis l’écran titre.',
        en: 'At the start: the settings, then the title screen.',
      },
    ),
    note(
      fn('settings', FN.settings, [
        note(setVar('set-goals', 'goalsToWin', num(7)), {
          fr: 'Le nombre de buts pour gagner.',
          en: 'How many goals to win.',
        }),
        note(setVar('set-bat', 'batSpeed', num(560)), {
          fr: 'La vitesse des maillets.',
          en: 'How fast the bats go.',
        }),
        note(setVar('set-max', 'maxSpeed', num(950)), {
          fr: 'La vitesse maximale du palet.',
          en: 'The top speed of the puck.',
        }),
        note(setVar('set-friction', 'friction', num(0.994)), {
          fr: 'Le frottement : 1 = le palet ne ralentit jamais.',
          en: 'Friction: 1 = the puck never slows down.',
        }),
      ]),
      CHANGE_ME,
    ),
    ...kitBlocks({
      scene,
      noRecord: true,
      onTitle: [
        set('t-unpause', 'GameScene', scene, 'paused', bool(false)),
        set(
          't-best',
          'SceneText',
          'bestText',
          'text',
          join(str(WINS), v('blueWins'), str(RED), v('redWins')),
        ),
        set('t-blue-score', 'SceneText', 'blueScore', 'visible', bool(false)),
        set('t-red-score', 'SceneText', 'redScore', 'visible', bool(false)),
        call('t-blue', 'Sprite', 'blue', 'goTo', num(180), num(620)),
        call('t-red', 'Sprite', 'red', 'goTo', num(180), num(100)),
        call('t-puck', 'Sprite', 'puck', 'goTo', num(180), num(360)),
        set('t-puck-vx', 'Sprite', 'puck', 'vx', num(0)),
        set('t-puck-vy', 'Sprite', 'puck', 'vy', num(0)),
      ],
      onStart: [
        set('s-unpause', 'GameScene', scene, 'paused', bool(false)),
        run('s-settings', FN.settings),
        note(set('s-score-hide', 'SceneText', 'scoreText', 'visible', bool(false)), {
          fr: 'Ici, chacun a son score, de son côté.',
          en: 'Here, each player has a score, on their side.',
        }),
        setVar('s-blue', 'blueGoals', num(0)),
        setVar('s-red', 'redGoals', num(0)),
        run('s-scores', SCORES),
        set('s-blue-score', 'SceneText', 'blueScore', 'visible', bool(true)),
        set('s-red-score', 'SceneText', 'redScore', 'visible', bool(true)),
        call('s-blue-go', 'Sprite', 'blue', 'goTo', num(180), num(620)),
        call('s-red-go', 'Sprite', 'red', 'goTo', num(180), num(100)),
        setVar('s-serve', 'serveTo', random(0, 1)),
        run('s-serve-run', SERVE),
      ],
      onEnd: [
        call('e-sound', 'Sound', 'sndWin', 'play'),
        when(
          'e-who',
          cmp(v('blueGoals'), '>', v('redGoals')),
          [
            change('e-blue-wins', 'blueWins', 1),
            set(
              'e-blue-text',
              'SceneText',
              'overText',
              'text',
              str({ fr: 'Bleu gagne !', en: 'Blue wins!' }),
            ),
          ],
          [
            change('e-red-wins', 'redWins', 1),
            set(
              'e-red-text',
              'SceneText',
              'overText',
              'text',
              str({ fr: 'Rouge gagne !', en: 'Red wins!' }),
            ),
          ],
        ),
      ],
      afterEnd: [
        set(
          'e-final',
          'SceneText',
          'finalText',
          'text',
          join(
            str({ fr: 'Bleu ', en: 'Blue ' }),
            v('blueGoals'),
            str(' – '),
            v('redGoals'),
            str({ fr: ' Rouge', en: ' Red' }),
          ),
        ),
        note(
          set(
            'e-wins',
            'SceneText',
            'recordText',
            'text',
            join(str(WINS), v('blueWins'), str(RED), v('redWins')),
          ),
          {
            fr: 'Les victoires sont des variables stockées : elles restent sur le téléphone.',
            en: 'The wins are stored variables: they stay on the phone.',
          },
        ),
      ],
    }),
    fn('scores', SCORES, [
      set('sc-blue', 'SceneText', 'blueScore', 'text', v('blueGoals')),
      set('sc-red', 'SceneText', 'redScore', 'text', v('redGoals')),
    ]),
    note(
      fn('serve', SERVE, [
        setVar('sv-still', 'stillTime', num(0)),
        set('sv-vx', 'Sprite', 'puck', 'vx', num(0)),
        set('sv-vy', 'Sprite', 'puck', 'vy', num(0)),
        note(
          call(
            'sv-go',
            'Sprite',
            'puck',
            'goTo',
            num(180),
            choose(cmp(v('serveTo'), '=', num(1)), num(450), num(270)),
          ),
          {
            fr: 'Le palet va du côté de celui qui vient d’encaisser un but.',
            en: 'The puck goes to the side of whoever just let a goal in.',
          },
        ),
      ]),
      {
        fr: 'Le palet au milieu de son camp, immobile.',
        en: 'The puck in the middle of their half, still.',
      },
    ),
    note(
      on('frame', 'GameScene', scene, 'frame', [
        when(
          'frame-if',
          play(),
          [run('frame-steer', STEER), run('frame-limit', LIMIT)],
          [
            set('frame-blue-vx', 'Sprite', 'blue', 'vx', num(0)),
            set('frame-blue-vy', 'Sprite', 'blue', 'vy', num(0)),
            set('frame-red-vx', 'Sprite', 'red', 'vx', num(0)),
            set('frame-red-vy', 'Sprite', 'red', 'vy', num(0)),
          ],
        ),
      ]),
      { fr: 'À chaque image.', en: 'On every frame.' },
    ),
    note(
      fn('steer', STEER, [
        note(
          set(
            'st-blue-vx',
            'Sprite',
            'blue',
            'vx',
            math(prop('Joystick', 'blueStick', 'dx'), '×', v('batSpeed')),
          ),
          {
            fr: 'Chaque joystick donne la vitesse de son maillet.',
            en: 'Each joystick gives its bat a speed.',
          },
        ),
        set(
          'st-blue-vy',
          'Sprite',
          'blue',
          'vy',
          math(prop('Joystick', 'blueStick', 'dy'), '×', v('batSpeed')),
        ),
        set(
          'st-red-vx',
          'Sprite',
          'red',
          'vx',
          math(prop('Joystick', 'redStick', 'dx'), '×', v('batSpeed')),
        ),
        set(
          'st-red-vy',
          'Sprite',
          'red',
          'vy',
          math(prop('Joystick', 'redStick', 'dy'), '×', v('batSpeed')),
        ),
        note(keepIn('st-blue-half', 'blue', 400, 680), {
          fr: 'Chacun reste dans sa moitié.',
          en: 'Each one stays in its half.',
        }),
        keepIn('st-red-half', 'red', 40, 320),
      ]),
      { fr: 'Les deux joysticks en même temps.', en: 'Both joysticks at once.' },
    ),
    note(
      fn('limit', LIMIT, [
        note(
          set(
            'li-vx',
            'Sprite',
            'puck',
            'vx',
            math(prop('Sprite', 'puck', 'vx'), '×', v('friction')),
          ),
          {
            fr: 'Le palet ralentit un tout petit peu à chaque image.',
            en: 'The puck slows down a tiny bit at each frame.',
          },
        ),
        set(
          'li-vy',
          'Sprite',
          'puck',
          'vy',
          math(prop('Sprite', 'puck', 'vy'), '×', v('friction')),
        ),
        setVar(
          'li-speed',
          'puckSpeed',
          sqrt(
            math(
              math(prop('Sprite', 'puck', 'vx'), '×', prop('Sprite', 'puck', 'vx')),
              '+',
              math(prop('Sprite', 'puck', 'vy'), '×', prop('Sprite', 'puck', 'vy')),
            ),
          ),
        ),
        when('li-max', cmp(v('puckSpeed'), '>', v('maxSpeed')), [
          note(
            set(
              'li-max-vx',
              'Sprite',
              'puck',
              'vx',
              math(math(prop('Sprite', 'puck', 'vx'), '×', v('maxSpeed')), '÷', v('puckSpeed')),
            ),
            { fr: 'Pas plus vite que la vitesse maximale.', en: 'No faster than the top speed.' },
          ),
          set(
            'li-max-vy',
            'Sprite',
            'puck',
            'vy',
            math(math(prop('Sprite', 'puck', 'vy'), '×', v('maxSpeed')), '÷', v('puckSpeed')),
          ),
        ]),
        note(
          when(
            'li-still',
            cmp(v('puckSpeed'), '<', num(15)),
            [change('li-still-more', 'stillTime', 1)],
            [setVar('li-still-reset', 'stillTime', num(0))],
          ),
          {
            fr: 'Coincé ou oublié trois secondes ? Le palet est remis en jeu.',
            en: 'Stuck or forgotten for three seconds? The puck is put back.',
          },
        ),
        when('li-stuck', cmp(v('stillTime'), '>', num(180)), [
          setVar('li-stuck-reset', 'stillTime', num(0)),
          setVar('li-stuck-side', 'serveTo', math(num(1), '-', v('serveTo'))),
          run('li-stuck-serve', SERVE),
        ]),
      ]),
      {
        fr: 'Le palet glisse, ralentit, et ne va jamais trop vite.',
        en: 'The puck glides, slows down, and never goes too fast.',
      },
    ),
    note(
      on('hit', 'Sprite', 'puck', 'hit', [
        call('hit-sound', 'Sound', 'sndHit', 'play'),
        call(
          'hit-spark',
          'Sprite',
          'spark',
          'goTo',
          prop('Sprite', 'puck', 'x'),
          prop('Sprite', 'puck', 'y'),
        ),
        call('hit-spark-clone', 'Sprite', 'spark', 'clone'),
      ]),
      { fr: 'Un coup de maillet : un éclair !', en: 'A hit with a bat: a flash!' },
    ),
    on('spark-clone', 'Sprite', 'spark', 'clone', [
      set('sp-show', 'Sprite', 'spark', 'visible', bool(true)),
      wait('sp-wait', 0.12),
      call('sp-delete', 'Sprite', 'spark', 'delete'),
    ]),
    note(
      on(
        'edge-top',
        'Sprite',
        'puck',
        'edge',
        [
          when(
            'edge-top-if',
            and(
              play(),
              and(
                cmp(prop('Sprite', 'puck', 'x'), '>', num(118)),
                cmp(prop('Sprite', 'puck', 'x'), '<', num(242)),
              ),
            ),
            [
              change('edge-top-goal', 'blueGoals', 1),
              setVar('edge-top-serve', 'serveTo', num(0)),
              run('edge-top-run', GOAL),
            ],
            [call('edge-top-wall', 'Sound', 'sndWall', 'play')],
          ),
        ],
        'top',
      ),
      {
        fr: 'Le palet touche le bord du haut : si c’est dans la cage, but pour Bleu.',
        en: 'The puck touches the top edge: in the goal, it is a goal for Blue.',
      },
    ),
    on(
      'edge-bottom',
      'Sprite',
      'puck',
      'edge',
      [
        when(
          'edge-bottom-if',
          and(
            play(),
            and(
              cmp(prop('Sprite', 'puck', 'x'), '>', num(118)),
              cmp(prop('Sprite', 'puck', 'x'), '<', num(242)),
            ),
          ),
          [
            change('edge-bottom-goal', 'redGoals', 1),
            setVar('edge-bottom-serve', 'serveTo', num(1)),
            run('edge-bottom-run', GOAL),
          ],
          [call('edge-bottom-wall', 'Sound', 'sndWall', 'play')],
        ),
      ],
      'bottom',
    ),
    on(
      'edge-side',
      'Sprite',
      'puck',
      'edge',
      [when('edge-side-if', play(), [call('edge-side-wall', 'Sound', 'sndWall', 'play')])],
      'left',
    ),
    on(
      'edge-side-2',
      'Sprite',
      'puck',
      'edge',
      [when('edge-side-2-if', play(), [call('edge-side-2-wall', 'Sound', 'sndWall', 'play')])],
      'right',
    ),
    note(
      fn('goal', GOAL, [
        setVar('goal-blue', 'score', v('blueGoals')),
        call('goal-sound', 'Sound', 'sndGoal', 'play'),
        call('goal-shake', 'GameScene', scene, 'shake', num(0.4)),
        run('goal-scores', SCORES),
        set('goal-flash', 'SceneText', 'goalText', 'visible', bool(true)),
        set('goal-glow', 'Sprite', 'puck', 'costume', num(2)),
        setVar('goal-state', 'state', str(STATE.lost)),
        set('goal-pause', 'GameScene', scene, 'paused', bool(true)),
        wait('goal-wait', 1),
        set('goal-hide', 'SceneText', 'goalText', 'visible', bool(false)),
        set('goal-unglow', 'Sprite', 'puck', 'costume', num(1)),
        when(
          'goal-won',
          or2(cmp(v('blueGoals'), '≥', v('goalsToWin')), cmp(v('redGoals'), '≥', v('goalsToWin'))),
          [note(run('goal-end', FN.end), { fr: 'Fini !', en: 'Over!' })],
          [
            set('goal-unpause', 'GameScene', scene, 'paused', bool(false)),
            setVar('goal-play', 'state', str(STATE.play)),
            run('goal-serve', SERVE),
          ],
        ),
      ]),
      {
        fr: 'Un but : on souffle une seconde, puis on remet le palet.',
        en: 'A goal: a second to breathe, then the puck is back.',
      },
    ),
  ]
}

export const PUCK_CLASH: GameSource = {
  id: 'puck-clash',
  order: 26,
  mode: 'junior',
  icon: '🏒',
  accent: 'indigo',
  title: { fr: 'Palet Éclair', en: 'Puck Clash' },
  description: {
    fr: 'Hockey sur coussin d’air à deux sur le même téléphone : un joystick chacun, premier à 7.',
    en: 'Air hockey for two on the same phone: one joystick each, first to 7.',
  },
  theme: { primary: '#5b4bff', font: 'rounded' },
  variables: [
    ...KIT_VARIABLES,
    { key: 'goalsToWin', name: { fr: 'butsPourGagner', en: 'goalsToWin' }, initial: 7 },
    { key: 'batSpeed', name: { fr: 'vitesseMaillet', en: 'batSpeed' }, initial: 560 },
    { key: 'maxSpeed', name: { fr: 'vitesseMax', en: 'maxSpeed' }, initial: 950 },
    { key: 'friction', name: { fr: 'frottement', en: 'friction' }, initial: 0.994 },
    { key: 'puckSpeed', name: { fr: 'vitessePalet', en: 'puckSpeed' }, initial: 0 },
    { key: 'blueGoals', name: { fr: 'butsBleu', en: 'blueGoals' }, initial: 0 },
    { key: 'redGoals', name: { fr: 'butsRouge', en: 'redGoals' }, initial: 0 },
    { key: 'serveTo', name: { fr: 'engagement', en: 'serveTo' }, initial: 0 },
    { key: 'stillTime', name: { fr: 'immobile', en: 'stillTime' }, initial: 0 },
    { key: 'blueWins', name: { fr: 'victoiresBleu', en: 'blueWins' }, kind: 'stored', initial: 0 },
    { key: 'redWins', name: { fr: 'victoiresRouge', en: 'redWins' }, kind: 'stored', initial: 0 },
  ],
  screen: { key: 'game', name: { fr: 'Jeu', en: 'Game' }, props: { padding: 0 } },
  components: [
    {
      key: scene,
      type: 'GameScene',
      name: { fr: 'Table', en: 'Table' },
      props: { background: '#14193a', edges: 'bounce', sceneHeight: 720 },
      children: [
        sprite(
          'rink',
          { fr: 'Patinoire', en: 'Rink' },
          { costumes: ['asset:rink'], x: 180, y: 360, width: 360, height: 720 },
        ),
        sprite(
          'spark',
          { fr: 'Éclair', en: 'Flash' },
          {
            costumes: ['asset:spark'],
            x: -100,
            y: -100,
            width: 56,
            height: 56,
            visible: false,
            edges: 'pass',
          },
        ),
        sprite(
          'puck',
          { fr: 'Palet', en: 'Puck' },
          {
            costumes: ['asset:puck', 'asset:puck-glow'],
            x: 180,
            y: 360,
            width: 44,
            height: 44,
            collision: 'circle',
            solid: true,
            bounce: 92,
          },
        ),
        sprite(
          'blue',
          { fr: 'Bleu', en: 'Blue' },
          {
            costumes: ['asset:bat-blue'],
            x: 180,
            y: 620,
            width: 68,
            height: 68,
            collision: 'circle',
            solid: true,
            pushable: false,
            edges: 'stop',
          },
        ),
        sprite(
          'red',
          { fr: 'Rouge', en: 'Red' },
          {
            costumes: ['asset:bat-red'],
            x: 180,
            y: 100,
            width: 68,
            height: 68,
            collision: 'circle',
            solid: true,
            pushable: false,
            edges: 'stop',
          },
        ),
        {
          key: 'blueStick',
          type: 'Joystick',
          name: { fr: 'JoystickBleu', en: 'BlueStick' },
          props: { x: 76, y: 640, size: 120, color: '#2b9cff', keys: 'wasd' },
        },
        {
          key: 'redStick',
          type: 'Joystick',
          name: { fr: 'JoystickRouge', en: 'RedStick' },
          props: { x: 284, y: 80, size: 120, color: '#ff4f8b', keys: 'arrows' },
        },
        {
          key: 'blueScore',
          type: 'SceneText',
          name: { fr: 'ScoreBleu', en: 'BlueScore' },
          props: { text: '0', x: 318, y: 400, fontSize: 40, color: '#2b9cff', visible: false },
        },
        {
          key: 'redScore',
          type: 'SceneText',
          name: { fr: 'ScoreRouge', en: 'RedScore' },
          props: {
            text: '0',
            x: 42,
            y: 320,
            fontSize: 40,
            color: '#ff4f8b',
            rotation: 180,
            visible: false,
          },
        },
        {
          key: 'goalText',
          type: 'SceneText',
          name: { fr: 'TexteBut', en: 'GoalText' },
          props: {
            text: { fr: 'BUT !', en: 'GOAL!' },
            x: 180,
            y: 360,
            fontSize: 64,
            color: '#5b4bff',
            visible: false,
          },
        },
        ...kitComponents(KIT),
      ],
    },
    {
      key: 'sndHit',
      type: 'Sound',
      name: { fr: 'SonCoup', en: 'HitSound' },
      props: { src: 'asset:hit' },
    },
    {
      key: 'sndWall',
      type: 'Sound',
      name: { fr: 'SonBord', en: 'WallSound' },
      props: { src: 'asset:wall' },
    },
    {
      key: 'sndGoal',
      type: 'Sound',
      name: { fr: 'SonBut', en: 'GoalSound' },
      props: { src: 'asset:goal' },
    },
    {
      key: 'sndWin',
      type: 'Sound',
      name: { fr: 'SonVictoire', en: 'WinSound' },
      props: { src: 'asset:record' },
    },
    ...kitSoundComponents(),
  ],
  blocks: blocks(),
  art: {
    ...Object.fromEntries(
      Object.entries(ART).map(([key, file]) => [
        key,
        {
          name: {
            rink: { fr: 'table', en: 'table' },
            'bat-blue': { fr: 'maillet bleu', en: 'blue bat' },
            'bat-red': { fr: 'maillet rouge', en: 'red bat' },
            puck: { fr: 'palet', en: 'puck' },
            'puck-glow': { fr: 'palet brillant', en: 'glowing puck' },
            spark: { fr: 'éclair', en: 'flash' },
          }[key] ?? { fr: key, en: key },
          svg: file,
        },
      ]),
    ),
    ...kitArt(KIT),
  },
  sounds: {
    hit: {
      name: { fr: 'coup', en: 'hit' },
      wav: wav([
        { wave: 'square', from: 900, to: 300, seconds: 0.06, volume: 0.5, duty: 0.3 },
        { wave: 'noise', from: 4000, to: 1000, seconds: 0.05, volume: 0.3 },
      ]),
    },
    wall: {
      name: { fr: 'bord', en: 'edge' },
      wav: wav([{ wave: 'triangle', from: 500, to: 380, seconds: 0.06, volume: 0.4 }]),
    },
    goal: {
      name: { fr: 'but', en: 'goal' },
      wav: wav([
        ...melody([0, 4, 7], 0.11, { wave: 'saw', volume: 0.25 }),
        ...melody([12, 16, 19], 0.11, { wave: 'square', duty: 0.25, volume: 0.2 }),
      ]),
    },
    ...kitSounds(),
  },
  cover: cover(),
}
