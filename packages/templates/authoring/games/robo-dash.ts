import {
  and,
  type Block,
  bool,
  call,
  change,
  choose,
  cmp,
  ev,
  fn,
  math,
  note,
  num,
  on,
  prop,
  random,
  repeat,
  round,
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
import { COMMON_SOUNDS, wav } from './sfx.ts'
import {
  coin,
  coverStyle,
  embed,
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
 * Robot Fonceur (Robo Dash): an endless run. Jump over crates and barriers, slide under drones,
 * pick up bolts; the faster it goes, the more it scores. Three layers of scenery scroll at
 * different speeds (parallax) and the day turns to night, then back.
 */

// Pictures

function robot(pose: 'run1' | 'run2' | 'jump' | 'slide' | 'hurt'): string {
  const eye =
    pose === 'hurt'
      ? `<path d="M40 28 l8 8 M48 28 l-8 8 M54 28 l8 8 M62 28 l-8 8" ${ink(3)}/>`
      : `<rect x="38" y="26" width="28" height="13" rx="6.5" fill="#1b2d4f" ${ink(2.5)}/><circle cx="${pose === 'jump' ? 60 : 58}" cy="32.5" r="4" fill="#5ef1ff"/><circle cx="${pose === 'jump' ? 48 : 46}" cy="32.5" r="4" fill="#5ef1ff"/>`
  const legs = {
    run1: `<path d="M30 62 l-10 14 M46 62 l12 12" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M30 62 l-10 14 M46 62 l12 12" stroke="#9aa7c2" stroke-width="3.5" stroke-linecap="round"/>`,
    run2: `<path d="M30 62 l8 14 M46 62 l-4 15" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M30 62 l8 14 M46 62 l-4 15" stroke="#9aa7c2" stroke-width="3.5" stroke-linecap="round"/>`,
    jump: `<path d="M30 62 q-8 4 -12 10 M46 62 q10 2 14 8" stroke="${INK}" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M30 62 q-8 4 -12 10 M46 62 q10 2 14 8" stroke="#9aa7c2" stroke-width="3.5" stroke-linecap="round" fill="none"/>`,
    hurt: `<path d="M30 62 l-6 14 M46 62 l6 14" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M30 62 l-6 14 M46 62 l6 14" stroke="#9aa7c2" stroke-width="3.5" stroke-linecap="round"/>`,
    slide: '',
  }[pose]
  if (pose === 'slide') {
    return svg(
      80,
      80,
      `<rect x="6" y="40" width="70" height="30" rx="14" fill="url(#metal)" ${ink(3)}/>` +
        `<rect x="44" y="46" width="26" height="12" rx="6" fill="#1b2d4f" ${ink(2.5)}/><circle cx="62" cy="52" r="3.5" fill="#5ef1ff"/>` +
        `<path d="M8 64 l-6 0 M10 56 l-8 -2" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
        `<path d="M26 40 q-2 -10 6 -14" stroke="${INK}" stroke-width="3" fill="none"/><circle cx="33" cy="25" r="4" fill="#ff5d73" ${ink(2)}/>` +
        `<circle cx="20" cy="72" r="6" fill="#4a5578" ${ink(2.5)}/><circle cx="58" cy="72" r="6" fill="#4a5578" ${ink(2.5)}/>`,
      vgradient('metal', [
        [0, '#e7eefc'],
        [1, '#9fb0d6'],
      ]),
    )
  }
  return svg(
    80,
    80,
    legs +
      `<path d="M40 14 q-2 -8 4 -11" stroke="${INK}" stroke-width="3" fill="none"/><circle cx="45" cy="3.5" r="3.5" fill="#ff5d73" ${ink(2)}/>` +
      `<rect x="20" y="12" width="52" height="40" rx="14" fill="url(#metal)" ${ink(3)}/>` +
      eye +
      `<rect x="26" y="16" width="20" height="5" rx="2.5" fill="#fff" opacity="0.7"/>` +
      `<rect x="24" y="48" width="32" height="18" rx="7" fill="#ff8f3c" ${ink(3)}/>` +
      `<circle cx="40" cy="57" r="3.5" fill="#ffe066" ${ink(1.5)}/>` +
      `<path d="M24 54 l-12 ${pose === 'jump' ? -12 : 4}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M24 54 l-12 ${pose === 'jump' ? -12 : 4}" stroke="#9aa7c2" stroke-width="2.5" stroke-linecap="round"/>`,
    vgradient('metal', [
      [0, '#e7eefc'],
      [1, '#9fb0d6'],
    ]),
  )
}

function crate(): string {
  return svg(
    64,
    64,
    `<rect x="3" y="3" width="58" height="58" rx="5" fill="url(#wood)" ${ink(3)}/>` +
      `<rect x="10" y="10" width="44" height="44" fill="none" stroke="#8a4e1c" stroke-width="3"/>` +
      `<path d="M10 10 L54 54 M54 10 L10 54" stroke="#8a4e1c" stroke-width="4"/>` +
      `<rect x="3" y="3" width="58" height="58" rx="5" fill="none" ${ink(3)}/>`,
    vgradient('wood', [
      [0, '#f2b766'],
      [1, '#c97a2c'],
    ]),
  )
}

function barrier(): string {
  return svg(
    64,
    100,
    `<rect x="10" y="40" width="7" height="58" fill="#7d879c" ${ink(2.5)}/><rect x="47" y="40" width="7" height="58" fill="#7d879c" ${ink(2.5)}/>` +
      `<g clip-path="url(#bar)"><rect x="2" y="8" width="60" height="34" fill="#fff"/>` +
      [0, 1, 2, 3, 4]
        .map((i) => `<path d="M${-8 + i * 22} 42 l18 -34 l11 0 l-18 34 Z" fill="#ff5d3a"/>`)
        .join('') +
      `</g><rect x="2" y="8" width="60" height="34" rx="5" fill="none" ${ink(3)}/>` +
      `<circle cx="13" cy="6" r="5" fill="#ffd23f" ${ink(2)}/><circle cx="51" cy="6" r="5" fill="#ffd23f" ${ink(2)}/>`,
    `<clipPath id="bar"><rect x="2" y="8" width="60" height="34" rx="5"/></clipPath>`,
  )
}

function drone(): string {
  return svg(
    90,
    52,
    `<path d="M14 14 l18 8 M76 14 l-18 8" stroke="${INK}" stroke-width="4"/>` +
      `<ellipse cx="14" cy="10" rx="13" ry="3.5" fill="#cfe6ff" opacity="0.9" ${ink(2)}/><ellipse cx="76" cy="10" rx="13" ry="3.5" fill="#cfe6ff" opacity="0.9" ${ink(2)}/>` +
      `<path d="M22 24 q23 -14 46 0 l-4 18 q-19 10 -38 0 Z" fill="url(#d)" ${ink(3)}/>` +
      `<circle cx="45" cy="32" r="8" fill="#2b1b3f" ${ink(2)}/><circle cx="45" cy="32" r="4" fill="#ff3b5c"/>` +
      `<path d="M30 26 q8 -6 14 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>`,
    vgradient('d', [
      [0, '#a78bfa'],
      [1, '#6d4fe0'],
    ]),
  )
}

function bolt(): string {
  return coin(1, 40).replace(
    '</svg>',
    `<path d="M22 9 L13 22 L20 22 L17 31 L27 17 L20 17 Z" fill="#fff8d0" stroke="#c98a12" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  )
}

function sky(night: boolean): string {
  const stars = night
    ? Array.from({ length: 40 }, (_, i) => {
        const x = (i * 97) % 360
        const y = (i * 53) % 420
        return `<circle cx="${x}" cy="${y}" r="${i % 5 === 0 ? 2 : 1.2}" fill="#fff" opacity="${0.5 + (i % 3) * 0.2}"/>`
      }).join('')
    : ''
  const orb = night
    ? `<circle cx="270" cy="120" r="34" fill="#f4f1d0" ${ink(3)}/><circle cx="258" cy="110" r="7" fill="#dcd6a8"/><circle cx="282" cy="132" r="5" fill="#dcd6a8"/>`
    : `<circle cx="270" cy="120" r="60" fill="#ffe9a8" opacity="0.5"/><circle cx="270" cy="120" r="38" fill="#ffd23f" ${ink(3)}/>`
  return svg(
    360,
    720,
    `<rect width="360" height="720" fill="url(#s)"/>${stars}${orb}`,
    vgradient(
      's',
      night
        ? [
            [0, '#0b1033'],
            [0.7, '#2a2a6e'],
            [1, '#5a3d8a'],
          ]
        : [
            [0, '#57b9ff'],
            [0.7, '#a9e0ff'],
            [1, '#ffe2b8'],
          ],
    ),
  )
}

function mountains(): string {
  return svg(
    360,
    220,
    `<path d="${wave(
      360,
      110,
      [
        [40, 2, 0.4],
        [18, 5, 1.2],
      ],
      220,
    )}" fill="#8e8fd6" ${ink(3)}/>` +
      `<path d="${wave(
        360,
        150,
        [
          [22, 3, 2.2],
          [8, 7, 0.5],
        ],
        220,
      )}" fill="#6f70bd" ${ink(3)}/>`,
  )
}

function city(): string {
  const buildings: string[] = []
  const widths = [40, 56, 34, 48, 60, 38, 44, 40]
  let x = 0
  widths.forEach((w, i) => {
    const h = 60 + ((i * 37) % 70)
    const top = 160 - h
    buildings.push(
      `<rect x="${x}" y="${top}" width="${w - 4}" height="${h + 10}" fill="#4a5a8c" ${ink(2.5)}/>`,
    )
    for (let wy = top + 10; wy < 150; wy += 16) {
      for (let wx = x + 7; wx < x + w - 12; wx += 12) {
        buildings.push(
          `<rect x="${wx}" y="${wy}" width="5" height="7" fill="#ffe8a3" opacity="${(wx + wy) % 3 ? 0.9 : 0.3}"/>`,
        )
      }
    }
    x += w
  })
  return svg(360, 170, buildings.join(''))
}

function road(): string {
  const stripes = Array.from(
    { length: 6 },
    (_, i) => `<rect x="${i * 60 + 10}" y="52" width="34" height="7" rx="3" fill="#ffd23f"/>`,
  ).join('')
  return svg(
    360,
    120,
    `<rect x="-4" y="0" width="368" height="22" fill="#5c6b8f" ${ink(3)}/>` +
      `<rect x="-4" y="18" width="368" height="106" fill="url(#r)" ${ink(3)}/>${stripes}` +
      `<rect x="-4" y="4" width="368" height="5" fill="#8d9cc2"/>`,
    vgradient('r', [
      [0, '#3b4466'],
      [1, '#262c45'],
    ]),
  )
}

function roundButton(arrow: 'up' | 'down', color: string, dark: string): string {
  const path =
    arrow === 'up'
      ? 'M40 18 L60 44 L48 44 L48 60 L32 60 L32 44 L20 44 Z'
      : 'M40 62 L60 36 L48 36 L48 20 L32 20 L32 36 L20 36 Z'
  return svg(
    80,
    84,
    `<circle cx="40" cy="44" r="36" fill="${dark}"/><circle cx="40" cy="40" r="36" fill="url(#b)" ${ink(3)}/>` +
      `<path d="${path}" fill="#fff" ${ink(3)}/><ellipse cx="30" cy="20" rx="12" ry="5" fill="#fff" opacity="0.4"/>`,
    rgradient('b', [
      [0, color],
      [1, dark],
    ]),
  )
}

function shade(): string {
  return svg(36, 72, `<rect width="36" height="72" fill="#0b1033"/>`)
}

const ART = {
  'robot-run1': robot('run1'),
  'robot-run2': robot('run2'),
  'robot-jump': robot('jump'),
  'robot-slide': robot('slide'),
  'robot-hurt': robot('hurt'),
  crate: crate(),
  barrier: barrier(),
  drone: drone(),
  bolt: bolt(),
  'sky-day': sky(false),
  'sky-night': sky(true),
  mountains: mountains(),
  city: city(),
  road: road(),
  'jump-button': roundButton('up', '#5ad15a', '#2f9e44'),
  'slide-button': roundButton('down', '#4dabf7', '#1c7ed6'),
  shade: shade(),
}

function cover(): string {
  return svg(
    340,
    220,
    coverStyle(
      '.far { animation: slide 8s linear infinite; } .mid { animation: slide 4s linear infinite; } .near { animation: slide 1.4s linear infinite; } ' +
        '.hero { animation: hop 1.4s ease-in-out infinite; } .crate { animation: pass 1.4s linear infinite; } ' +
        '.leg2 { animation: blink 0.24s steps(1) infinite; } ' +
        '@keyframes slide { to { transform: translateX(-340px); } } ' +
        '@keyframes hop { 0%, 30%, 75%, 100% { transform: translateY(0); } 52% { transform: translateY(-70px); } } ' +
        '@keyframes pass { from { transform: translateX(260px); } to { transform: translateX(-160px); } } ' +
        '@keyframes blink { 50% { opacity: 0; } }',
    ) +
      `<defs>${symbol(ART.mountains, 'm')}${symbol(ART.city, 'c')}${symbol(ART.road, 'r')}${symbol(ART.bolt, 'b')}</defs>` +
      embed(ART['sky-day'], 0, -340, 340, 680, 'sky') +
      `<g class="far">${use('m', 0, 70, 340, 208)}${use('m', 340, 70, 340, 208)}</g>` +
      `<g class="mid">${use('c', 0, 82, 340, 160)}${use('c', 340, 82, 340, 160)}</g>` +
      `<g class="near">${use('r', 0, 170, 340, 113)}${use('r', 340, 170, 340, 113)}${use('b', 200, 108, 26, 26)}${use('b', 236, 98, 26, 26)}${use('b', 272, 108, 26, 26)}${use('b', 540, 108, 26, 26)}</g>` +
      `<g class="crate">${embed(ART.crate, 0, 132, 40, 40, 'crate')}</g>` +
      `<g class="hero">${embed(ART['robot-run1'], 40, 104, 70, 70, 'r1')}<g class="leg2">${embed(ART['robot-run2'], 40, 104, 70, 70, 'r2')}</g></g>`,
  )
}

// Recipe

const scene = 'city'
const JUMP = { fr: 'faire sauter le robot', en: 'make the robot jump' }
const SLIDE = { fr: 'faire glisser le robot', en: 'make the robot slide' }
const OBSTACLE = { fr: 'lancer un obstacle', en: 'send an obstacle' }
const BOLTS = { fr: 'lancer des boulons', en: 'send bolts' }
const SCROLL = { fr: 'faire défiler le décor', en: 'scroll the scenery' }
const DAY_NIGHT = { fr: 'changer le jour et la nuit', en: 'switch day and night' }
const CRASH = { fr: 'le robot se cogne', en: 'the robot crashes' }
const SPEEDS = { fr: 'régler les vitesses', en: 'set the speeds' }

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
  title: { fr: 'Robot Fonceur', en: 'Robo Dash' },
  hint: {
    fr: 'Saute par-dessus les caisses,\nglisse sous les drones !',
    en: 'Jump over the crates,\nslide under the drones!',
  },
  overTitle: { fr: 'Boum !', en: 'Crash!' },
  textColor: '#1b2a4f',
  bestY: 300,
  buttonColor: ['#ff9f43', '#e8590c'] as [string, string],
  panelColor: ['#f1f5ff', '#4a5a8c'] as [string, string],
}

