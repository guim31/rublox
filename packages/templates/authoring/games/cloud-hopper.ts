import {
  and,
  type Block,
  bool,
  call,
  change,
  charAt,
  choose,
  cmp,
  count,
  fn,
  fnResult,
  forever,
  item,
  join,
  length,
  list,
  math,
  note,
  num,
  on,
  or,
  prop,
  run,
  set,
  setVar,
  str,
  textLength,
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
import { COMMON_SOUNDS, melody, wav } from './sfx.ts'
import {
  coin,
  coverStyle,
  embed,
  heart,
  INK,
  ink,
  rgradient,
  svg,
  symbol,
  use,
  vgradient,
  wave,
} from './svg.ts'
import type { GameSource } from './types.ts'

/**
 * Saute-Nuage (Cloud Hopper): a platformer. Pip runs and jumps (gravity) across levels four
 * screens wide, the camera following; solid platforms, some of them moving, coins, beetles
 * that walk to and fro and get squashed from above, spikes, springs, a flag at the end. The
 * three levels are drawn with letters in the blocks, and built at once while the scene is
 * paused.
 */

/** The levels, one text per row of 40-point tiles (see the key in `blocks()`). */
export const LEVELS: string[][] = [
  [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '......................ooo...........',
    '.....................=====..........',
    '....ooo.............................',
    '...=====............................',
    '..............o.o..........oo.......',
    '...P.....E..........B.......E....^^F',
    '==============...===================',
    '##############...###################',
  ],
  [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '..............ooo......ooo...E......',
    '...........................======...',
    '...ooo.....~.....~..................',
    '...P.E...........................^^F',
    '==========..........================',
    '##########..........################',
  ],
  [
    '....................................',
    '....................................',
    '....................................',
    '................ooooo...............',
    '...............=======..............',
    '....................................',
    '....................................',
    '..ooo...............................',
    '.........................ooo........',
    '...........B....~...................',
    '..P........=.E............^.....^.EF',
    '======...======.........=====..=====',
    '######...######.........#####..#####',
  ],
]

for (const level of LEVELS) {
  for (const row of level) {
    if (row.length !== level[0]?.length) throw new Error(`a row of a level is ${row.length} long`)
  }
}

// Pictures

function pip(pose: 'idle' | 'run1' | 'run2' | 'jump' | 'hurt'): string {
  const feet = {
    idle: `<ellipse cx="18" cy="58" rx="8" ry="5" fill="#ff8f3c" ${ink(2.5)}/><ellipse cx="36" cy="58" rx="8" ry="5" fill="#ff8f3c" ${ink(2.5)}/>`,
    run1: `<ellipse cx="12" cy="56" rx="8" ry="5" fill="#ff8f3c" ${ink(2.5)} transform="rotate(-20 12 56)"/><ellipse cx="40" cy="58" rx="8" ry="5" fill="#ff8f3c" ${ink(2.5)}/>`,
    run2: `<ellipse cx="22" cy="59" rx="8" ry="5" fill="#ff8f3c" ${ink(2.5)}/><ellipse cx="32" cy="55" rx="8" ry="5" fill="#ff8f3c" ${ink(2.5)} transform="rotate(20 32 55)"/>`,
    jump: `<ellipse cx="16" cy="54" rx="7" ry="5" fill="#ff8f3c" ${ink(2.5)} transform="rotate(30 16 54)"/><ellipse cx="38" cy="54" rx="7" ry="5" fill="#ff8f3c" ${ink(2.5)} transform="rotate(-30 38 54)"/>`,
    hurt: `<ellipse cx="18" cy="58" rx="8" ry="5" fill="#ff8f3c" ${ink(2.5)}/><ellipse cx="36" cy="58" rx="8" ry="5" fill="#ff8f3c" ${ink(2.5)}/>`,
  }[pose]
  const face =
    pose === 'hurt'
      ? `<path d="M30 26 l6 6 M36 26 l-6 6 M40 26 l6 6 M46 26 l-6 6" ${ink(2.5)}/><ellipse cx="38" cy="40" rx="3" ry="4" fill="${INK}"/>`
      : `<ellipse cx="33" cy="28" rx="4.5" ry="6" fill="#fff" ${ink(2)}/><ellipse cx="44" cy="28" rx="4.5" ry="6" fill="#fff" ${ink(2)}/>` +
        `<circle cx="35" cy="29" r="2.6" fill="${INK}"/><circle cx="46" cy="29" r="2.6" fill="${INK}"/>` +
        `<path d="M34 38 q6 ${pose === 'jump' ? 7 : 5} 12 0" fill="${pose === 'jump' ? '#ff5d73' : 'none'}" ${ink(2.5)}/>` +
        `<circle cx="28" cy="36" r="3" fill="#ff8fa3" opacity="0.7"/>`
  return svg(
    56,
    64,
    feet +
      `<path d="M26 10 q-2 -8 6 -9 q-2 6 -6 9 Z M26 10 q4 -9 12 -6 q-6 4 -12 6 Z" fill="#5ad15a" ${ink(2)}/>` +
      `<ellipse cx="28" cy="34" rx="22" ry="22" fill="url(#body)" ${ink(3)}/>` +
      `<ellipse cx="20" cy="24" rx="7" ry="4" fill="#fff" opacity="0.5"/>` +
      face +
      (pose === 'jump'
        ? `<path d="M8 30 q-8 -6 -6 -14 M48 30 q8 -6 6 -14" fill="none" ${ink(3)}/>`
        : `<path d="M8 36 q-6 4 -4 10 M48 36 q6 4 4 10" fill="none" ${ink(3)}/>`),
    rgradient('body', [
      [0, '#d6f7ff'],
      [0.6, '#5ec8ff'],
      [1, '#2b8fe0'],
    ]),
  )
}

function beetle(step: 0 | 1 | 2): string {
  if (step === 2) {
    return svg(
      52,
      40,
      `<ellipse cx="26" cy="32" rx="24" ry="8" fill="url(#shell)" ${ink(3)}/>` +
        `<path d="M10 30 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" fill="none" ${ink(2.5)}/>` +
        `<path d="M18 30 l3 3 M21 30 l-3 3 M31 30 l3 3 M34 30 l-3 3" ${ink(2)}/>`,
      vgradient('shell', [
        [0, '#c08bff'],
        [1, '#7a3fd6'],
      ]),
    )
  }
  const legs =
    step === 0
      ? `<path d="M14 32 l-6 8 M26 34 l0 6 M38 32 l6 8" ${ink(3)}/>`
      : `<path d="M14 32 l-2 8 M26 34 l-4 6 M38 32 l2 8" ${ink(3)}/>`
  return svg(
    52,
    44,
    legs +
      `<path d="M4 30 Q4 6 26 6 Q48 6 48 30 Z" fill="url(#shell)" ${ink(3)}/>` +
      `<path d="M12 12 l4 -8 l4 7 l5 -8 l4 8 l5 -7 l4 8" fill="#ffe066" ${ink(2)}/>` +
      `<path d="M26 6 v24" stroke="${INK}" stroke-width="2.5"/>` +
      `<ellipse cx="40" cy="26" rx="9" ry="7" fill="#2b1b3f" ${ink(2)}/>` +
      `<circle cx="42" cy="24" r="3" fill="#fff"/><circle cx="43" cy="24" r="1.5" fill="#ff3b5c"/>` +
      `<ellipse cx="16" cy="14" rx="6" ry="3" fill="#fff" opacity="0.4"/>`,
    vgradient('shell', [
      [0, '#c08bff'],
      [1, '#7a3fd6'],
    ]),
  )
}

function grass(): string {
  const blades = Array.from({ length: 5 }, (_, i) => `M${i * 8} 10 l4 -7 l4 7`).join(' ')
  return svg(
    40,
    40,
    `<rect x="-1" y="8" width="42" height="34" fill="url(#dirt)"/>` +
      `<circle cx="10" cy="26" r="2.5" fill="#a86e3c"/><circle cx="30" cy="33" r="2" fill="#a86e3c"/>` +
      `<path d="M-1 4 L41 4 L41 14 L-1 14 Z" fill="#5ad15a"/><path d="${blades}" fill="#5ad15a"/>` +
      `<path d="M-1 14 L41 14" stroke="#3a9d3a" stroke-width="3"/><path d="M-1 1.5 L41 1.5" stroke="${INK}" stroke-width="3"/>`,
    vgradient('dirt', [
      [0, '#d39a62'],
      [1, '#b47a44'],
    ]),
  )
}

function dirt(): string {
  return svg(
    40,
    40,
    `<rect x="-1" y="-1" width="42" height="42" fill="url(#dirt)"/>` +
      `<circle cx="12" cy="12" r="2.5" fill="#8a5a2c"/><circle cx="30" cy="26" r="3" fill="#8a5a2c"/><circle cx="8" cy="34" r="1.8" fill="#8a5a2c"/>`,
    vgradient('dirt', [
      [0, '#b47a44'],
      [1, '#94602f'],
    ]),
  )
}

function cloudPlatform(): string {
  return svg(
    120,
    32,
    `<path d="M10 28 q-8 0 -8 -8 q0 -9 10 -9 q4 -9 16 -8 q6 -5 16 -2 q8 -6 20 -2 q10 -4 18 3 q12 -2 16 6 q12 0 12 10 q0 10 -10 10 Z" fill="url(#c)" ${ink(3)}/>` +
      `<path d="M14 24 q46 6 92 0" stroke="#cfe7f7" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    vgradient('c', [
      [0, '#ffffff'],
      [1, '#dcefff'],
    ]),
  )
}

function spikes(): string {
  return svg(
    40,
    40,
    `<path d="M0 40 L6 14 L12 40 L18 10 L24 40 L30 14 L36 40 Z" fill="url(#s)" ${ink(2.5)}/>` +
      `<rect x="-1" y="36" width="42" height="5" fill="#6b7280" ${ink(2)}/>`,
    vgradient('s', [
      [0, '#f3f4f6'],
      [1, '#9ca3af'],
    ]),
  )
}

function spring(open: boolean): string {
  return svg(
    40,
    40,
    open
      ? `<path d="M10 36 l20 -6 l-20 -6 l20 -6 l-20 -6" fill="none" stroke="#9ca3af" stroke-width="4"/><rect x="4" y="2" width="32" height="8" rx="4" fill="#ff5d73" ${ink(2.5)}/><rect x="4" y="34" width="32" height="6" rx="3" fill="#6b7280" ${ink(2)}/>`
      : `<path d="M10 34 l20 -3 l-20 -3 l20 -3 l-20 -3" fill="none" stroke="#9ca3af" stroke-width="4"/><rect x="4" y="16" width="32" height="8" rx="4" fill="#ff5d73" ${ink(2.5)}/><rect x="4" y="34" width="32" height="6" rx="3" fill="#6b7280" ${ink(2)}/>`,
  )
}

function flag(step: 0 | 1): string {
  const cloth = step
    ? 'M8 6 q14 -6 28 2 q-6 8 0 14 q-14 -6 -28 0 Z'
    : 'M8 6 q14 4 28 -2 q-4 9 0 16 q-14 4 -28 -2 Z'
  return svg(
    44,
    80,
    `<rect x="5" y="2" width="5" height="76" rx="2.5" fill="#9ca3af" ${ink(2)}/>` +
      `<circle cx="7.5" cy="3" r="4" fill="#ffd23f" ${ink(2)}/>` +
      `<path d="${cloth}" fill="url(#f)" ${ink(2.5)}/>` +
      `<rect x="0" y="74" width="16" height="6" rx="3" fill="#6b7280"/>`,
    vgradient('f', [
      [0, '#ffe066'],
      [1, '#ff8f3c'],
    ]),
  )
}

function skyBack(): string {
  return svg(
    360,
    720,
    `<rect width="360" height="720" fill="url(#s)"/>` +
      `<circle cx="80" cy="120" r="56" fill="#fff6c2" opacity="0.6"/><circle cx="80" cy="120" r="36" fill="#ffe066" ${ink(3)}/>`,
    vgradient('s', [
      [0, '#7ccbff'],
      [0.7, '#c7ecff'],
      [1, '#fff3c4'],
    ]),
  )
}

function farHills(): string {
  return svg(
    360,
    240,
    `<path d="${wave(
      360,
      120,
      [
        [36, 2, 1.1],
        [12, 5, 0.2],
      ],
      240,
    )}" fill="#b7e3a8" ${ink(3)}/>` +
      `<path d="${wave(
        360,
        170,
        [
          [20, 3, 2.6],
          [6, 7, 1.2],
        ],
        240,
      )}" fill="#8fd27f" ${ink(3)}/>`,
  )
}

