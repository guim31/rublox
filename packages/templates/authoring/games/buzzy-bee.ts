import {
  type Block,
  between,
  bool,
  call,
  change,
  cmp,
  fn,
  math,
  note,
  num,
  on,
  prop,
  random,
  run,
  set,
  setVar,
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
import { wav } from './sfx.ts'
import {
  coverStyle,
  embed,
  INK,
  ink,
  rgradient,
  starPath,
  svg,
  symbol,
  use,
  vgradient,
  wave,
} from './svg.ts'
import type { GameSource } from './types.ts'

/**
 * Abeille Zigzag (Buzzy Bee): tap to fly up between honeycomb columns that scroll by, with
 * holes at random heights. One point per gap; faster and narrower as the score grows; a
 * bronze, silver or gold medal at the end.
 */

// Pictures

function bee(state: 'up' | 'down' | 'hurt'): string {
  const wings =
    state === 'up'
      ? `<ellipse cx="24" cy="12" rx="11" ry="16" transform="rotate(-25 24 12)" fill="#e9f7ff" opacity="0.9" ${ink(2.5)}/>` +
        `<ellipse cx="36" cy="11" rx="10" ry="15" transform="rotate(20 36 11)" fill="#d4efff" opacity="0.9" ${ink(2.5)}/>`
      : `<ellipse cx="22" cy="22" rx="14" ry="9" transform="rotate(-15 22 22)" fill="#e9f7ff" opacity="0.9" ${ink(2.5)}/>` +
        `<ellipse cx="35" cy="22" rx="13" ry="8" transform="rotate(12 35 22)" fill="#d4efff" opacity="0.9" ${ink(2.5)}/>`
  const eye =
    state === 'hurt'
      ? `<path d="M41 22 l7 7 M48 22 l-7 7" ${ink(3)}/>`
      : `<circle cx="45" cy="26" r="6.5" fill="#fff" ${ink(2.5)}/><circle cx="47" cy="26.5" r="3.2" fill="${INK}"/><circle cx="48.2" cy="25" r="1.1" fill="#fff"/>`
  const mouth =
    state === 'hurt'
      ? `<ellipse cx="50" cy="40" rx="3" ry="3.5" fill="${INK}"/>`
      : `<path d="M45 39 q4 4 8 -1" fill="none" ${ink(2.5)}/>`
  return svg(
    64,
    56,
    `${wings}` +
      `<path d="M8 36 L1 39 L8 42 Z" fill="${INK}"/>` +
      `<ellipse cx="31" cy="36" rx="24" ry="17" fill="url(#body)" ${ink(3)}/>` +
      `<g clip-path="url(#clip)"><rect x="14" y="16" width="7" height="40" fill="${INK}"/><rect x="27" y="16" width="7" height="40" fill="${INK}"/></g>` +
      `<ellipse cx="31" cy="36" rx="24" ry="17" fill="none" ${ink(3)}/>` +
      `<path d="M41 20 q3 -10 9 -14" fill="none" ${ink(2.5)}/><circle cx="51" cy="6" r="3" fill="${INK}"/>` +
      `<ellipse cx="30" cy="27" rx="9" ry="3.5" fill="#fff" opacity="0.5"/>` +
      `<circle cx="53" cy="33" r="3" fill="#ff8f8f" opacity="0.8"/>${eye}${mouth}`,
    `${rgradient('body', [
      [0, '#fff3a3'],
      [0.55, '#ffd23f'],
      [1, '#f5a623'],
    ])}<clipPath id="clip"><ellipse cx="31" cy="36" rx="24" ry="17"/></clipPath>`,
  )
}

function column(): string {
  const cells: string[] = []
  for (let row = 0; row < 26; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 14 + col * 18 + (row % 2 ? 9 : 0)
      const y = 52 + row * 23
      if (x > 78) continue
      cells.push(
        `<path d="M${x} ${y - 9} l8 4.5 v9 l-8 4.5 l-8 -4.5 v-9 Z" fill="#ffcf4a" opacity="0.55" stroke="#d9891a" stroke-width="1.5"/>`,
      )
    }
  }
  return svg(
    88,
    640,
    `<rect x="8" y="20" width="72" height="616" fill="url(#wax)" ${ink(3)}/>` +
      `<g clip-path="url(#inside)">${cells.join('')}</g>` +
      `<rect x="16" y="30" width="8" height="600" fill="#fff" opacity="0.25"/>` +
      `<rect x="2" y="4" width="84" height="36" rx="10" fill="url(#cap)" ${ink(3)}/>` +
      `<path d="M20 40 q0 18 6 18 q6 0 6 -18 M54 40 q0 26 7 26 q7 0 7 -26" fill="#f7a81b" ${ink(2.5)}/>` +
      `<rect x="10" y="10" width="50" height="8" rx="4" fill="#fff" opacity="0.4"/>`,
    vgradient('wax', [
      [0, '#ffc93c'],
      [1, '#f29b16'],
    ]) +
      vgradient('cap', [
        [0, '#ffd66b'],
        [1, '#f0a020'],
      ]) +
      `<clipPath id="inside"><rect x="10" y="22" width="68" height="612"/></clipPath>`,
  )
}