/** "if <layer> went one picture too far, step it back". */
const wrap = (id: string, key: string) =>
  when(`${id}`, cmp(prop('Sprite', key, 'x'), '<', num(0)), [
    call(`${id}-move`, 'Sprite', key, 'moveBy', num(360), num(0)),
  ])

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
        note(setVar('set-jump', 'jumpForce', num(820)), {
          fr: 'La force du saut : plus grand, plus haut.',
          en: 'How strong the jump is: bigger, higher.',
        }),
        setVar('set-gravity', 'gravity', num(2300)),
        note(setVar('set-speed', 'startSpeed', num(300)), {
          fr: 'La vitesse au départ, en points par seconde.',
          en: 'The speed at the start, in points per second.',
        }),
        note(setVar('set-max', 'maxSpeed', num(620)), {
          fr: 'La vitesse maximale.',
          en: 'The top speed.',
        }),
        note(setVar('set-faster', 'faster', num(6)), {
          fr: 'Combien elle monte à chaque seconde.',
          en: 'How much it goes up each second.',
        }),
      ]),
      CHANGE_ME,
    ),
    ...kitBlocks({
      scene,
      onTitle: [
        call('t-clones', 'GameScene', scene, 'deleteClones'),
        set('t-unpause', 'GameScene', scene, 'paused', bool(false)),
        call('t-obstacles', 'Timer', 'obstacles', 'stop'),
        call('t-bolts', 'Timer', 'bolts', 'stop'),
        setVar('t-speed', 'speed', num(120)),
        run('t-speeds', SPEEDS),
        call('t-robot', 'Sprite', 'robot', 'goTo', num(90), num(560)),
        call('t-run', 'Sprite', 'robot', 'animate', num(1), num(2), num(6)),
        set('t-buttons', 'Sprite', 'jumpButton', 'visible', bool(false)),
        set('t-buttons-2', 'Sprite', 'slideButton', 'visible', bool(false)),
      ],
      onStart: [
        call('s-clones', 'GameScene', scene, 'deleteClones'),
        set('s-unpause', 'GameScene', scene, 'paused', bool(false)),
        run('s-settings', FN.settings),
        setVar('s-distance', 'distance', num(0)),
        setVar('s-bolts', 'boltsTaken', num(0)),
        setVar('s-sliding', 'sliding', bool(false)),
        setVar('s-speed', 'speed', v('startSpeed')),
        run('s-speeds', SPEEDS),
        call('s-robot', 'Sprite', 'robot', 'goTo', num(90), num(560)),
        set('s-robot-h', 'Sprite', 'robot', 'height', num(80)),
        set('s-gravity', 'Sprite', 'robot', 'gravity', v('gravity')),
        call('s-run', 'Sprite', 'robot', 'animate', num(1), num(2), num(10)),
        set('s-buttons', 'Sprite', 'jumpButton', 'visible', bool(true)),
        set('s-buttons-2', 'Sprite', 'slideButton', 'visible', bool(true)),
        set('s-pace', 'Timer', 'obstacles', 'interval', num(1.6)),
        call('s-obstacles', 'Timer', 'obstacles', 'start'),
        call('s-bolts', 'Timer', 'bolts', 'start'),
      ],
      onEnd: [
        set('e-buttons', 'Sprite', 'jumpButton', 'visible', bool(false)),
        set('e-buttons-2', 'Sprite', 'slideButton', 'visible', bool(false)),
      ],
    }),
    note(
      fn('speeds', SPEEDS, [
        note(set('sp-far', 'Sprite', 'mountains', 'vx', minus(math(v('speed'), '×', num(0.1)))), {
          fr: 'Ce qui est loin défile lentement…',
          en: 'What is far scrolls slowly…',
        }),
        set('sp-mid', 'Sprite', 'buildings', 'vx', minus(math(v('speed'), '×', num(0.35)))),
        note(set('sp-near', 'Sprite', 'road', 'vx', minus(v('speed'))), {
          fr: '… ce qui est près, vite : c’est la parallaxe.',
          en: '… what is near, fast: that is parallax.',
        }),
      ]),
      { fr: 'Trois plans, trois vitesses.', en: 'Three layers, three speeds.' },
    ),
    note(
      on('frame', 'GameScene', scene, 'frame', [
        run('frame-scroll', SCROLL),
        when('frame-if', play(), [
          note(
            setVar(
              'frame-speed',
              'speed',
              choose(
                cmp(v('speed'), '<', v('maxSpeed')),
                math(v('speed'), '+', math(v('faster'), '×', ev('dt'))),
                v('maxSpeed'),
              ),
            ),
            { fr: 'De plus en plus vite.', en: 'Faster and faster.' },
          ),
          run('frame-speeds', SPEEDS),
          change('frame-distance', 'distance', math(math(v('speed'), '×', ev('dt')), '÷', num(40))),
          setVar(
            'frame-score',
            'score',
            math(round(v('distance')), '+', math(v('boltsTaken'), '×', num(10))),
          ),
          run('frame-show', FN.score),
          when(
            'frame-land',
            and(prop('Sprite', 'robot', 'onGround'), cmp(v('sliding'), '=', bool(false))),
            [
              note(call('frame-run', 'Sprite', 'robot', 'animate', num(1), num(2), num(10)), {
                fr: 'Sur le sol, il court.',
                en: 'On the ground, it runs.',
              }),
            ],
          ),
        ]),
      ]),
      {
        fr: 'À chaque image : le décor, la vitesse, la distance.',
        en: 'On every frame: the scenery, the speed, the distance.',
      },
    ),
    note(
      fn('scroll', SCROLL, [
        wrap('wrap-road', 'road'),
        wrap('wrap-buildings', 'buildings'),
        wrap('wrap-mountains', 'mountains'),
      ]),
      {
        fr: 'Chaque plan est une image répétée : arrivé au bout, il recule d’une image.',
        en: 'Each layer is a repeated picture: at the end, it steps back by one picture.',
      },
    ),
    note(
      fn('jump', JUMP, [
        when(
          'jump-if',
          and(
            play(),
            and(prop('Sprite', 'robot', 'onGround'), cmp(v('sliding'), '=', bool(false))),
          ),
          [
            set('jump-up', 'Sprite', 'robot', 'vy', minus(v('jumpForce'))),
            set('jump-costume', 'Sprite', 'robot', 'costume', num(3)),
            call('jump-sound', 'Sound', 'sndJump', 'play'),
          ],
        ),
      ]),
      {
        fr: 'Il ne saute que s’il est posé sur le sol.',
        en: 'It only jumps when it stands on the ground.',
      },
    ),
    note(
      fn('slide', SLIDE, [
        when(
          'slide-if',
          and(
            play(),
            and(prop('Sprite', 'robot', 'onGround'), cmp(v('sliding'), '=', bool(false))),
          ),
          [
            setVar('slide-on', 'sliding', bool(true)),
            call('slide-sound', 'Sound', 'sndSlide', 'play'),
            set('slide-costume', 'Sprite', 'robot', 'costume', num(4)),
            note(set('slide-low', 'Sprite', 'robot', 'height', num(40)), {
              fr: 'Plus petit : les drones passent au-dessus.',
              en: 'Smaller: the drones go over it.',
            }),
            call('slide-down', 'Sprite', 'robot', 'moveBy', num(0), num(20)),
            wait('slide-wait', 0.9),
            when('slide-still', play(), [
              set('slide-high', 'Sprite', 'robot', 'height', num(80)),
              call('slide-up', 'Sprite', 'robot', 'moveBy', num(0), num(-20)),
            ]),
            setVar('slide-off', 'sliding', bool(false)),
          ],
        ),
      ]),
      { fr: 'Une glissade dure presque une seconde.', en: 'A slide lasts almost a second.' },
    ),
    note(on('jump-tap', 'Sprite', 'jumpButton', 'tap', [run('jump-tap-run', JUMP)]), {
      fr: 'Les boutons, les glissements du doigt et le clavier.',
      en: 'The buttons, finger swipes and the keyboard.',
    }),
    on('slide-tap', 'Sprite', 'slideButton', 'tap', [run('slide-tap-run', SLIDE)]),
    on('swipe-up', 'GameScene', scene, 'swipe', [run('swipe-up-run', JUMP)], 'up'),
    on('swipe-down', 'GameScene', scene, 'swipe', [run('swipe-down-run', SLIDE)], 'down'),
    on('key-space', 'GameScene', scene, 'keyDown', [run('key-space-run', JUMP)], 'space'),
    on('key-up', 'GameScene', scene, 'keyDown', [run('key-up-run', JUMP)], 'up'),
    on('key-down', 'GameScene', scene, 'keyDown', [run('key-down-run', SLIDE)], 'down'),
    note(
      on('obstacle-tick', 'Timer', 'obstacles', 'tick', [
        when('obstacle-if', play(), [
          run('obstacle-run', OBSTACLE),
          note(
            set(
              'obstacle-pace',
              'Timer',
              'obstacles',
              'interval',
              math(math(random(260, 460), '÷', v('speed')), '+', num(0.45)),
            ),
            {
              fr: 'Le prochain arrive un peu au hasard, plus vite quand ça accélère.',
              en: 'The next one comes a bit at random, sooner when it speeds up.',
            },
          ),
        ]),
      ]),
      { fr: 'Le minuteur des obstacles.', en: 'The timer of the obstacles.' },
    ),
    note(
      fn('obstacle', OBSTACLE, [
        setVar('ob-kind', 'kind', random(1, 3)),
        set('ob-costume', 'Sprite', 'obstacle', 'costume', v('kind')),
        when(
          'ob-crate',
          cmp(v('kind'), '=', num(1)),
          [
            set('ob-crate-w', 'Sprite', 'obstacle', 'width', num(54)),
            set('ob-crate-h', 'Sprite', 'obstacle', 'height', num(54)),
            call('ob-crate-go', 'Sprite', 'obstacle', 'goTo', num(420), num(573)),
          ],
          [
            when(
              'ob-barrier',
              cmp(v('kind'), '=', num(2)),
              [
                set('ob-barrier-w', 'Sprite', 'obstacle', 'width', num(50)),
                set('ob-barrier-h', 'Sprite', 'obstacle', 'height', num(78)),
                call('ob-barrier-go', 'Sprite', 'obstacle', 'goTo', num(420), num(561)),
              ],
              [
                note(set('ob-drone-w', 'Sprite', 'obstacle', 'width', num(66)), {
                  fr: 'Un drone, juste à hauteur de tête : il faut glisser.',
                  en: 'A drone, right at head height: slide!',
                }),
                set('ob-drone-h', 'Sprite', 'obstacle', 'height', num(44)),
                call('ob-drone-go', 'Sprite', 'obstacle', 'goTo', num(430), num(520)),
              ],
            ),
          ],
        ),
        call('ob-clone', 'Sprite', 'obstacle', 'clone'),
      ]),
      {
        fr: 'Une caisse, une barrière ou un drone, au hasard.',
        en: 'A crate, a barrier or a drone, at random.',
      },
    ),
    on('obstacle-clone', 'Sprite', 'obstacle', 'clone', [
      set('oc-vx', 'Sprite', 'obstacle', 'vx', minus(v('speed'))),
    ]),
    note(
      on('bolts-tick', 'Timer', 'bolts', 'tick', [
        when('bolts-if', play(), [run('bolts-run', BOLTS)]),
      ]),
      { fr: 'De temps en temps, une rangée de boulons.', en: 'Now and then, a row of bolts.' },
    ),
    fn('bolts', BOLTS, [
      setVar('bo-y', 'boltY', choose(cmp(random(1, 2), '=', num(1)), num(540), num(430))),
      repeat('bo-loop', 4, [
        call(
          'bo-go',
          'Sprite',
          'bolt',
          'goTo',
          math(num(400), '+', math(v('boltCount'), '×', num(46))),
          v('boltY'),
        ),
        call('bo-clone', 'Sprite', 'bolt', 'clone'),
        change('bo-next', 'boltCount', 1),
      ]),
      setVar('bo-reset', 'boltCount', num(0)),
    ]),
    on('bolt-clone', 'Sprite', 'bolt', 'clone', [
      set('bc-vx', 'Sprite', 'bolt', 'vx', minus(v('speed'))),
    ]),
    note(
      on(
        'bolt-hit',
        'Sprite',
        'bolt',
        'hit',
        [
          call('bh-delete', 'Sprite', 'bolt', 'delete'),
          change('bh-count', 'boltsTaken', 1),
          call('bh-sound', 'Sound', 'sndBolt', 'play'),
        ],
        'robot',
      ),
      { fr: 'Un boulon vaut 10 points.', en: 'A bolt is worth 10 points.' },
    ),
    note(
      on(
        'crash-hit',
        'Sprite',
        'robot',
        'hit',
        [when('crash-if', play(), [run('crash-run', CRASH)])],
        'obstacle',
      ),
      { fr: 'Le robot touche un obstacle.', en: 'The robot hits an obstacle.' },
    ),
    note(
      fn('crash', CRASH, [
        setVar('crash-state', 'state', str(STATE.lost)),
        call('crash-sound', 'Sound', 'sndCrash', 'play'),
        call('crash-shake', 'GameScene', scene, 'shake', num(0.5)),
        set('crash-costume', 'Sprite', 'robot', 'costume', num(5)),
        call('crash-obstacles', 'Timer', 'obstacles', 'stop'),
        call('crash-bolts', 'Timer', 'bolts', 'stop'),
        set('crash-pause', 'GameScene', scene, 'paused', bool(true)),
        wait('crash-wait', 0.8),
        run('crash-end', FN.end),
      ]),
      { fr: 'Boum ! Tout s’arrête.', en: 'Crash! Everything stops.' },
    ),
    note(on('day-night', 'Timer', 'dayClock', 'tick', [run('day-night-run', DAY_NIGHT)]), {
      fr: 'Toutes les 20 secondes, le jour et la nuit alternent.',
      en: 'Every 20 seconds, day and night take turns.',
    }),
    fn('day-night', DAY_NIGHT, [
      setVar(
        'dn-night',
        'night',
        choose(cmp(v('night'), '=', bool(true)), bool(false), bool(true)),
      ),
      when(
        'dn-if',
        cmp(v('night'), '=', bool(true)),
        [
          set('dn-sky-night', 'Sprite', 'sky', 'costume', num(2)),
          set('dn-shade', 'Sprite', 'shade', 'opacity', num(35)),
        ],
        [
          set('dn-sky-day', 'Sprite', 'sky', 'costume', num(1)),
          set('dn-shade-day', 'Sprite', 'shade', 'opacity', num(0)),
        ],
      ),
    ]),
  ]
}