function cloudsBand(): string {
  const puff = (x: number, y: number, s: number) =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M10 40 q-10 0 -10 -10 q0 -10 12 -10 q2 -14 18 -14 q10 0 16 8 q6 -6 14 -6 q16 0 16 16 q12 0 12 8 q0 8 -10 8 Z" fill="#ffffff" opacity="0.9" ${ink(2.5)}/>`
  return svg(360, 200, puff(10, 30, 1) + puff(170, 90, 0.8) + puff(270, 20, 0.6))
}

function jumpButton(): string {
  return svg(
    84,
    88,
    `<circle cx="42" cy="46" r="38" fill="#2f9e44"/><circle cx="42" cy="42" r="38" fill="url(#b)" ${ink(3)}/>` +
      `<path d="M42 16 L64 44 L50 44 L50 62 L34 62 L34 44 L20 44 Z" fill="#fff" ${ink(3)}/>` +
      `<ellipse cx="30" cy="20" rx="12" ry="5" fill="#fff" opacity="0.4"/>`,
    rgradient('b', [
      [0, '#a8f0a0'],
      [1, '#2f9e44'],
    ]),
  )
}

const ART = {
  'pip-idle': pip('idle'),
  'pip-run1': pip('run1'),
  'pip-run2': pip('run2'),
  'pip-jump': pip('jump'),
  'pip-hurt': pip('hurt'),
  'beetle-1': beetle(0),
  'beetle-2': beetle(1),
  'beetle-flat': beetle(2),
  grass: grass(),
  dirt: dirt(),
  cloud: cloudPlatform(),
  spikes: spikes(),
  spring: spring(false),
  'spring-open': spring(true),
  'flag-1': flag(0),
  'flag-2': flag(1),
  sky: skyBack(),
  hills: farHills(),
  clouds: cloudsBand(),
  'jump-button': jumpButton(),
  heart: heart(40),
  'coin-1': coin(1),
  'coin-2': coin(0.6),
  'coin-3': coin(0.15),
  'coin-4': coin(0.6),
}