function sky(): string {
  return svg(
    360,
    720,
    `<rect width="360" height="720" fill="url(#sky)"/>` +
      `<circle cx="285" cy="118" r="70" fill="#fff6c2" opacity="0.5"/>` +
      `<circle cx="285" cy="118" r="44" fill="url(#sun)" ${ink(3)}/>` +
      `<path d="M270 112 q4 -5 8 0 M292 112 q4 -5 8 0 M274 128 q11 9 22 0" fill="none" ${ink(2.5)}/>`,
    vgradient('sky', [
      [0, '#6cc4ff'],
      [0.6, '#b9e7ff'],
      [1, '#fff3c4'],
    ]) +
      rgradient('sun', [
        [0, '#fffbd0'],
        [1, '#ffcf3a'],
      ]),
  )
}

function hills(): string {
  const flowers: string[] = []
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 40
    const y = 150 + ((i * 37) % 50)
    const color = ['#ff6fa8', '#ffffff', '#ffd23f'][i % 3]
    flowers.push(
      `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="${INK}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="1.8" fill="#f59e0b"/>`,
    )
  }
  return svg(
    360,
    220,
    `<path d="${wave(
      360,
      90,
      [
        [22, 1, 0.6],
        [10, 3, 1.8],
      ],
      220,
    )}" fill="#a8e29a" ${ink(3)}/>` +
      `<path d="${wave(
        360,
        135,
        [
          [18, 2, 2.4],
          [6, 5, 0.3],
        ],
        220,
      )}" fill="#6cc76a" ${ink(3)}/>` +
      flowers.join(''),
  )
}

function ground(): string {
  const blades: string[] = []
  for (let x = 0; x < 360; x += 12) blades.push(`l6 -9 l6 9`)
  const pebbles: string[] = []
  for (let i = 0; i < 12; i++) {
    pebbles.push(
      `<ellipse cx="${15 + i * 30}" cy="${48 + ((i * 17) % 30)}" rx="5" ry="3" fill="#b27b4b" opacity="0.8"/>`,
    )
  }
  return svg(
    360,
    90,
    `<rect x="-4" y="22" width="368" height="72" fill="url(#dirt)" ${ink(3)}/>` +
      pebbles.join('') +
      `<path d="M-4 30 L0 30 ${blades.join(' ')} L364 30 L364 16 L-4 16 Z" fill="#58b84f" ${ink(3)}/>` +
      `<rect x="-4" y="16" width="368" height="5" fill="#8be07f"/>`,
    vgradient('dirt', [
      [0, '#d39a62'],
      [1, '#a86e3c'],
    ]),
  )
}

function cloud(): string {
  return svg(
    140,
    70,
    `<path d="M20 60 q-16 0 -16 -14 q0 -14 16 -14 q2 -20 24 -20 q14 0 22 10 q8 -8 20 -8 q22 0 24 22 q18 0 18 12 q0 12 -16 12 Z" fill="#ffffff" ${ink(3)}/>` +
      `<path d="M24 56 q40 6 90 0" fill="none" stroke="#cfe7f7" stroke-width="5" stroke-linecap="round"/>`,
  )
}