export const ROBO_DASH: GameSource = {
  id: 'robo-dash',
  order: 24,
  mode: 'junior',
  icon: '🤖',
  accent: 'coral',
  title: { fr: 'Robot Fonceur', en: 'Robo Dash' },
  description: {
    fr: 'Une course sans fin : saute, glisse, ramasse les boulons. Le jour, la nuit, toujours plus vite.',
    en: 'An endless run: jump, slide, grab the bolts. Day, night, faster and faster.',
  },
  theme: { primary: '#e8590c', font: 'rounded' },
  variables: [
    ...KIT_VARIABLES,
    { key: 'jumpForce', name: { fr: 'forceSaut', en: 'jumpForce' }, initial: 820 },
    { key: 'gravity', name: { fr: 'pesanteur', en: 'gravity' }, initial: 2300 },
    { key: 'startSpeed', name: { fr: 'vitesseDépart', en: 'startSpeed' }, initial: 300 },
    { key: 'maxSpeed', name: { fr: 'vitesseMax', en: 'maxSpeed' }, initial: 620 },
    { key: 'faster', name: { fr: 'accélération', en: 'speedUp' }, initial: 6 },
    { key: 'speed', name: { fr: 'vitesse', en: 'speed' }, initial: 0 },
    { key: 'distance', name: { fr: 'distance', en: 'distance' }, initial: 0 },
    { key: 'boltsTaken', name: { fr: 'boulons', en: 'bolts' }, initial: 0 },
    { key: 'boltY', name: { fr: 'hauteurBoulons', en: 'boltHeight' }, initial: 540 },
    { key: 'boltCount', name: { fr: 'numéroBoulon', en: 'boltNumber' }, initial: 0 },
    { key: 'kind', name: { fr: 'sorte', en: 'kind' }, initial: 1 },
    { key: 'sliding', name: { fr: 'glisse', en: 'sliding' }, initial: false },
    { key: 'night', name: { fr: 'nuit', en: 'night' }, initial: false },
  ],
  screen: { key: 'game', name: { fr: 'Jeu', en: 'Game' }, props: { padding: 0 } },
  components: [
    {
      key: scene,
      type: 'GameScene',
      name: { fr: 'Ville', en: 'City' },
      props: { background: '#57b9ff', edges: 'pass', sceneHeight: 720 },
      children: [
        sprite(
          'sky',
          { fr: 'Ciel', en: 'Sky' },
          {
            costumes: ['asset:sky-day', 'asset:sky-night'],
            x: 180,
            y: 360,
            width: 360,
            height: 720,
          },
        ),
        sprite(
          'mountains',
          { fr: 'Montagnes', en: 'Mountains' },
          {
            costumes: ['asset:mountains'],
            tiled: true,
            x: 360,
            y: 480,
            width: 1080,
            height: 220,
          },
        ),
        sprite(
          'buildings',
          { fr: 'Immeubles', en: 'Buildings' },
          {
            costumes: ['asset:city'],
            tiled: true,
            x: 360,
            y: 520,
            width: 1080,
            height: 170,
          },
        ),
        sprite(
          'road',
          { fr: 'Route', en: 'Road' },
          {
            costumes: ['asset:road'],
            tiled: true,
            x: 360,
            y: 660,
            width: 1080,
            height: 120,
          },
        ),
        sprite(
          'floor',
          { fr: 'Sol', en: 'Floor' },
          {
            costumes: ['asset:road'],
            x: 180,
            y: 640,
            width: 360,
            height: 80,
            opacity: 0,
            collision: 'box',
            solid: true,
            pushable: false,
          },
        ),
        sprite(
          'shade',
          { fr: 'Nuit', en: 'Night' },
          {
            costumes: ['asset:shade'],
            x: 180,
            y: 360,
            width: 360,
            height: 720,
            opacity: 0,
          },
        ),
        sprite(
          'bolt',
          { fr: 'Boulon', en: 'Bolt' },
          {
            costumes: ['asset:bolt'],
            x: -100,
            y: 540,
            width: 34,
            height: 34,
            collision: 'circle',
          },
        ),
        sprite(
          'obstacle',
          { fr: 'Obstacle', en: 'Obstacle' },
          {
            costumes: ['asset:crate', 'asset:barrier', 'asset:drone'],
            x: -200,
            y: 573,
            width: 54,
            height: 54,
            collision: 'box',
          },
        ),
        sprite(
          'robot',
          { fr: 'Robot', en: 'Robot' },
          {
            costumes: [
              'asset:robot-run1',
              'asset:robot-run2',
              'asset:robot-jump',
              'asset:robot-slide',
              'asset:robot-hurt',
            ],
            x: 90,
            y: 560,
            width: 70,
            height: 80,
            collision: 'box',
            solid: true,
            bounce: 0,
          },
        ),
        sprite(
          'jumpButton',
          { fr: 'BoutonSaut', en: 'JumpButton' },
          {
            costumes: ['asset:jump-button'],
            x: 300,
            y: 670,
            width: 76,
            height: 80,
            visible: false,
          },
        ),
        sprite(
          'slideButton',
          { fr: 'BoutonGlisse', en: 'SlideButton' },
          {
            costumes: ['asset:slide-button'],
            x: 60,
            y: 670,
            width: 76,
            height: 80,
            visible: false,
          },
        ),
        ...kitComponents(KIT),
      ],
    },
    {
      key: 'obstacles',
      type: 'Timer',
      name: { fr: 'Obstacles', en: 'Obstacles' },
      props: { interval: 1.6, repeat: true, autostart: false },
    },
    {
      key: 'bolts',
      type: 'Timer',
      name: { fr: 'Boulons', en: 'Bolts' },
      props: { interval: 2.3, repeat: true, autostart: false },
    },
    {
      key: 'dayClock',
      type: 'Timer',
      name: { fr: 'JourNuit', en: 'DayNight' },
      props: { interval: 20, repeat: true, autostart: true },
    },
    {
      key: 'sndJump',
      type: 'Sound',
      name: { fr: 'SonSaut', en: 'JumpSound' },
      props: { src: 'asset:jump' },
    },
    {
      key: 'sndSlide',
      type: 'Sound',
      name: { fr: 'SonGlisse', en: 'SlideSound' },
      props: { src: 'asset:slide' },
    },
    {
      key: 'sndBolt',
      type: 'Sound',
      name: { fr: 'SonBoulon', en: 'BoltSound' },
      props: { src: 'asset:bolt-sound' },
    },
    {
      key: 'sndCrash',
      type: 'Sound',
      name: { fr: 'SonBoum', en: 'CrashSound' },
      props: { src: 'asset:crash' },
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
            'robot-run1': { fr: 'robot qui court 1', en: 'running robot 1' },
            'robot-run2': { fr: 'robot qui court 2', en: 'running robot 2' },
            'robot-jump': { fr: 'robot qui saute', en: 'jumping robot' },
            'robot-slide': { fr: 'robot qui glisse', en: 'sliding robot' },
            'robot-hurt': { fr: 'robot cabossé', en: 'dented robot' },
            crate: { fr: 'caisse', en: 'crate' },
            barrier: { fr: 'barrière', en: 'barrier' },
            drone: { fr: 'drone', en: 'drone' },
            bolt: { fr: 'boulon', en: 'bolt' },
            'sky-day': { fr: 'ciel de jour', en: 'day sky' },
            'sky-night': { fr: 'ciel de nuit', en: 'night sky' },
            mountains: { fr: 'montagnes', en: 'mountains' },
            city: { fr: 'immeubles', en: 'buildings' },
            road: { fr: 'route', en: 'road' },
            'jump-button': { fr: 'bouton sauter', en: 'jump button' },
            'slide-button': { fr: 'bouton glisser', en: 'slide button' },
            shade: { fr: 'ombre de la nuit', en: 'night shade' },
          }[key] ?? { fr: key, en: key },
          svg: file,
        },
      ]),
    ),
    ...kitArt(KIT),
  },
  sounds: {
    jump: { name: { fr: 'saut', en: 'jump' }, wav: COMMON_SOUNDS.jump() },
    slide: {
      name: { fr: 'glissade', en: 'slide' },
      wav: wav(
        [{ wave: 'noise', from: 5000, to: 800, seconds: 0.3, volume: 0.4, release: 0.25 }],
        9,
      ),
    },
    'bolt-sound': { name: { fr: 'boulon', en: 'bolt' }, wav: COMMON_SOUNDS.coin() },
    crash: { name: { fr: 'boum', en: 'crash' }, wav: COMMON_SOUNDS.explosion() },
    ...kitSounds(),
  },
  cover: cover(),
}