function cover(): string {
  return svg(
    340,
    220,
    coverStyle(
      '.world { animation: scroll 6s linear infinite; } .pip { animation: hop 1.5s ease-in-out infinite; } ' +
        '.spin { animation: spin 0.5s steps(1) infinite; } ' +
        '@keyframes scroll { to { transform: translateX(-160px); } } ' +
        '@keyframes hop { 0%, 40%, 100% { transform: translateY(0); } 70% { transform: translateY(-64px); } } ' +
        '@keyframes spin { 50% { opacity: 0.35; } }',
    ) +
      `<defs>${symbol(ART.grass, 'g')}${symbol(ART.dirt, 'd')}${symbol(ART['coin-1'], 'c')}${symbol(ART['beetle-1'], 'b')}${symbol(ART.cloud, 'p')}</defs>` +
      embed(ART.sky, 0, -100, 340, 680, 'sky') +
      embed(ART.hills, 0, 70, 340, 227, 'hills') +
      `<g class="world">` +
      Array.from(
        { length: 13 },
        (_, i) =>
          use('g', i * 40 - (i > 7 && i < 10 ? 999 : 0), 176, 40, 40) +
          use('d', i * 40 - (i > 7 && i < 10 ? 999 : 0), 214, 40, 40),
      ).join('') +
      use('g', 120, 112, 40, 40) +
      use('g', 160, 112, 40, 40) +
      use('g', 200, 112, 40, 40) +
      `<g class="spin">${use('c', 130, 78, 24, 24)}${use('c', 170, 78, 24, 24)}${use('c', 210, 78, 24, 24)}</g>` +
      use('p', 330, 140, 90, 24) +
      use('b', 250, 148, 34, 30) +
      `</g>` +
      `<g class="pip">${embed(ART['pip-run1'], 52, 128, 44, 50, 'pip')}</g>`,
  )
}

// Recipe

const scene = 'world'
const BUILD = { fr: 'construire le niveau', en: 'build the level' }
const MAPS = { fr: 'dessiner les niveaux', en: 'draw the levels' }
const STRIP = { fr: 'poser une bande de sol', en: 'put a strip of ground' }
const THING = { fr: 'poser un objet', en: 'put a thing' }
const JUMP = { fr: 'faire sauter le héros', en: 'make the hero jump' }
const MOVE = { fr: 'faire courir le héros', en: 'make the hero run' }
const HURT = { fr: 'le héros est touché', en: 'the hero is hit' }
const WIN = { fr: 'finir le niveau', en: 'finish the level' }
const HUD = { fr: 'afficher les vies', en: 'show the lives' }
const CELL_X = { fr: 'x de la colonne', en: 'x of column' }
const CELL_Y = { fr: 'y de la ligne', en: 'y of row' }

const play = () => cmp(v('state'), '=', str(STATE.play))
const minus = (value: Block) => math(num(0), '-', value)
const self = (key: string, name: string) => prop('Sprite', key, name)
const cellX = (column: Block) => ({
  type: 'procedures_callreturn',
  extraState: { name: CELL_X, params: ['col'] },
  inputs: { ARG0: { block: column } },
})
const cellY = (row: Block) => ({
  type: 'procedures_callreturn',
  extraState: { name: CELL_Y, params: ['row'] },
  inputs: { ARG0: { block: row } },
})

const sprite = (key: string, name: { fr: string; en: string }, props: Record<string, unknown>) => ({
  key,
  type: 'Sprite',
  name,
  props: { collision: 'none', ...props },
})

const KIT = {
  scene,
  title: { fr: 'Saute-Nuage', en: 'Cloud Hopper' },
  hint: {
    fr: 'Cours, saute sur les scarabées,\nramasse les pièces, atteins le drapeau !',
    en: 'Run, stomp the beetles,\ngrab the coins, reach the flag!',
  },
  overTitle: { fr: 'Oh non !', en: 'Oh no!' },
  textColor: '#1b3a5c',
  titleY: 170,
  bestY: 300,
  buttonColor: ['#5ad15a', '#2f9e44'] as [string, string],
  panelColor: ['#f0fbff', '#2b8fe0'] as [string, string],
}

/** "is the letter …": a test on `letter`. */
const letterIs = (value: string) => cmp(v('letter'), '=', str(value))