function medal(fill: string, dark: string): string {
  return svg(
    72,
    80,
    `<path d="M22 0 L34 26 L22 30 L12 2 Z" fill="#e8344f" ${ink(2.5)}/>` +
      `<path d="M50 0 L38 26 L50 30 L60 2 Z" fill="#5b4bff" ${ink(2.5)}/>` +
      `<circle cx="36" cy="50" r="26" fill="url(#m)" ${ink(3)}/>` +
      `<circle cx="36" cy="50" r="19" fill="none" stroke="${dark}" stroke-width="2.5"/>` +
      `<path d="${starPath(36, 51, 12, 5.5)}" fill="#fff" opacity="0.85" ${ink(2)}/>`,
    rgradient('m', [
      [0, '#ffffff'],
      [0.35, fill],
      [1, dark],
    ]),
  )
}

const ART = {
  'bee-up': bee('up'),
  'bee-down': bee('down'),
  'bee-hurt': bee('hurt'),
  column: column(),
  sky: sky(),
  hills: hills(),
  ground: ground(),
  cloud: cloud(),
  bronze: medal('#e0915a', '#9a5a2a'),
  silver: medal('#dfe6ee', '#8995a6'),
  gold: medal('#ffd84a', '#d18e0c'),
}

function cover(): string {
  const pair = (x: number, gap: number) =>
    use('col', x, gap - 410, 52, 378, `transform="rotate(180 ${x + 26} ${gap - 221})"`) +
    use('col', x, gap + 40, 52, 378)
  return svg(
    340,
    220,
    coverStyle(
      '.bee { animation: fly 0.9s ease-in-out infinite alternate; } ' +
        '.wing { animation: flap 0.16s steps(1) infinite; } ' +
        '.scroll { animation: slide 2.4s linear infinite; } ' +
        '@keyframes fly { from { transform: translateY(16px); } to { transform: translateY(-16px); } } ' +
        '@keyframes flap { 50% { opacity: 0; } } ' +
        '@keyframes slide { from { transform: translateX(0); } to { transform: translateX(-130px); } }',
    ) +
      `<defs>${symbol(ART.column, 'col')}</defs>` +
      embed(ART.sky, 0, -300, 340, 604, 'sky') +
      embed(ART.hills, 0, 46, 340, 208, 'hills') +
      `<g class="scroll">${pair(150, 110)}${pair(280, 80)}${pair(410, 110)}${pair(540, 80)}</g>` +
      embed(ART.ground, 0, 176, 340, 85, 'ground') +
      `<g class="bee">${embed(ART['bee-down'], 56, 78, 74, 64, 'b1')}<g class="wing">${embed(ART['bee-up'], 56, 78, 74, 64, 'b2')}</g></g>`,
  )
}

// Recipe

const FLY = { fr: 'faire voler l’abeille', en: 'make the bee fly' }
const SPAWN = { fr: 'faire venir des colonnes', en: 'bring in columns' }
const CRASH = { fr: 'l’abeille se cogne', en: 'the bee bumps' }
const SCENERY = { fr: 'faire défiler le décor', en: 'scroll the scenery' }
const MEDAL = { fr: 'donner une médaille', en: 'give a medal' }

const scene = 'meadow'
const sprite = (key: string, name: { fr: string; en: string }, props: Record<string, unknown>) => ({
  key,
  type: 'Sprite',
  name,
  props: { collision: 'none', ...props },
})

const KIT = {
  scene,
  title: { fr: 'Abeille Zigzag', en: 'Buzzy Bee' },
  hint: {
    fr: 'Touche l’écran (ou espace) pour voler.\nPasse entre les colonnes !',
    en: 'Tap the screen (or space) to fly.\nGo between the columns!',
  },
  overTitle: { fr: 'Bzzz… aïe !', en: 'Bzzz… ouch!' },
  textColor: '#2d1f3d',
  buttonColor: ['#5ad15a', '#2f9e44'] as [string, string],
  panelColor: ['#fff8dc', '#f5a623'] as [string, string],
}

/** "the column keeps going left": the clones get the speed of the moment. */
const slide = (id: string, key: string) =>
  on(id, 'Sprite', key, 'clone', [
    set(`${id}-vx`, 'Sprite', key, 'vx', math(num(0), '-', v('speed'))),
  ])

function blocks(): Block[] {
  const play = cmp(v('state'), '=', str(STATE.play))
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
        note(setVar('set-gravity', 'gravity', num(1300)), {
          fr: 'Plus c’est grand, plus l’abeille tombe vite.',
          en: 'The bigger, the faster the bee falls.',
        }),
        note(setVar('set-flap', 'flap', num(400)), {
          fr: 'La force d’un battement d’ailes.',
          en: 'How strong one flap of the wings is.',
        }),
        note(setVar('set-gap', 'gap', num(180)), {
          fr: 'La hauteur du passage entre deux colonnes.',
          en: 'The height of the way between two columns.',
        }),
        setVar('set-speed', 'speed', num(150)),
      ]),
      CHANGE_ME,
    ),
    ...kitBlocks({
      scene,
      onTitle: [
        call('t-clones', 'GameScene', scene, 'deleteClones'),
        set('t-unpause', 'GameScene', scene, 'paused', bool(false)),
        call('t-bee-place', 'Sprite', 'bee', 'goTo', num(110), num(340)),
        set('t-bee-gravity', 'Sprite', 'bee', 'gravity', num(0)),
        set('t-bee-vy', 'Sprite', 'bee', 'vy', num(0)),
        set('t-bee-turn', 'Sprite', 'bee', 'rotation', num(0)),
        call('t-bee-flap', 'Sprite', 'bee', 'animate', num(1), num(2), num(8)),
        set('t-ground', 'Sprite', 'ground', 'vx', num(-60)),
        set('t-medal', 'Sprite', 'medal', 'visible', bool(false)),
      ],
      onStart: [
        call('s-clones', 'GameScene', scene, 'deleteClones'),
        set('s-unpause', 'GameScene', scene, 'paused', bool(false)),
        run('s-settings', FN.settings),
        set('s-medal', 'Sprite', 'medal', 'visible', bool(false)),
        call('s-bee-place', 'Sprite', 'bee', 'goTo', num(110), num(340)),
        call('s-bee-flap', 'Sprite', 'bee', 'animate', num(1), num(2), num(12)),
        note(set('s-bee-gravity', 'Sprite', 'bee', 'gravity', v('gravity')), {
          fr: 'La gravité tire l’abeille vers le bas.',
          en: 'Gravity pulls the bee down.',
        }),
        run('s-fly', FLY),
        set('s-ground', 'Sprite', 'ground', 'vx', math(num(0), '-', v('speed'))),
        setVar('s-gap-y', 'gapY', num(360)),
        set('s-pace', 'Timer', 'spawner', 'interval', num(1.7)),
        call('s-timer', 'Timer', 'spawner', 'start'),
      ],
      onEnd: [run('e-medal', MEDAL)],
    }),
    note(
      fn('fly', FLY, [
        set('fly-up', 'Sprite', 'bee', 'vy', math(num(0), '-', v('flap'))),
        call('fly-sound', 'Sound', 'sndFlap', 'play'),
      ]),
      {
        fr: 'Un battement : l’abeille repart vers le haut.',
        en: 'One flap: the bee goes up again.',
      },
    ),
    note(on('tap', 'GameScene', scene, 'tap', [when('tap-if', play, [run('tap-fly', FLY)])]), {
      fr: 'Toucher l’écran fait voler l’abeille.',
      en: 'Tapping the screen makes the bee fly.',
    }),
    note(
      on(
        'key',
        'GameScene',
        scene,
        'keyDown',
        [
          when(
            'key-if',
            play,
            [run('key-fly', FLY)],
            [
              when('key-title', cmp(v('state'), '=', str(STATE.title)), [
                run('key-start', FN.start),
              ]),
            ],
          ),
        ],
        'space',
      ),
      { fr: 'Sur un ordinateur, la barre d’espace.', en: 'On a computer, the space bar.' },
    ),
    note(
      on('tick', 'Timer', 'spawner', 'tick', [when('tick-if', play, [run('tick-spawn', SPAWN)])]),
      { fr: 'Le minuteur amène des colonnes.', en: 'The timer brings columns in.' },
    ),
    note(
      fn('spawn', SPAWN, [
        note(
          setVar('spawn-y', 'gapY', between(math(v('gapY'), '+', random(-120, 120)), 190, 470)),
          {
            fr: 'Le passage monte ou descend un peu, au hasard (pas trop : il faut pouvoir l’atteindre).',
            en: 'The way moves up or down a bit, at random (not too much: it must be reachable).',
          },
        ),
        call(
          'spawn-top',
          'Sprite',
          'columnTop',
          'goTo',
          num(430),
          math(math(v('gapY'), '-', math(v('gap'), '÷', num(2))), '-', num(320)),
        ),
        call('spawn-top-clone', 'Sprite', 'columnTop', 'clone'),
        call(
          'spawn-bottom',
          'Sprite',
          'columnBottom',
          'goTo',
          num(430),
          math(math(v('gapY'), '+', math(v('gap'), '÷', num(2))), '+', num(320)),
        ),
        call('spawn-bottom-clone', 'Sprite', 'columnBottom', 'clone'),
        call('spawn-gate', 'Sprite', 'gate', 'goTo', num(430), v('gapY')),
        call('spawn-gate-clone', 'Sprite', 'gate', 'clone'),
      ]),
      {
        fr: 'Deux colonnes et, entre elles, un passage invisible qui compte les points.',
        en: 'Two columns and, between them, an invisible gate that counts the points.',
      },
    ),
    slide('top-clone', 'columnTop'),
    slide('bottom-clone', 'columnBottom'),
    slide('gate-clone', 'gate'),
    note(
      on(
        'gate-hit',
        'Sprite',
        'gate',
        'hit',
        [
          call('gate-delete', 'Sprite', 'gate', 'delete'),
          change('gate-score', 'score', 1),
          run('gate-show', FN.score),
          call('gate-sound', 'Sound', 'sndPoint', 'play'),
          note(setVar('gate-speed', 'speed', between(math(v('speed'), '+', num(4)), 0, 270)), {
            fr: 'De plus en plus vite…',
            en: 'Faster and faster…',
          }),
          note(setVar('gate-gap', 'gap', between(math(v('gap'), '-', num(2)), 130, 400)), {
            fr: '… et le passage se resserre.',
            en: '… and the way gets narrower.',
          }),
          set('gate-ground', 'Sprite', 'ground', 'vx', math(num(0), '-', v('speed'))),
          set('gate-pace', 'Timer', 'spawner', 'interval', math(num(260), '÷', v('speed'))),
        ],
        'bee',
      ),
      { fr: 'L’abeille passe : un point !', en: 'The bee goes through: one point!' },
    ),
    ...['columnTop', 'columnBottom', 'ground'].map((other) =>
      on(
        `crash-${other}`,
        'Sprite',
        'bee',
        'hit',
        [when(`crash-${other}-if`, play, [run(`crash-${other}-run`, CRASH)])],
        other,
      ),
    ),
    note(
      fn('crash', CRASH, [
        setVar('crash-state', 'state', str(STATE.lost)),
        call('crash-sound', 'Sound', 'sndHit', 'play'),
        call('crash-shake', 'GameScene', scene, 'shake', num(0.4)),
        set('crash-costume', 'Sprite', 'bee', 'costume', num(3)),
        call('crash-timer', 'Timer', 'spawner', 'stop'),
        note(set('crash-pause', 'GameScene', scene, 'paused', bool(true)), {
          fr: 'En pause, tout s’arrête.',
          en: 'Paused, everything stops.',
        }),
        wait('crash-wait', 0.7),
        run('crash-end', FN.end),
      ]),
      {
        fr: 'Aïe ! Tout s’arrête, puis la fin de la partie.',
        en: 'Ouch! Everything stops, then the game ends.',
      },
    ),
    note(
      fn('medal', MEDAL, [
        when(
          'medal-gold',
          cmp(v('score'), '≥', num(30)),
          [
            set('medal-3', 'Sprite', 'medal', 'costume', num(3)),
            set('medal-show-3', 'Sprite', 'medal', 'visible', bool(true)),
          ],
          [
            when(
              'medal-silver',
              cmp(v('score'), '≥', num(15)),
              [
                set('medal-2', 'Sprite', 'medal', 'costume', num(2)),
                set('medal-show-2', 'Sprite', 'medal', 'visible', bool(true)),
              ],
              [
                when('medal-bronze', cmp(v('score'), '≥', num(5)), [
                  set('medal-1', 'Sprite', 'medal', 'costume', num(1)),
                  set('medal-show-1', 'Sprite', 'medal', 'visible', bool(true)),
                ]),
              ],
            ),
          ],
        ),
      ]),
      {
        fr: 'Bronze dès 5 points, argent dès 15, or dès 30.',
        en: 'Bronze from 5 points, silver from 15, gold from 30.',
      },
    ),
    note(
      on('frame', 'GameScene', scene, 'frame', [
        when('frame-if', play, [
          note(
            set(
              'frame-tilt',
              'Sprite',
              'bee',
              'rotation',
              between(math(prop('Sprite', 'bee', 'vy'), '÷', num(8)), -25, 70),
            ),
            { fr: 'Elle pique du nez quand elle tombe.', en: 'It dives when it falls.' },
          ),
        ]),
        run('frame-scenery', SCENERY),
      ]),
      { fr: 'À chaque image.', en: 'On every frame.' },
    ),
    note(
      fn('scenery', SCENERY, [
        when('wrap-ground', cmp(prop('Sprite', 'ground', 'x'), '<', num(0)), [
          call('wrap-ground-move', 'Sprite', 'ground', 'moveBy', num(360), num(0)),
        ]),
        when('wrap-hills', cmp(prop('Sprite', 'hills', 'x'), '<', num(0)), [
          call('wrap-hills-move', 'Sprite', 'hills', 'moveBy', num(360), num(0)),
        ]),
        when('wrap-cloud1', cmp(prop('Sprite', 'cloud1', 'x'), '<', num(-80)), [
          call('wrap-cloud1-move', 'Sprite', 'cloud1', 'goTo', num(440), random(60, 220)),
        ]),
        when('wrap-cloud2', cmp(prop('Sprite', 'cloud2', 'x'), '<', num(-80)), [
          call('wrap-cloud2-move', 'Sprite', 'cloud2', 'goTo', num(440), random(60, 220)),
        ]),
      ]),
      {
        fr: 'Les décors sont des images répétées : arrivés au bout, ils reculent d’une image.',
        en: 'The scenery is made of repeated pictures: at the end, they step back by one picture.',
      },
    ),
  ]
}