function blocks(): Block[] {
  return [
    note(
      on('start', 'GameScene', scene, 'start', [
        run('start-settings', FN.settings),
        run('start-maps', MAPS),
        run('start-title', FN.title),
      ]),
      {
        fr: 'Au démarrage : les réglages, les niveaux, puis l’écran titre.',
        en: 'At the start: the settings, the levels, then the title screen.',
      },
    ),
    note(
      fn('settings', FN.settings, [
        note(setVar('set-lives', 'lives', num(3)), {
          fr: 'Le nombre de vies.',
          en: 'How many lives.',
        }),
        note(setVar('set-run', 'runSpeed', num(250)), {
          fr: 'La vitesse de course.',
          en: 'How fast the hero runs.',
        }),
        note(setVar('set-jump', 'jumpForce', num(780)), {
          fr: 'La force du saut : plus grand, plus haut.',
          en: 'How strong the jump is: bigger, higher.',
        }),
        note(setVar('set-gravity', 'gravity', num(2000)), {
          fr: 'La gravité : plus grand, plus lourd.',
          en: 'Gravity: bigger, heavier.',
        }),
        setVar('set-spring', 'springForce', num(1150)),
      ]),
      CHANGE_ME,
    ),
    note(
      fn('maps', MAPS, [
        ...LEVELS.map((rows, index) =>
          setVar(`map-${index + 1}`, `map${index + 1}`, list(...rows.map((row) => str(row)))),
        ),
      ]),
      {
        fr: 'Change-moi ! Chaque texte est une rangée du niveau : = sol, # terre, o pièce, E scarabée, ^ piques, ~ nuage qui bouge, B ressort, F drapeau, P départ, . vide.',
        en: 'Change me! Each text is a row of the level: = ground, # earth, o coin, E beetle, ^ spikes, ~ moving cloud, B spring, F flag, P start, . empty.',
      },
      300,
    ),
    ...kitBlocks({
      scene,
      onTitle: [
        setVar('t-level', 'level', num(1)),
        run('t-build', BUILD),
        set('t-stick', 'Joystick', 'stick', 'visible', bool(false)),
        set('t-jump-button', 'Sprite', 'jumpButton', 'visible', bool(false)),
        set('t-hud', 'SceneText', 'livesText', 'visible', bool(false)),
        set('t-hud-heart', 'Sprite', 'heart', 'visible', bool(false)),
        set('t-hud-level', 'SceneText', 'levelText', 'visible', bool(false)),
        set('t-hero-costume', 'Sprite', 'hero', 'costume', num(1)),
      ],
      onStart: [
        run('s-settings', FN.settings),
        setVar('s-level', 'level', num(1)),
        setVar('s-won', 'won', bool(false)),
        run('s-build', BUILD),
        set('s-stick', 'Joystick', 'stick', 'visible', bool(true)),
        set('s-jump-button', 'Sprite', 'jumpButton', 'visible', bool(true)),
        set('s-hud', 'SceneText', 'livesText', 'visible', bool(true)),
        set('s-hud-heart', 'Sprite', 'heart', 'visible', bool(true)),
        set('s-hud-level', 'SceneText', 'levelText', 'visible', bool(true)),
        run('s-lives', HUD),
      ],
      onEnd: [
        set('e-stick', 'Joystick', 'stick', 'visible', bool(false)),
        set('e-jump-button', 'Sprite', 'jumpButton', 'visible', bool(false)),
      ],
      afterEnd: [
        when(
          'e-won',
          cmp(v('won'), '=', bool(true)),
          [
            set(
              'e-won-text',
              'SceneText',
              'overText',
              'text',
              str({ fr: 'Bravo, tout fini !', en: 'Well done, all done!' }),
            ),
          ],
          [
            set(
              'e-lost-text',
              'SceneText',
              'overText',
              'text',
              str({ fr: 'Oh non !', en: 'Oh no!' }),
            ),
          ],
        ),
      ],
    }),
    note(
      fnResult('cell-x', CELL_X, [], math(math(v('col'), '×', num(40)), '-', num(20)), ['col']),
      {
        fr: 'Le milieu d’une colonne de cases (40 points).',
        en: 'The middle of a column of tiles (40 points).',
      },
    ),
    note(
      fnResult(
        'cell-y',
        CELL_Y,
        [],
        math(math(math(v('row'), '+', num(5)), '×', num(40)), '-', num(20)),
        ['row'],
      ),
      {
        fr: 'Le milieu d’une rangée : le niveau commence 5 rangées sous le haut de l’écran.',
        en: 'The middle of a row: the level starts 5 rows below the top of the screen.',
      },
    ),
    note(
      fn('build', BUILD, [
        note(set('b-pause', 'GameScene', scene, 'paused', bool(true)), {
          fr: 'En pause, les boucles ne s’arrêtent pas à chaque image : le niveau se construit d’un coup.',
          en: 'While paused, loops do not stop at every frame: the level is built at once.',
        }),
        call('b-clones', 'GameScene', scene, 'deleteClones'),
        setVar(
          'b-rows',
          'rows',
          choose(
            cmp(v('level'), '=', num(1)),
            v('map1'),
            choose(cmp(v('level'), '=', num(2)), v('map2'), v('map3')),
          ),
        ),
        note(
          set(
            'b-width',
            'GameScene',
            scene,
            'worldWidth',
            math(textLength(item(v('rows'), 1)), '×', num(40)),
          ),
          {
            fr: 'Le monde est aussi large que les rangées : plus large que l’écran !',
            en: 'The world is as wide as the rows: wider than the screen!',
          },
        ),
        count('b-row', 'row', 1, length(v('rows')), 1, [
          setVar('b-line', 'line', item(v('rows'), v('row'))),
          setVar('b-run-letter', 'runLetter', str('.')),
          setVar('b-run-start', 'runStart', num(1)),
          count('b-col', 'col', 1, math(textLength(v('line')), '+', num(1)), 1, [
            setVar(
              'b-letter',
              'letter',
              choose(
                cmp(v('col'), '≤', textLength(v('line'))),
                charAt(v('line'), v('col')),
                str('.'),
              ),
            ),
            note(
              when('b-strip', cmp(v('letter'), '≠', v('runLetter')), [
                when(
                  'b-strip-ground',
                  or(cmp(v('runLetter'), '=', str('=')), cmp(v('runLetter'), '=', str('#'))),
                  [
                    run('b-strip-put', STRIP, {
                      kind: v('runLetter'),
                      from: v('runStart'),
                      tiles: math(v('col'), '-', v('runStart')),
                    }),
                  ],
                ),
                setVar('b-strip-letter', 'runLetter', v('letter')),
                setVar('b-strip-start', 'runStart', v('col')),
              ]),
              {
                fr: 'Les lettres = qui se suivent forment une seule bande de sol.',
                en: 'Letters = side by side make a single strip of ground.',
              },
            ),
            run('b-thing', THING),
          ]),
        ]),
        call('b-hero', 'Sprite', 'hero', 'goTo', v('startX'), v('startY')),
        set('b-hero-vx', 'Sprite', 'hero', 'vx', num(0)),
        set('b-hero-vy', 'Sprite', 'hero', 'vy', num(0)),
        set('b-hero-gravity', 'Sprite', 'hero', 'gravity', v('gravity')),
        set('b-hero-show', 'Sprite', 'hero', 'visible', bool(true)),
        note(
          {
            ...call('b-camera', 'GameScene', scene, 'follow'),
            fields: { COMPONENT: scene, ARG0: 'hero' },
          },
          {
            fr: 'La caméra suit le héros.',
            en: 'The camera follows the hero.',
          },
        ),
        set(
          'b-level-text',
          'SceneText',
          'levelText',
          'text',
          join(str({ fr: 'Niveau ', en: 'Level ' }), v('level')),
        ),
        set('b-unpause', 'GameScene', scene, 'paused', bool(false)),
      ]),
      {
        fr: 'Lit le niveau rangée par rangée, lettre par lettre, et pose ce que chaque lettre veut dire.',
        en: 'Reads the level row by row, letter by letter, and puts what each letter means.',
      },
    ),
    note(
      fn(
        'strip',
        STRIP,
        [
          set(
            'st-kind',
            'Sprite',
            'block',
            'costume',
            choose(cmp(v('kind'), '=', str('=')), num(1), num(2)),
          ),
          set('st-width', 'Sprite', 'block', 'width', math(v('tiles'), '×', num(40))),
          call(
            'st-go',
            'Sprite',
            'block',
            'goTo',
            math(
              math(math(v('from'), '-', num(1)), '×', num(40)),
              '+',
              math(v('tiles'), '×', num(20)),
            ),
            cellY(v('row')),
          ),
          call('st-clone', 'Sprite', 'block', 'clone'),
        ],
        ['kind', 'from', 'tiles'],
      ),
      {
        fr: 'Une bande de sol est un seul lutin, avec son image répétée (mosaïque).',
        en: 'A strip of ground is a single sprite, its picture repeated (tiles).',
      },
    ),
    note(
      fn('thing', THING, [
        when('th-coin', letterIs('o'), [
          call('th-coin-go', 'Sprite', 'coin', 'goTo', cellX(v('col')), cellY(v('row'))),
          call('th-coin-clone', 'Sprite', 'coin', 'clone'),
        ]),
        when('th-beetle', letterIs('E'), [
          call(
            'th-beetle-go',
            'Sprite',
            'beetle',
            'goTo',
            cellX(v('col')),
            math(cellY(v('row')), '+', num(2)),
          ),
          call('th-beetle-clone', 'Sprite', 'beetle', 'clone'),
        ]),
        when('th-spikes', letterIs('^'), [
          call(
            'th-spikes-go',
            'Sprite',
            'spikes',
            'goTo',
            cellX(v('col')),
            math(cellY(v('row')), '+', num(4)),
          ),
          call('th-spikes-clone', 'Sprite', 'spikes', 'clone'),
        ]),
        when('th-cloud', letterIs('~'), [
          call(
            'th-cloud-go',
            'Sprite',
            'cloud',
            'goTo',
            math(cellX(v('col')), '+', num(40)),
            math(cellY(v('row')), '-', num(4)),
          ),
          call('th-cloud-clone', 'Sprite', 'cloud', 'clone'),
        ]),
        when('th-spring', letterIs('B'), [
          call(
            'th-spring-go',
            'Sprite',
            'spring',
            'goTo',
            cellX(v('col')),
            math(cellY(v('row')), '+', num(4)),
          ),
          call('th-spring-clone', 'Sprite', 'spring', 'clone'),
        ]),
        when('th-flag', letterIs('F'), [
          call(
            'th-flag-go',
            'Sprite',
            'flag',
            'goTo',
            cellX(v('col')),
            math(cellY(v('row')), '-', num(20)),
          ),
          call('th-flag-clone', 'Sprite', 'flag', 'clone'),
        ]),
        when('th-start', letterIs('P'), [
          setVar('th-start-x', 'startX', cellX(v('col'))),
          setVar('th-start-y', 'startY', cellY(v('row'))),
        ]),
      ]),
      { fr: 'Ce que veut dire chaque lettre.', en: 'What each letter means.' },
    ),
    on('coin-clone', 'Sprite', 'coin', 'clone', [
      set('cc-show', 'Sprite', 'coin', 'visible', bool(true)),
      call('cc-spin', 'Sprite', 'coin', 'animate', num(1), num(4), num(8)),
    ]),
    on('block-clone', 'Sprite', 'block', 'clone', [
      set('bc-show', 'Sprite', 'block', 'visible', bool(true)),
    ]),
    on('spikes-clone', 'Sprite', 'spikes', 'clone', [
      set('sc-show', 'Sprite', 'spikes', 'visible', bool(true)),
    ]),
    on('spring-clone', 'Sprite', 'spring', 'clone', [
      set('spc-show', 'Sprite', 'spring', 'visible', bool(true)),
    ]),
    on('flag-clone', 'Sprite', 'flag', 'clone', [
      set('fc-show', 'Sprite', 'flag', 'visible', bool(true)),
      call('fc-wave', 'Sprite', 'flag', 'animate', num(1), num(2), num(3)),
    ]),
    note(
      on('beetle-clone', 'Sprite', 'beetle', 'clone', [
        set('be-show', 'Sprite', 'beetle', 'visible', bool(true)),
        call('be-walk', 'Sprite', 'beetle', 'animate', num(1), num(2), num(6)),
        forever('be-loop', [
          set('be-face-right', 'Sprite', 'beetle', 'flipX', bool(false)),
          call(
            'be-right',
            'Sprite',
            'beetle',
            'glideTo',
            math(self('beetle', 'x'), '+', num(60)),
            self('beetle', 'y'),
            num(1.3),
          ),
          set('be-face-left', 'Sprite', 'beetle', 'flipX', bool(true)),
          call(
            'be-left',
            'Sprite',
            'beetle',
            'glideTo',
            math(self('beetle', 'x'), '-', num(60)),
            self('beetle', 'y'),
            num(1.3),
          ),
        ]),
      ]),
      {
        fr: 'Chaque scarabée (un clone) fait les cent pas, et se retourne au bout.',
        en: 'Each beetle (a clone) walks to and fro, and turns round at each end.',
      },
    ),
    note(
      on('cloud-clone', 'Sprite', 'cloud', 'clone', [
        set('cl-show', 'Sprite', 'cloud', 'visible', bool(true)),
        forever('cl-loop', [
          set('cl-right', 'Sprite', 'cloud', 'vx', num(80)),
          wait('cl-wait-right', 2.5),
          set('cl-left', 'Sprite', 'cloud', 'vx', num(-80)),
          wait('cl-wait-left', 2.5),
        ]),
      ]),
      {
        fr: 'Le nuage va et vient. Il ne se laisse pas pousser : il emmène le héros posé dessus.',
        en: 'The cloud goes back and forth. It cannot be pushed: it carries the hero standing on it.',
      },
    ),
    note(
      on('frame', 'GameScene', scene, 'frame', [
        when(
          'frame-if',
          play(),
          [run('frame-move', MOVE)],
          [set('frame-still', 'Sprite', 'hero', 'vx', num(0))],
        ),
      ]),
      { fr: 'À chaque image, le héros court.', en: 'On every frame, the hero runs.' },
    ),
    note(
      fn('move', MOVE, [
        note(
          set(
            'mv-vx',
            'Sprite',
            'hero',
            'vx',
            math(prop('Joystick', 'stick', 'dx'), '×', v('runSpeed')),
          ),
          {
            fr: 'Le joystick (ou les flèches) donne la vitesse.',
            en: 'The joystick (or the arrows) gives the speed.',
          },
        ),
        when('mv-left', cmp(self('hero', 'vx'), '<', num(-1)), [
          set('mv-flip', 'Sprite', 'hero', 'flipX', bool(true)),
        ]),
        when('mv-right', cmp(self('hero', 'vx'), '>', num(1)), [
          set('mv-unflip', 'Sprite', 'hero', 'flipX', bool(false)),
        ]),
        when(
          'mv-ground',
          self('hero', 'onGround'),
          [
            when(
              'mv-running',
              or(cmp(self('hero', 'vx'), '>', num(20)), cmp(self('hero', 'vx'), '<', num(-20))),
              [call('mv-run', 'Sprite', 'hero', 'animate', num(2), num(3), num(10))],
              [set('mv-idle', 'Sprite', 'hero', 'costume', num(1))],
            ),
          ],
          [set('mv-air', 'Sprite', 'hero', 'costume', num(4))],
        ),
        note(when('mv-fall', cmp(self('hero', 'y'), '>', num(690)), [run('mv-fall-hurt', HURT)]), {
          fr: 'Tombé dans un trou !',
          en: 'Fell into a hole!',
        }),
      ]),
      {
        fr: 'Courir, se retourner, et la bonne image.',
        en: 'Running, turning round, and the right picture.',
      },
    ),
    note(
      fn('jump', JUMP, [
        when('jump-if', and(play(), self('hero', 'onGround')), [
          set('jump-up', 'Sprite', 'hero', 'vy', minus(v('jumpForce'))),
          call('jump-sound', 'Sound', 'sndJump', 'play'),
        ]),
      ]),
      {
        fr: 'Le héros ne saute que s’il est posé sur quelque chose.',
        en: 'The hero only jumps when standing on something.',
      },
    ),
    note(on('jump-tap', 'Sprite', 'jumpButton', 'tap', [run('jump-tap-run', JUMP)]), {
      fr: 'Sauter : le bouton, espace, la flèche du haut, ou glisser vers le haut.',
      en: 'Jumping: the button, space, the up arrow, or a swipe up.',
    }),
    on('jump-space', 'GameScene', scene, 'keyDown', [run('jump-space-run', JUMP)], 'space'),
    on('jump-up-key', 'GameScene', scene, 'keyDown', [run('jump-up-key-run', JUMP)], 'up'),
    on('jump-swipe', 'GameScene', scene, 'swipe', [run('jump-swipe-run', JUMP)], 'up'),
    note(
      on(
        'coin-take',
        'Sprite',
        'coin',
        'hit',
        [
          when('ct-clone', and(play(), self('coin', 'isClone')), [
            call('ct-delete', 'Sprite', 'coin', 'delete'),
            change('ct-score', 'score', 10),
            run('ct-show', FN.score),
            call('ct-sound', 'Sound', 'sndCoin', 'play'),
          ]),
        ],
        'hero',
      ),
      { fr: 'Une pièce : 10 points.', en: 'A coin: 10 points.' },
    ),
    note(
      on(
        'beetle-hit',
        'Sprite',
        'beetle',
        'hit',
        [
          when('bh-clone', and(play(), self('beetle', 'isClone')), [
            when(
              'bh-stomp',
              and(
                cmp(self('hero', 'vy'), '>', num(0)),
                cmp(self('hero', 'y'), '<', math(self('beetle', 'y'), '-', num(14))),
              ),
              [
                note(set('bh-bounce', 'Sprite', 'hero', 'vy', num(-560)), {
                  fr: 'Sauté dessus par en haut : écrasé ! Le héros rebondit.',
                  en: 'Jumped on from above: squashed! The hero bounces.',
                }),
                call('bh-sound', 'Sound', 'sndStomp', 'play'),
                change('bh-score', 'score', 50),
                run('bh-show', FN.score),
                set('bh-flat', 'Sprite', 'beetle', 'costume', num(3)),
                set('bh-flat-h', 'Sprite', 'beetle', 'collision', str('none')),
                wait('bh-wait', 0.4),
                call('bh-delete', 'Sprite', 'beetle', 'delete'),
              ],
              [run('bh-hurt', HURT)],
            ),
          ]),
        ],
        'hero',
      ),
      {
        fr: 'Un scarabée touche le héros : écrasé s’il tombe dessus, sinon aïe.',
        en: 'A beetle touches the hero: squashed if the hero lands on it, ouch otherwise.',
      },
    ),
    on(
      'spikes-hit',
      'Sprite',
      'hero',
      'hit',
      [when('sh-if', play(), [run('sh-hurt', HURT)])],
      'spikes',
    ),
    note(
      on(
        'spring-hit',
        'Sprite',
        'spring',
        'hit',
        [
          when(
            'sp-if',
            and(play(), and(self('spring', 'isClone'), cmp(self('hero', 'vy'), '≥', num(0)))),
            [
              set('sp-up', 'Sprite', 'hero', 'vy', minus(v('springForce'))),
              call('sp-sound', 'Sound', 'sndSpring', 'play'),
              set('sp-open', 'Sprite', 'spring', 'costume', num(2)),
              wait('sp-wait', 0.3),
              set('sp-close', 'Sprite', 'spring', 'costume', num(1)),
            ],
          ),
        ],
        'hero',
      ),
      { fr: 'Un ressort envoie le héros très haut.', en: 'A spring sends the hero very high.' },
    ),
    on('flag-hit', 'Sprite', 'hero', 'hit', [when('fh-if', play(), [run('fh-win', WIN)])], 'flag'),
    note(
      fn('hurt', HURT, [
        when('hurt-if', and(play(), cmp(v('safe'), '=', bool(false))), [
          change('hurt-life', 'lives', -1),
          run('hurt-lives', HUD),
          call('hurt-sound', 'Sound', 'sndHurt', 'play'),
          call('hurt-shake', 'GameScene', scene, 'shake', num(0.3)),
          when(
            'hurt-over',
            cmp(v('lives'), '≤', num(0)),
            [
              setVar('hurt-lost', 'state', str(STATE.lost)),
              set('hurt-face', 'Sprite', 'hero', 'costume', num(5)),
              set('hurt-pause', 'GameScene', scene, 'paused', bool(true)),
              wait('hurt-wait', 0.8),
              run('hurt-end', FN.end),
            ],
            [
              note(call('hurt-back', 'Sprite', 'hero', 'goTo', v('startX'), v('startY')), {
                fr: 'Retour au départ du niveau, sans perdre les pièces.',
                en: 'Back to the start of the level, keeping the coins.',
              }),
              set('hurt-vy', 'Sprite', 'hero', 'vy', num(0)),
              setVar('hurt-safe', 'safe', bool(true)),
              count('hurt-blink', 'blink', 1, 6, 1, [
                set('hurt-dim', 'Sprite', 'hero', 'opacity', num(30)),
                wait('hurt-dim-wait', 0.1),
                set('hurt-light', 'Sprite', 'hero', 'opacity', num(100)),
                wait('hurt-light-wait', 0.1),
              ]),
              setVar('hurt-unsafe', 'safe', bool(false)),
            ],
          ),
        ]),
      ]),
      { fr: 'Aïe : une vie en moins.', en: 'Ouch: one life less.' },
    ),
    note(
      fn('win', WIN, [
        setVar('win-state', 'state', str(STATE.lost)),
        call('win-sound', 'Sound', 'sndWin', 'play'),
        change('win-score', 'score', 200),
        run('win-show', FN.score),
        set(
          'win-banner',
          'SceneText',
          'bannerText',
          'text',
          str({ fr: 'Niveau réussi !', en: 'Level complete!' }),
        ),
        set('win-banner-show', 'SceneText', 'bannerText', 'visible', bool(true)),
        set('win-pause', 'GameScene', scene, 'paused', bool(true)),
        wait('win-wait', 1.6),
        set('win-banner-hide', 'SceneText', 'bannerText', 'visible', bool(false)),
        change('win-next', 'level', 1),
        when(
          'win-last',
          cmp(v('level'), '>', num(LEVELS.length)),
          [setVar('win-all', 'won', bool(true)), run('win-end', FN.end)],
          [run('win-build', BUILD), setVar('win-play', 'state', str(STATE.play))],
        ),
      ]),
      {
        fr: 'Le drapeau : 200 points, puis le niveau suivant (ou la victoire !).',
        en: 'The flag: 200 points, then the next level (or victory!).',
      },
    ),
    fn('hud', HUD, [
      set('hud-text', 'SceneText', 'livesText', 'text', join(str('× '), v('lives'))),
    ]),
  ]
}