export const BUZZY_BEE: GameSource = {
  id: 'buzzy-bee',
  order: 21,
  mode: 'junior',
  icon: '🐝',
  accent: 'yellow',
  title: { fr: 'Abeille Zigzag', en: 'Buzzy Bee' },
  description: {
    fr: 'Touche l’écran pour voler entre les colonnes de miel. Médailles, record, vitesse qui monte.',
    en: 'Tap to fly between honey columns. Medals, best score, rising speed.',
  },
  theme: { primary: '#f08c00', font: 'rounded' },
  variables: [
    ...KIT_VARIABLES,
    { key: 'gravity', name: { fr: 'pesanteur', en: 'gravity' }, initial: 1300 },
    { key: 'flap', name: { fr: 'battement', en: 'flap' }, initial: 400 },
    { key: 'gap', name: { fr: 'passage', en: 'gap' }, initial: 180 },
    { key: 'speed', name: { fr: 'vitesse', en: 'speed' }, initial: 150 },
    { key: 'gapY', name: { fr: 'hauteurPassage', en: 'gapHeight' }, initial: 320 },
  ],
  screen: { key: 'game', name: { fr: 'Jeu', en: 'Game' }, props: { padding: 0 } },
  components: [
    {
      key: scene,
      type: 'GameScene',
      name: { fr: 'Prairie', en: 'Meadow' },
      props: { background: '#6cc4ff', edges: 'pass', sceneHeight: 720 },
      children: [
        sprite(
          'sky',
          { fr: 'Ciel', en: 'Sky' },
          { costumes: ['asset:sky'], x: 180, y: 360, width: 360, height: 720 },
        ),
        sprite(
          'cloud1',
          { fr: 'Nuage1', en: 'Cloud1' },
          { costumes: ['asset:cloud'], x: 90, y: 90, width: 120, height: 60, vx: -14 },
        ),
        sprite(
          'cloud2',
          { fr: 'Nuage2', en: 'Cloud2' },
          { costumes: ['asset:cloud'], x: 300, y: 200, width: 90, height: 45, vx: -24 },
        ),
        sprite(
          'hills',
          { fr: 'Collines', en: 'Hills' },
          {
            costumes: ['asset:hills'],
            tiled: true,
            x: 360,
            y: 540,
            width: 1080,
            height: 220,
            vx: -18,
          },
        ),
        sprite(
          'columnTop',
          { fr: 'ColonneHaut', en: 'TopColumn' },
          {
            costumes: ['asset:column'],
            x: -300,
            y: -300,
            width: 88,
            height: 640,
            rotation: 180,
            collision: 'box',
          },
        ),
        sprite(
          'columnBottom',
          { fr: 'ColonneBas', en: 'BottomColumn' },
          {
            costumes: ['asset:column'],
            x: -300,
            y: 900,
            width: 88,
            height: 640,
            collision: 'box',
          },
        ),
        sprite(
          'gate',
          { fr: 'Passage', en: 'Gate' },
          {
            costumes: ['asset:column'],
            x: -300,
            y: 320,
            width: 80,
            height: 120,
            opacity: 0,
            collision: 'box',
          },
        ),
        sprite(
          'ground',
          { fr: 'Sol', en: 'Ground' },
          {
            costumes: ['asset:ground'],
            tiled: true,
            x: 360,
            y: 670,
            width: 1080,
            height: 100,
            collision: 'box',
          },
        ),
        sprite(
          'bee',
          { fr: 'Abeille', en: 'Bee' },
          {
            costumes: ['asset:bee-up', 'asset:bee-down', 'asset:bee-hurt'],
            x: 110,
            y: 340,
            width: 60,
            height: 52,
            collision: 'circle',
            edges: 'stop',
          },
        ),
        ...kitComponents(KIT),
        sprite(
          'medal',
          { fr: 'Médaille', en: 'Medal' },
          {
            costumes: ['asset:bronze', 'asset:silver', 'asset:gold'],
            x: 180,
            y: 412,
            width: 52,
            height: 58,
            visible: false,
          },
        ),
      ],
    },
    {
      key: 'spawner',
      type: 'Timer',
      name: { fr: 'Colonnes', en: 'Columns' },
      props: { interval: 1.6, repeat: true, autostart: false },
    },
    {
      key: 'sndFlap',
      type: 'Sound',
      name: { fr: 'SonAile', en: 'FlapSound' },
      props: { src: 'asset:flap' },
    },
    {
      key: 'sndPoint',
      type: 'Sound',
      name: { fr: 'SonPoint', en: 'PointSound' },
      props: { src: 'asset:point' },
    },
    {
      key: 'sndHit',
      type: 'Sound',
      name: { fr: 'SonChoc', en: 'BumpSound' },
      props: { src: 'asset:bump' },
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
            'bee-up': { fr: 'abeille ailes en haut', en: 'bee wings up' },
            'bee-down': { fr: 'abeille ailes en bas', en: 'bee wings down' },
            'bee-hurt': { fr: 'abeille sonnée', en: 'dizzy bee' },
            column: { fr: 'colonne de miel', en: 'honey column' },
            sky: { fr: 'ciel', en: 'sky' },
            hills: { fr: 'collines', en: 'hills' },
            ground: { fr: 'sol', en: 'ground' },
            cloud: { fr: 'nuage', en: 'cloud' },
            bronze: { fr: 'médaille de bronze', en: 'bronze medal' },
            silver: { fr: 'médaille d’argent', en: 'silver medal' },
            gold: { fr: 'médaille d’or', en: 'gold medal' },
          }[key] ?? { fr: key, en: key },
          svg: file,
        },
      ]),
    ),
    ...kitArt(KIT),
  },
  sounds: {
    flap: {
      name: { fr: 'battement', en: 'flap' },
      wav: wav([
        { wave: 'noise', from: 3000, to: 1200, seconds: 0.09, volume: 0.35 },
        { wave: 'triangle', from: 520, to: 780, seconds: 0.09, volume: 0.35 },
      ]),
    },
    point: {
      name: { fr: 'point', en: 'point' },
      wav: wav([
        { wave: 'square', from: 988, seconds: 0.06, volume: 0.35, duty: 0.25 },
        { wave: 'square', from: 1319, seconds: 0.16, at: 0.06, volume: 0.35, duty: 0.25 },
      ]),
    },
    bump: {
      name: { fr: 'choc', en: 'bump' },
      wav: wav(
        [
          { wave: 'noise', from: 900, to: 100, seconds: 0.3, volume: 0.6 },
          { wave: 'square', from: 220, to: 60, seconds: 0.3, volume: 0.4 },
        ],
        5,
      ),
    },
    ...kitSounds(),
  },
  cover: cover(),
}