export const CLOUD_HOPPER: GameSource = {
  id: 'cloud-hopper',
  order: 22,
  mode: 'studio',
  icon: '☁️',
  accent: 'mint',
  title: { fr: 'Saute-Nuage', en: 'Cloud Hopper' },
  description: {
    fr: 'Un jeu de plateformes : trois niveaux plus larges que l’écran, des scarabées à écraser, un drapeau à atteindre.',
    en: 'A platformer: three levels wider than the screen, beetles to stomp, a flag to reach.',
  },
  theme: { primary: '#2b8fe0', font: 'rounded' },
  variables: [
    ...KIT_VARIABLES,
    { key: 'lives', name: { fr: 'vies', en: 'lives' }, initial: 3 },
    { key: 'runSpeed', name: { fr: 'vitesseCourse', en: 'runSpeed' }, initial: 250 },
    { key: 'jumpForce', name: { fr: 'forceSaut', en: 'jumpForce' }, initial: 780 },
    { key: 'gravity', name: { fr: 'pesanteur', en: 'gravity' }, initial: 2000 },
    { key: 'springForce', name: { fr: 'forceRessort', en: 'springForce' }, initial: 1150 },
    { key: 'level', name: { fr: 'niveau', en: 'level' }, initial: 1 },
    { key: 'won', name: { fr: 'gagné', en: 'won' }, initial: false },
    { key: 'safe', name: { fr: 'protégé', en: 'safe' }, initial: false },
    { key: 'map1', name: { fr: 'niveau1', en: 'level1' }, initial: [] },
    { key: 'map2', name: { fr: 'niveau2', en: 'level2' }, initial: [] },
    { key: 'map3', name: { fr: 'niveau3', en: 'level3' }, initial: [] },
    { key: 'rows', name: { fr: 'rangées', en: 'rows' }, initial: [] },
    { key: 'row', name: { fr: 'rangée', en: 'row' }, initial: 1 },
    { key: 'col', name: { fr: 'colonne', en: 'column' }, initial: 1 },
    { key: 'line', name: { fr: 'texteRangée', en: 'rowText' }, initial: '' },
    { key: 'letter', name: { fr: 'lettre', en: 'letter' }, initial: '' },
    { key: 'runLetter', name: { fr: 'lettreBande', en: 'stripLetter' }, initial: '' },
    { key: 'runStart', name: { fr: 'débutBande', en: 'stripStart' }, initial: 1 },
    { key: 'kind', name: { fr: 'sorte', en: 'kind' }, initial: '' },
    { key: 'from', name: { fr: 'depuis', en: 'from' }, initial: 1 },
    { key: 'tiles', name: { fr: 'cases', en: 'tiles' }, initial: 1 },
    { key: 'startX', name: { fr: 'départX', en: 'startX' }, initial: 60 },
    { key: 'startY', name: { fr: 'départY', en: 'startY' }, initial: 620 },
    { key: 'blink', name: { fr: 'clignote', en: 'blink' }, initial: 0 },
  ],
  screen: { key: 'game', name: { fr: 'Jeu', en: 'Game' }, props: { padding: 0 } },
  components: [
    {
      key: scene,
      type: 'GameScene',
      name: { fr: 'Monde', en: 'World' },
      props: { background: '#7ccbff', edges: 'pass', sceneHeight: 720, worldWidth: 1440 },
      children: [
        sprite(
          'sky',
          { fr: 'Ciel', en: 'Sky' },
          { costumes: ['asset:sky'], x: 180, y: 360, width: 360, height: 720, scroll: 0 },
        ),
        sprite(
          'hills',
          { fr: 'Collines', en: 'Hills' },
          {
            costumes: ['asset:hills'],
            tiled: true,
            x: 360,
            y: 560,
            width: 720,
            height: 240,
            scroll: 30,
          },
        ),
        sprite(
          'clouds',
          { fr: 'Nuages', en: 'Clouds' },
          {
            costumes: ['asset:clouds'],
            tiled: true,
            x: 540,
            y: 180,
            width: 1080,
            height: 200,
            scroll: 50,
          },
        ),
        sprite(
          'block',
          { fr: 'Sol', en: 'Ground' },
          {
            costumes: ['asset:grass', 'asset:dirt'],
            tiled: true,
            x: -200,
            y: -200,
            width: 40,
            height: 40,
            visible: false,
            collision: 'box',
            solid: true,
            pushable: false,
          },
        ),
        sprite(
          'cloud',
          { fr: 'NuageMobile', en: 'MovingCloud' },
          {
            costumes: ['asset:cloud'],
            x: -300,
            y: -200,
            width: 120,
            height: 28,
            visible: false,
            collision: 'box',
            solid: true,
            pushable: false,
          },
        ),
        sprite(
          'spikes',
          { fr: 'Piques', en: 'Spikes' },
          {
            costumes: ['asset:spikes'],
            x: -400,
            y: -200,
            width: 36,
            height: 28,
            visible: false,
            collision: 'box',
          },
        ),
        sprite(
          'spring',
          { fr: 'Ressort', en: 'Spring' },
          {
            costumes: ['asset:spring', 'asset:spring-open'],
            x: -500,
            y: -200,
            width: 40,
            height: 32,
            visible: false,
            collision: 'box',
          },
        ),
        sprite(
          'coin',
          { fr: 'Pièce', en: 'Coin' },
          {
            costumes: ['asset:coin-1', 'asset:coin-2', 'asset:coin-3', 'asset:coin-4'],
            x: -600,
            y: -200,
            width: 28,
            height: 28,
            visible: false,
            collision: 'circle',
          },
        ),
        sprite(
          'flag',
          { fr: 'Drapeau', en: 'Flag' },
          {
            costumes: ['asset:flag-1', 'asset:flag-2'],
            x: -700,
            y: -200,
            width: 44,
            height: 80,
            visible: false,
            collision: 'box',
          },
        ),
        sprite(
          'beetle',
          { fr: 'Scarabée', en: 'Beetle' },
          {
            costumes: ['asset:beetle-1', 'asset:beetle-2', 'asset:beetle-flat'],
            x: -800,
            y: -200,
            width: 44,
            height: 36,
            visible: false,
            collision: 'box',
          },
        ),
        sprite(
          'hero',
          { fr: 'Héros', en: 'Hero' },
          {
            costumes: [
              'asset:pip-idle',
              'asset:pip-run1',
              'asset:pip-run2',
              'asset:pip-jump',
              'asset:pip-hurt',
            ],
            x: 60,
            y: 610,
            width: 42,
            height: 50,
            collision: 'box',
            solid: true,
            bounce: 0,
            edges: 'stop',
          },
        ),
        sprite(
          'heart',
          { fr: 'Cœur', en: 'Heart' },
          {
            costumes: ['asset:heart'],
            x: 30,
            y: 38,
            width: 30,
            height: 30,
            scroll: 0,
            visible: false,
          },
        ),
        {
          key: 'livesText',
          type: 'SceneText',
          name: { fr: 'TexteVies', en: 'LivesText' },
          props: {
            text: '× 3',
            x: 50,
            y: 38,
            align: 'left',
            fontSize: 24,
            color: '#1b3a5c',
            visible: false,
          },
        },
        {
          key: 'levelText',
          type: 'SceneText',
          name: { fr: 'TexteNiveau', en: 'LevelText' },
          props: {
            text: '',
            x: 345,
            y: 38,
            align: 'right',
            fontSize: 20,
            color: '#1b3a5c',
            visible: false,
          },
        },
        {
          key: 'bannerText',
          type: 'SceneText',
          name: { fr: 'TexteAnnonce', en: 'BannerText' },
          props: { text: '', x: 180, y: 300, fontSize: 40, color: '#2f9e44', visible: false },
        },
        {
          key: 'stick',
          type: 'Joystick',
          name: { fr: 'Manette', en: 'Stick' },
          props: {
            x: 70,
            y: 656,
            size: 112,
            color: '#2b8fe0',
            keys: 'arrows',
            opacity: 80,
            visible: false,
          },
        },
        sprite(
          'jumpButton',
          { fr: 'BoutonSaut', en: 'JumpButton' },
          {
            costumes: ['asset:jump-button'],
            x: 296,
            y: 656,
            width: 76,
            height: 80,
            scroll: 0,
            opacity: 90,
            visible: false,
          },
        ),
        ...kitComponents(KIT),
      ],
    },
    {
      key: 'sndJump',
      type: 'Sound',
      name: { fr: 'SonSaut', en: 'JumpSound' },
      props: { src: 'asset:jump' },
    },
    {
      key: 'sndCoin',
      type: 'Sound',
      name: { fr: 'SonPièce', en: 'CoinSound' },
      props: { src: 'asset:coin-sound' },
    },
    {
      key: 'sndStomp',
      type: 'Sound',
      name: { fr: 'SonÉcrase', en: 'StompSound' },
      props: { src: 'asset:stomp' },
    },
    {
      key: 'sndSpring',
      type: 'Sound',
      name: { fr: 'SonRessort', en: 'SpringSound' },
      props: { src: 'asset:boing' },
    },
    {
      key: 'sndHurt',
      type: 'Sound',
      name: { fr: 'SonAïe', en: 'HurtSound' },
      props: { src: 'asset:hurt' },
    },
    {
      key: 'sndWin',
      type: 'Sound',
      name: { fr: 'SonDrapeau', en: 'FlagSound' },
      props: { src: 'asset:flag-sound' },
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
            'pip-idle': { fr: 'Pip debout', en: 'Pip standing' },
            'pip-run1': { fr: 'Pip qui court 1', en: 'Pip running 1' },
            'pip-run2': { fr: 'Pip qui court 2', en: 'Pip running 2' },
            'pip-jump': { fr: 'Pip qui saute', en: 'Pip jumping' },
            'pip-hurt': { fr: 'Pip sonné', en: 'Pip dizzy' },
            'beetle-1': { fr: 'scarabée 1', en: 'beetle 1' },
            'beetle-2': { fr: 'scarabée 2', en: 'beetle 2' },
            'beetle-flat': { fr: 'scarabée écrasé', en: 'squashed beetle' },
            grass: { fr: 'herbe', en: 'grass' },
            dirt: { fr: 'terre', en: 'earth' },
            cloud: { fr: 'nuage mobile', en: 'moving cloud' },
            spikes: { fr: 'piques', en: 'spikes' },
            spring: { fr: 'ressort', en: 'spring' },
            'spring-open': { fr: 'ressort détendu', en: 'sprung spring' },
            'flag-1': { fr: 'drapeau 1', en: 'flag 1' },
            'flag-2': { fr: 'drapeau 2', en: 'flag 2' },
            sky: { fr: 'ciel', en: 'sky' },
            hills: { fr: 'collines', en: 'hills' },
            clouds: { fr: 'nuages', en: 'clouds' },
            'jump-button': { fr: 'bouton sauter', en: 'jump button' },
            heart: { fr: 'cœur', en: 'heart' },
            'coin-1': { fr: 'pièce 1', en: 'coin 1' },
            'coin-2': { fr: 'pièce 2', en: 'coin 2' },
            'coin-3': { fr: 'pièce 3', en: 'coin 3' },
            'coin-4': { fr: 'pièce 4', en: 'coin 4' },
          }[key] ?? { fr: key, en: key },
          svg: file,
        },
      ]),
    ),
    ...kitArt(KIT),
  },
  sounds: {
    jump: { name: { fr: 'saut', en: 'jump' }, wav: COMMON_SOUNDS.jump() },
    'coin-sound': { name: { fr: 'pièce', en: 'coin' }, wav: COMMON_SOUNDS.coin() },
    stomp: {
      name: { fr: 'écrasé', en: 'stomp' },
      wav: wav([
        { wave: 'square', from: 400, to: 120, seconds: 0.12, volume: 0.45, duty: 0.4 },
        { wave: 'noise', from: 1500, to: 300, seconds: 0.1, volume: 0.3 },
      ]),
    },
    boing: {
      name: { fr: 'boing', en: 'boing' },
      wav: wav([
        { wave: 'sine', from: 180, to: 900, seconds: 0.35, volume: 0.6, vibrato: [0.15, 22] },
      ]),
    },
    hurt: { name: { fr: 'aïe', en: 'ouch' }, wav: COMMON_SOUNDS.hurt() },
    'flag-sound': { name: { fr: 'drapeau', en: 'flag' }, wav: wav(melody([0, 4, 7, 12], 0.1)) },
    ...kitSounds(),
  },
  cover: cover(),
}
