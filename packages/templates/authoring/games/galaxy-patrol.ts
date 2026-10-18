import {
  and,
  type Block,
  between,
  bool,
  call,
  change,
  cmp,
  count,
  fn,
  forever,
  join,
  math,
  modulo,
  not,
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
import { COMMON_SOUNDS, melody, wav } from './sfx.ts'
import {
  coverStyle,
  embed,
  heart,
  INK,
  ink,
  rgradient,
  starPath,
  svg,
  symbol,
  use,
  vgradient,
} from './svg.ts'
import type { GameSource } from './types.ts'

/**
 * Patrouille Galactique (Galaxy Patrol): a vertical space shooter. The ship fires on its own
 * (clones of a laser); waves of enemies fly in, sway in formation, shoot back and dive;
 * power-ups give a triple shot, a shield or a life; every fourth wave, a mothership with a
 * health bar. The stars scroll down.
 */

// Pictures

function ship(flame: boolean): string {
  return svg(
    64,
    72,
    `<path d="M26 58 q6 ${flame ? 16 : 10} 12 0 Z" fill="#ffd23f"/><path d="M29 58 q3 ${flame ? 10 : 6} 6 0 Z" fill="#fff"/>` +
      `<path d="M32 4 C40 14 44 30 44 46 L58 56 L58 62 L40 58 L24 58 L6 62 L6 56 L20 46 C20 30 24 14 32 4 Z" fill="url(#hull)" ${ink(3)}/>` +
      `<path d="M6 56 L20 46 L20 58 Z M58 56 L44 46 L44 58 Z" fill="#ff5d73" ${ink(2.5)}/>` +
      `<ellipse cx="32" cy="28" rx="6" ry="10" fill="url(#glass)" ${ink(2.5)}/>` +
      `<path d="M29 22 q2 -4 4 -3" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    vgradient('hull', [
      [0, '#ffffff'],
      [1, '#a9b8e8'],
    ]) +
      rgradient('glass', [
        [0, '#c9f6ff'],
        [1, '#2b9cff'],
      ]),
  )
}

function laser(): string {
  return svg(
    12,
    32,
    `<rect x="2" y="2" width="8" height="28" rx="4" fill="#5ef1ff" ${ink(2)}/><rect x="4.5" y="5" width="3" height="20" rx="1.5" fill="#fff"/>`,
  )
}

function bullet(): string {
  return svg(
    24,
    24,
    `<circle cx="12" cy="12" r="10" fill="url(#b)" ${ink(2.5)}/><circle cx="9" cy="9" r="3" fill="#fff" opacity="0.8"/>`,
    rgradient('b', [
      [0, '#ffd1ec'],
      [1, '#ff3b8d'],
    ]),
  )
}

function saucer(): string {
  return svg(
    64,
    48,
    `<ellipse cx="32" cy="20" rx="14" ry="12" fill="url(#dome)" ${ink(2.5)}/>` +
      `<ellipse cx="32" cy="30" rx="30" ry="11" fill="url(#body)" ${ink(3)}/>` +
      `<circle cx="14" cy="31" r="3" fill="#ffe066"/><circle cx="32" cy="34" r="3" fill="#ffe066"/><circle cx="50" cy="31" r="3" fill="#ffe066"/>` +
      `<circle cx="28" cy="18" r="3" fill="${INK}"/><circle cx="36" cy="18" r="3" fill="${INK}"/>`,
    rgradient('dome', [
      [0, '#e6fff0'],
      [1, '#5ad15a'],
    ]) +
      vgradient('body', [
        [0, '#c3b5ff'],
        [1, '#6d4fe0'],
      ]),
  )
}

function wasp(): string {
  return svg(
    64,
    56,
    `<path d="M8 10 L28 26 M56 10 L36 26" ${ink(3)}/>` +
      `<path d="M4 18 Q14 2 26 22 Z M60 18 Q50 2 38 22 Z" fill="#ffe8a3" opacity="0.9" ${ink(2.5)}/>` +
      `<path d="M32 50 L18 26 Q32 10 46 26 Z" fill="url(#w)" ${ink(3)}/>` +
      `<path d="M23 31 L41 31 M26 38 L38 38" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="27" cy="22" r="3.5" fill="#ff3b5c" ${ink(1.5)}/><circle cx="37" cy="22" r="3.5" fill="#ff3b5c" ${ink(1.5)}/>`,
    vgradient('w', [
      [0, '#ffd23f'],
      [1, '#f08c00'],
    ]),
  )
}

function crab(): string {
  return svg(
    72,
    56,
    `<path d="M10 20 q-8 -10 2 -16 q4 8 10 10 M62 20 q8 -10 -2 -16 q-4 8 -10 10" fill="#ff8f6b" ${ink(2.5)}/>` +
      `<path d="M14 42 l-8 10 M58 42 l8 10 M24 46 l-4 8 M48 46 l4 8" ${ink(3)}/>` +
      `<ellipse cx="36" cy="32" rx="26" ry="18" fill="url(#c)" ${ink(3)}/>` +
      `<circle cx="28" cy="28" r="6" fill="#fff" ${ink(2)}/><circle cx="44" cy="28" r="6" fill="#fff" ${ink(2)}/>` +
      `<circle cx="29" cy="29" r="3" fill="${INK}"/><circle cx="43" cy="29" r="3" fill="${INK}"/>` +
      `<path d="M28 40 q8 5 16 0" fill="none" ${ink(2.5)}/>`,
    rgradient('c', [
      [0, '#ffb39b'],
      [1, '#e8513a'],
    ]),
  )
}

function boss(hurt: boolean): string {
  const lights = [30, 60, 90, 120, 150]
    .map((x) => `<circle cx="${x}" cy="78" r="6" fill="${hurt ? '#fff' : '#ffe066'}" ${ink(2)}/>`)
    .join('')
  return svg(
    180,
    120,
    `<path d="M10 70 Q90 20 170 70 Q150 104 90 108 Q30 104 10 70 Z" fill="url(#hull)" ${ink(4)}/>` +
      `<ellipse cx="90" cy="48" rx="40" ry="30" fill="url(#dome)" ${ink(3.5)}/>` +
      `<circle cx="76" cy="44" r="9" fill="#fff" ${ink(2.5)}/><circle cx="104" cy="44" r="9" fill="#fff" ${ink(2.5)}/>` +
      `<circle cx="78" cy="46" r="4.5" fill="${INK}"/><circle cx="102" cy="46" r="4.5" fill="${INK}"/>` +
      `<path d="M68 30 l14 6 M112 30 l-14 6" ${ink(3.5)}/>` +
      lights +
      `<path d="M40 100 l-10 16 M140 100 l10 16 M90 108 v10" ${ink(4)}/>`,
    vgradient(
      'hull',
      hurt
        ? [
            [0, '#ffffff'],
            [1, '#ffc2dc'],
          ]
        : [
            [0, '#a78bfa'],
            [1, '#4c2fc4'],
          ],
    ) +
      rgradient('dome', [
        [0, hurt ? '#ffffff' : '#ffd1ec'],
        [1, hurt ? '#ffc2dc' : '#ff3b8d'],
      ]),
  )
}

function boom(step: number): string {
  const r = [14, 24, 30][step] ?? 20
  const points = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6
    const rr = i % 2 ? r * 0.55 : r
    return `${(32 + Math.cos(a) * rr).toFixed(1)},${(32 + Math.sin(a) * rr).toFixed(1)}`
  }).join(' ')
  return svg(
    64,
    64,
    `<polygon points="${points}" fill="${['#fff3a6', '#ffb43c', '#ff6b3c'][step]}" ${ink(2.5)} opacity="${[1, 0.95, 0.75][step]}"/>` +
      `<circle cx="32" cy="32" r="${r * 0.35}" fill="#fff" opacity="${[1, 0.8, 0.4][step]}"/>`,
  )
}

function powerUp(kind: 'triple' | 'shield' | 'life'): string {
  const icon = {
    triple: `<path d="M22 34 L22 18 M32 34 L32 14 M42 34 L42 18" stroke="#5ef1ff" stroke-width="5" stroke-linecap="round"/><path d="M22 34 L22 18 M32 34 L32 14 M42 34 L42 18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
    shield: `<path d="M32 12 L46 18 Q46 38 32 48 Q18 38 18 18 Z" fill="#5ef1ff" ${ink(2.5)}/>`,
    life: `<path d="M32 46 C20 38 15 31 15 24 C15 18 19 15 24 15 C27 15 30 17 32 20 C34 17 37 15 40 15 C45 15 49 18 49 24 C49 31 44 38 32 46 Z" fill="#ff5d73" ${ink(2.5)}/>`,
  }[kind]
  return svg(
    64,
    64,
    `<circle cx="32" cy="32" r="28" fill="url(#g)" ${ink(3)}/>${icon}<ellipse cx="22" cy="16" rx="8" ry="4" fill="#fff" opacity="0.5"/>`,
    rgradient('g', [
      [0, '#ffffff'],
      [1, kind === 'triple' ? '#5b4bff' : kind === 'shield' ? '#1c7ed6' : '#c2255c'],
    ]),
  )
}

function bubble(): string {
  return svg(
    96,
    96,
    `<circle cx="48" cy="48" r="44" fill="url(#s)" stroke="#5ef1ff" stroke-width="4"/>` +
      `<path d="M22 34 q10 -16 28 -18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>`,
    rgradient('s', [
      [0, 'rgba(94,241,255,0.05)'],
      [0.8, 'rgba(94,241,255,0.25)'],
      [1, 'rgba(94,241,255,0.55)'],
    ]),
  )
}

function stars(): string {
  // Scattered by a small seeded generator: the same sky each time, without lines of stars.
  let seed = 7
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const dots: string[] = []
  for (let i = 0; i < 110; i++) {
    const x = Math.round(next() * 360)
    const y = Math.round(next() * 720)
    const size = next()
    dots.push(
      size > 0.9
        ? `<path d="${starPath(x, y, 4, 1.6, 4)}" fill="#fff"/>`
        : `<circle cx="${x}" cy="${y}" r="${size > 0.6 ? 1.6 : 1}" fill="#fff" opacity="${(0.4 + size * 0.6).toFixed(2)}"/>`,
    )
  }
  return svg(360, 720, dots.join(''))
}

function planet(): string {
  return svg(
    140,
    140,
    `<circle cx="70" cy="70" r="50" fill="url(#p)" ${ink(3)}/>` +
      `<ellipse cx="70" cy="74" rx="68" ry="14" fill="none" stroke="#ffb3e6" stroke-width="6" transform="rotate(-18 70 74)"/>` +
      `<circle cx="52" cy="56" r="8" fill="#fff" opacity="0.25"/><circle cx="84" cy="88" r="6" fill="#000" opacity="0.15"/>`,
    rgradient('p', [
      [0, '#ffc2f0'],
      [1, '#8a3ffc'],
    ]),
  )
}

function barFrame(): string {
  return svg(
    220,
    26,
    `<rect x="2" y="2" width="216" height="22" rx="11" fill="#2b1b3f" stroke="#fff" stroke-width="3"/>`,
  )
}

function barFill(): string {
  return svg(
    40,
    16,
    `<rect width="40" height="16" fill="url(#f)"/><rect y="2" width="40" height="4" fill="#fff" opacity="0.4"/>`,
    vgradient('f', [
      [0, '#ff8ad8'],
      [1, '#e8344f'],
    ]),
  )
}

const ART = {
  'ship-1': ship(false),
  'ship-2': ship(true),
  laser: laser(),
  bullet: bullet(),
  saucer: saucer(),
  wasp: wasp(),
  crab: crab(),
  boss: boss(false),
  'boss-hurt': boss(true),
  'boom-1': boom(0),
  'boom-2': boom(1),
  'boom-3': boom(2),
  triple: powerUp('triple'),
  shield: powerUp('shield'),
  life: powerUp('life'),
  bubble: bubble(),
  stars: stars(),
  planet: planet(),
  'bar-frame': barFrame(),
  'bar-fill': barFill(),
  heart: heart(40),
}

function cover(): string {
  return svg(
    340,
    220,
    coverStyle(
      '.stars { animation: fall 3s linear infinite; } .shot { animation: up 0.5s linear infinite; } ' +
        '.ship { animation: sway 2s ease-in-out infinite alternate; } .foe { animation: sway2 1.4s ease-in-out infinite alternate; } ' +
        '@keyframes fall { to { transform: translateY(220px); } } ' +
        '@keyframes up { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-150px); opacity: 0.2; } } ' +
        '@keyframes sway { from { transform: translateX(-40px); } to { transform: translateX(40px); } } ' +
        '@keyframes sway2 { from { transform: translateX(-16px); } to { transform: translateX(16px); } }',
    ) +
      `<rect width="340" height="220" fill="url(#space)"/>` +
      `<defs>${vgradient('space', [
        [0, '#0b0d2e'],
        [1, '#2a1a5e'],
      ])}${symbol(ART.stars, 'st')}${symbol(ART.saucer, 'sa')}${symbol(ART.wasp, 'wa')}${symbol(ART.laser, 'la')}</defs>` +
      `<g class="stars">${use('st', 0, -220, 340, 680)}</g>` +
      embed(ART.planet, 250, 20, 70, 70, 'planet') +
      `<g class="foe">${use('sa', 60, 30, 46, 34)}${use('wa', 120, 22, 46, 40)}${use('sa', 180, 30, 46, 34)}${use('wa', 240, 22, 46, 40)}</g>` +
      `<g class="ship"><g class="shot">${use('la', 165, 120, 9, 24)}</g>${embed(ART['ship-2'], 145, 146, 50, 56, 'ship')}</g>`,
  )
}

// Recipe

const scene = 'space'
const FIRE = { fr: 'tirer', en: 'fire' }
const WAVE = { fr: 'lancer une vague', en: 'launch a wave' }
const BOSS = { fr: 'faire venir le vaisseau mère', en: 'bring in the mothership' }
const BAR = { fr: 'afficher la vie du boss', en: 'show the boss’s health' }
const HURT = { fr: 'le vaisseau est touché', en: 'the ship is hit' }
const BOOM = { fr: 'faire une explosion', en: 'make an explosion' }
const BONUS = { fr: 'lâcher un bonus', en: 'drop a power-up' }
const LIVES = { fr: 'afficher les vies', en: 'show the lives' }
const NEXT = { fr: 'vague suivante', en: 'next wave' }

const play = () => cmp(v('state'), '=', str(STATE.play))
const self = (key: string, name: string) => prop('Sprite', key, name)

const sprite = (key: string, name: { fr: string; en: string }, props: Record<string, unknown>) => ({
  key,
  type: 'Sprite',
  name,
  props: { collision: 'none', ...props },
})

const KIT = {
  scene,
  title: { fr: 'Patrouille\nGalactique', en: 'Galaxy\nPatrol' },
  hint: {
    fr: 'Le vaisseau tire tout seul.\nDéplace-le avec le joystick\nou les flèches. Évite les tirs !',
    en: 'The ship fires on its own.\nMove it with the joystick\nor the arrows. Dodge the shots!',
  },
  overTitle: { fr: 'Mission terminée', en: 'Mission over' },
  textColor: '#ffffff',
  glow: false,
  titleY: 140,
  hintGap: 110,
  titleSize: 44,
  buttonColor: ['#ff5d9e', '#c2255c'] as [string, string],
  panelColor: ['#f3f0ff', '#8a3ffc'] as [string, string],
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
        note(setVar('set-lives', 'lives', num(3)), {
          fr: 'Le nombre de vies.',
          en: 'How many lives.',
        }),
        note(setVar('set-speed', 'shipSpeed', num(330)), {
          fr: 'La vitesse du vaisseau.',
          en: 'How fast the ship goes.',
        }),
        note(setVar('set-fire', 'fireRate', num(0.22)), {
          fr: 'Le temps entre deux tirs (en secondes).',
          en: 'The time between two shots (in seconds).',
        }),
        note(setVar('set-boss', 'bossEvery', num(4)), {
          fr: 'Un vaisseau mère toutes les … vagues.',
          en: 'A mothership every … waves.',
        }),
      ]),
      CHANGE_ME,
    ),
    ...kitBlocks({
      scene,
      onTitle: [
        call('t-clones', 'GameScene', scene, 'deleteClones'),
        set('t-unpause', 'GameScene', scene, 'paused', bool(false)),
        call('t-guns', 'Timer', 'guns', 'stop'),
        call('t-ship', 'Sprite', 'ship', 'goTo', num(180), num(560)),
        set('t-boss', 'Sprite', 'boss', 'visible', bool(false)),
        set('t-bar', 'Sprite', 'barFrame', 'visible', bool(false)),
        set('t-bar-fill', 'Sprite', 'barFill', 'visible', bool(false)),
        set('t-hud-lives', 'SceneText', 'livesText', 'visible', bool(false)),
        set('t-hud-heart', 'Sprite', 'heart', 'visible', bool(false)),
        set('t-hud-wave', 'SceneText', 'waveText', 'visible', bool(false)),
        set('t-shield', 'Sprite', 'bubble', 'visible', bool(false)),
        set('t-stick', 'Joystick', 'stick', 'visible', bool(false)),
      ],
      onStart: [
        call('s-clones', 'GameScene', scene, 'deleteClones'),
        set('s-unpause', 'GameScene', scene, 'paused', bool(false)),
        run('s-settings', FN.settings),
        setVar('s-wave', 'wave', num(0)),
        setVar('s-left', 'enemiesLeft', num(0)),
        setVar('s-triple', 'triple', bool(false)),
        setVar('s-shield', 'shielded', bool(false)),
        setVar('s-safe', 'safe', bool(false)),
        set('s-bubble', 'Sprite', 'bubble', 'visible', bool(false)),
        set('s-boss', 'Sprite', 'boss', 'visible', bool(false)),
        setVar('s-boss-on', 'bossOn', bool(false)),
        call('s-ship', 'Sprite', 'ship', 'goTo', num(180), num(560)),
        set('s-ship-show', 'Sprite', 'ship', 'visible', bool(true)),
        set('s-hud-lives', 'SceneText', 'livesText', 'visible', bool(true)),
        set('s-hud-heart', 'Sprite', 'heart', 'visible', bool(true)),
        set('s-hud-wave', 'SceneText', 'waveText', 'visible', bool(true)),
        set('s-stick', 'Joystick', 'stick', 'visible', bool(true)),
        run('s-lives', LIVES),
        set('s-guns-pace', 'Timer', 'guns', 'interval', v('fireRate')),
        call('s-guns', 'Timer', 'guns', 'start'),
        run('s-next', NEXT),
      ],
      onEnd: [
        call('e-guns', 'Timer', 'guns', 'stop'),
        set('e-stick', 'Joystick', 'stick', 'visible', bool(false)),
      ],
    }),
    note(
      on('frame', 'GameScene', scene, 'frame', [
        note(
          when('frame-stars', cmp(self('starsA', 'y'), '>', num(1080)), [
            call('frame-stars-up', 'Sprite', 'starsA', 'moveBy', num(0), num(-1440)),
          ]),
          {
            fr: 'Deux champs d’étoiles descendent l’un derrière l’autre.',
            en: 'Two star fields go down, one behind the other.',
          },
        ),
        when('frame-stars-b', cmp(self('starsB', 'y'), '>', num(1080)), [
          call('frame-stars-b-up', 'Sprite', 'starsB', 'moveBy', num(0), num(-1440)),
        ]),
        when('frame-planet', cmp(self('planet', 'y'), '>', num(820)), [
          call('frame-planet-up', 'Sprite', 'planet', 'goTo', random(40, 320), num(-120)),
        ]),
        when('frame-play', play(), [
          note(
            set(
              'frame-vx',
              'Sprite',
              'ship',
              'vx',
              math(prop('Joystick', 'stick', 'dx'), '×', v('shipSpeed')),
            ),
            {
              fr: 'Le joystick (ou les flèches) pilote le vaisseau.',
              en: 'The joystick (or the arrows) steers the ship.',
            },
          ),
          set(
            'frame-vy',
            'Sprite',
            'ship',
            'vy',
            math(prop('Joystick', 'stick', 'dy'), '×', v('shipSpeed')),
          ),
          when('frame-low', cmp(self('ship', 'y'), '<', num(300)), [
            set('frame-low-y', 'Sprite', 'ship', 'y', num(300)),
          ]),
          when('frame-high', cmp(self('ship', 'y'), '>', num(560)), [
            set('frame-high-y', 'Sprite', 'ship', 'y', num(560)),
          ]),
          call('frame-bubble', 'Sprite', 'bubble', 'goTo', self('ship', 'x'), self('ship', 'y')),
        ]),
      ]),
      {
        fr: 'À chaque image : les étoiles et le vaisseau.',
        en: 'On every frame: the stars and the ship.',
      },
    ),
    note(
      on('guns-tick', 'Timer', 'guns', 'tick', [when('guns-if', play(), [run('guns-fire', FIRE)])]),
      {
        fr: 'Le minuteur fait tirer le vaisseau, tout seul.',
        en: 'The timer makes the ship fire, on its own.',
      },
    ),
    note(
      fn('fire', FIRE, [
        call('fire-sound', 'Sound', 'sndLaser', 'play'),
        call(
          'fire-go',
          'Sprite',
          'laser',
          'goTo',
          self('ship', 'x'),
          math(self('ship', 'y'), '-', num(34)),
        ),
        set('fire-vx', 'Sprite', 'laser', 'vx', num(0)),
        set('fire-turn', 'Sprite', 'laser', 'rotation', num(0)),
        call('fire-clone', 'Sprite', 'laser', 'clone'),
        when('fire-triple', cmp(v('triple'), '=', bool(true)), [
          note(set('fire-left', 'Sprite', 'laser', 'vx', num(-160)), {
            fr: 'Tir triple : deux tirs de plus, en biais.',
            en: 'Triple shot: two more shots, at an angle.',
          }),
          set('fire-left-turn', 'Sprite', 'laser', 'rotation', num(-13)),
          call('fire-left-clone', 'Sprite', 'laser', 'clone'),
          set('fire-right', 'Sprite', 'laser', 'vx', num(160)),
          set('fire-right-turn', 'Sprite', 'laser', 'rotation', num(13)),
          call('fire-right-clone', 'Sprite', 'laser', 'clone'),
        ]),
      ]),
      { fr: 'Chaque tir est un clone du laser.', en: 'Each shot is a clone of the laser.' },
    ),
    on('laser-clone', 'Sprite', 'laser', 'clone', [
      set('lc-show', 'Sprite', 'laser', 'visible', bool(true)),
      set('lc-vy', 'Sprite', 'laser', 'vy', num(-720)),
    ]),
    note(
      on(
        'laser-hit',
        'Sprite',
        'laser',
        'hit',
        [
          when('lh-clone', self('laser', 'isClone'), [
            call('lh-delete', 'Sprite', 'laser', 'delete'),
          ]),
        ],
        'enemy',
      ),
      { fr: 'Un tir qui touche un ennemi disparaît.', en: 'A shot that hits an enemy disappears.' },
    ),
    on(
      'laser-hit-boss',
      'Sprite',
      'laser',
      'hit',
      [
        when('lhb-clone', self('laser', 'isClone'), [
          call('lhb-delete', 'Sprite', 'laser', 'delete'),
        ]),
      ],
      'boss',
    ),
    note(
      fn('next', NEXT, [
        change('next-wave', 'wave', 1),
        set(
          'next-text',
          'SceneText',
          'waveText',
          'text',
          join(str({ fr: 'Vague ', en: 'Wave ' }), v('wave')),
        ),
        set(
          'next-banner',
          'SceneText',
          'bannerText',
          'text',
          join(str({ fr: 'Vague ', en: 'Wave ' }), v('wave')),
        ),
        set('next-banner-show', 'SceneText', 'bannerText', 'visible', bool(true)),
        wait('next-wait', 1.4),
        set('next-banner-hide', 'SceneText', 'bannerText', 'visible', bool(false)),
        when('next-if', play(), [
          when(
            'next-boss',
            cmp(modulo(v('wave'), v('bossEvery')), '=', num(0)),
            [run('next-boss-run', BOSS)],
            [run('next-wave-run', WAVE)],
          ),
        ]),
      ]),
      {
        fr: 'Une nouvelle vague, ou le vaisseau mère toutes les quatre vagues.',
        en: 'A new wave, or the mothership every four waves.',
      },
    ),
    note(
      fn('wave', WAVE, [
        setVar('w-rows', 'rows', between(math(num(1), '+', math(v('wave'), '÷', num(2))), 1, 4)),
        count('w-row', 'row', 1, v('rows'), 1, [
          count('w-col', 'column', 1, 5, 1, [
            note(
              set(
                'w-kind',
                'Sprite',
                'enemy',
                'costume',
                between(math(v('row'), '+', random(-1, math(v('wave'), '÷', num(3)))), 1, 3),
              ),
              {
                fr: 'Plus on avance, plus les ennemis sont coriaces.',
                en: 'The further you go, the tougher the enemies.',
              },
            ),
            note(set('w-hp', 'Sprite', 'enemy', 'value', prop('Sprite', 'enemy', 'costume')), {
              fr: 'La valeur d’un clone, ce sont ses points de vie.',
              en: 'A clone’s value is its health points.',
            }),
            call(
              'w-place',
              'Sprite',
              'enemy',
              'goTo',
              math(num(-12), '+', math(v('column'), '×', num(64))),
              math(num(40), '+', math(v('row'), '×', num(62))),
            ),
            call('w-clone', 'Sprite', 'enemy', 'clone'),
            change('w-count', 'enemiesLeft', 1),
          ]),
        ]),
      ]),
      { fr: 'Des rangées d’ennemis, en formation.', en: 'Rows of enemies, in formation.' },
    ),
    note(
      on('enemy-clone', 'Sprite', 'enemy', 'clone', [
        set('ec-show', 'Sprite', 'enemy', 'visible', bool(true)),
        note(call('ec-high', 'Sprite', 'enemy', 'moveBy', num(0), num(-400)), {
          fr: 'Il part de plus haut, hors de l’écran…',
          en: 'It starts higher, off the screen…',
        }),
        call(
          'ec-enter',
          'Sprite',
          'enemy',
          'glideTo',
          self('enemy', 'x'),
          math(self('enemy', 'y'), '+', num(400)),
          num(1.2),
        ),
        forever('ec-loop', [
          note(
            call(
              'ec-right',
              'Sprite',
              'enemy',
              'glideTo',
              math(self('enemy', 'x'), '+', num(36)),
              self('enemy', 'y'),
              math(num(1.4), '-', math(v('wave'), '×', num(0.04))),
            ),
            {
              fr: '… puis se balance de droite à gauche.',
              en: '… then sways right and left.',
            },
          ),
          when(
            'ec-shoot',
            cmp(random(1, 100), '≤', math(num(14), '+', math(v('wave'), '×', num(4)))),
            [
              call(
                'ec-bullet',
                'Sprite',
                'bullet',
                'goTo',
                self('enemy', 'x'),
                math(self('enemy', 'y'), '+', num(20)),
              ),
              call('ec-bullet-clone', 'Sprite', 'bullet', 'clone'),
            ],
          ),
          call(
            'ec-left',
            'Sprite',
            'enemy',
            'glideTo',
            math(self('enemy', 'x'), '-', num(36)),
            self('enemy', 'y'),
            math(num(1.4), '-', math(v('wave'), '×', num(0.04))),
          ),
          when('ec-dive', and(play(), cmp(random(1, 100), '≤', math(num(4), '+', v('wave')))), [
            note(
              call(
                'ec-dive-go',
                'Sprite',
                'enemy',
                'glideTo',
                self('ship', 'x'),
                num(820),
                num(1.6),
              ),
              {
                fr: 'Parfois, il pique vers le vaisseau !',
                en: 'Sometimes, it dives at the ship!',
              },
            ),
            change('ec-dive-gone', 'enemiesLeft', -1),
            run('ec-dive-next', { fr: 'vérifier la vague', en: 'check the wave' }),
            call('ec-dive-delete', 'Sprite', 'enemy', 'delete'),
          ]),
        ]),
      ]),
      {
        fr: 'Chaque ennemi (un clone) vit sa vie : il entre, se balance, tire et parfois pique.',
        en: 'Each enemy (a clone) lives its life: it flies in, sways, shoots and sometimes dives.',
      },
    ),
    note(
      fn('check', { fr: 'vérifier la vague', en: 'check the wave' }, [
        when('check-if', and(play(), and(cmp(v('enemiesLeft'), '≤', num(0)), not(v('bossOn')))), [
          setVar('check-zero', 'enemiesLeft', num(0)),
          run('check-next', NEXT),
        ]),
      ]),
      { fr: 'Plus d’ennemis ? Vague suivante !', en: 'No enemies left? Next wave!' },
    ),
    on('bullet-clone', 'Sprite', 'bullet', 'clone', [
      set('bc-show', 'Sprite', 'bullet', 'visible', bool(true)),
      set('bc-vy', 'Sprite', 'bullet', 'vy', math(num(260), '+', math(v('wave'), '×', num(12)))),
      note(
        set(
          'bc-vx',
          'Sprite',
          'bullet',
          'vx',
          math(math(self('ship', 'x'), '-', self('bullet', 'x')), '÷', num(2.2)),
        ),
        {
          fr: 'Les tirs ennemis visent un peu le vaisseau.',
          en: 'Enemy shots aim a little at the ship.',
        },
      ),
    ]),
    note(
      on(
        'enemy-hit',
        'Sprite',
        'enemy',
        'hit',
        [
          when('eh-clone', self('enemy', 'isClone'), [
            change('eh-hp', 'hits', 1),
            set('eh-value', 'Sprite', 'enemy', 'value', math(self('enemy', 'value'), '-', num(1))),
            set('eh-flash', 'Sprite', 'enemy', 'opacity', num(45)),
            when(
              'eh-dead',
              cmp(self('enemy', 'value'), '≤', num(0)),
              [
                change('eh-score', 'score', math(self('enemy', 'costume'), '×', num(10))),
                run('eh-show', FN.score),
                run('eh-boom', BOOM, { boomX: self('enemy', 'x'), boomY: self('enemy', 'y') }),
                when('eh-bonus', cmp(random(1, 10), '=', num(1)), [
                  run('eh-bonus-run', BONUS, {
                    boomX: self('enemy', 'x'),
                    boomY: self('enemy', 'y'),
                  }),
                ]),
                change('eh-left', 'enemiesLeft', -1),
                call('eh-delete', 'Sprite', 'enemy', 'delete'),
                run('eh-check', { fr: 'vérifier la vague', en: 'check the wave' }),
              ],
              [wait('eh-wait', 0.08), set('eh-unflash', 'Sprite', 'enemy', 'opacity', num(100))],
            ),
          ]),
        ],
        'laser',
      ),
      {
        fr: 'Touché : un point de vie en moins. À zéro, il explose (10, 20 ou 30 points).',
        en: 'Hit: one health point less. At zero, it explodes (10, 20 or 30 points).',
      },
    ),
    note(
      fn(
        'boom',
        BOOM,
        [
          call('boom-sound', 'Sound', 'sndBoom', 'play'),
          call('boom-go', 'Sprite', 'boom', 'goTo', v('boomX'), v('boomY')),
          call('boom-clone', 'Sprite', 'boom', 'clone'),
        ],
        ['boomX', 'boomY'],
      ),
      { fr: 'Une explosion, à l’endroit donné.', en: 'An explosion, where it is asked.' },
    ),
    on('boom-clone', 'Sprite', 'boom', 'clone', [
      set('bo-show', 'Sprite', 'boom', 'visible', bool(true)),
      call('bo-anim', 'Sprite', 'boom', 'animate', num(1), num(3), num(14)),
      wait('bo-wait', 0.22),
      call('bo-delete', 'Sprite', 'boom', 'delete'),
    ]),
    note(
      fn(
        'bonus',
        BONUS,
        [
          set('bonus-kind', 'Sprite', 'powerUp', 'costume', random(1, 3)),
          call('bonus-go', 'Sprite', 'powerUp', 'goTo', v('boomX'), v('boomY')),
          call('bonus-clone', 'Sprite', 'powerUp', 'clone'),
        ],
        ['boomX', 'boomY'],
      ),
      {
        fr: 'Un bonus au hasard : tir triple, bouclier ou vie.',
        en: 'A random power-up: triple shot, shield or life.',
      },
    ),
    on('bonus-clone', 'Sprite', 'powerUp', 'clone', [
      set('pc-show', 'Sprite', 'powerUp', 'visible', bool(true)),
      set('pc-vy', 'Sprite', 'powerUp', 'vy', num(130)),
    ]),
    note(
      on(
        'bonus-take',
        'Sprite',
        'powerUp',
        'hit',
        [
          when('bt-clone', self('powerUp', 'isClone'), [
            call('bt-sound', 'Sound', 'sndBonus', 'play'),
            when(
              'bt-triple',
              cmp(self('powerUp', 'costume'), '=', num(1)),
              [
                setVar('bt-triple-on', 'triple', bool(true)),
                call('bt-triple-timer', 'Timer', 'tripleTimer', 'start'),
              ],
              [
                when(
                  'bt-shield',
                  cmp(self('powerUp', 'costume'), '=', num(2)),
                  [
                    setVar('bt-shield-on', 'shielded', bool(true)),
                    set('bt-shield-show', 'Sprite', 'bubble', 'visible', bool(true)),
                  ],
                  [
                    setVar('bt-life', 'lives', between(math(v('lives'), '+', num(1)), 0, 5)),
                    run('bt-lives', LIVES),
                  ],
                ),
              ],
            ),
            call('bt-delete', 'Sprite', 'powerUp', 'delete'),
          ]),
        ],
        'ship',
      ),
      { fr: 'Le vaisseau attrape un bonus.', en: 'The ship catches a power-up.' },
    ),
    on('triple-end', 'Timer', 'tripleTimer', 'tick', [setVar('te-off', 'triple', bool(false))]),
    note(
      fn('boss', BOSS, [
        setVar('boss-on', 'bossOn', bool(true)),
        note(setVar('boss-max', 'bossMax', math(num(30), '+', math(v('wave'), '×', num(5)))), {
          fr: 'Le vaisseau mère est plus solide à chaque fois.',
          en: 'The mothership is tougher each time.',
        }),
        setVar('boss-hp', 'bossHp', v('bossMax')),
        set('boss-costume', 'Sprite', 'boss', 'costume', num(1)),
        call('boss-top', 'Sprite', 'boss', 'goTo', num(180), num(-80)),
        set('boss-show', 'Sprite', 'boss', 'visible', bool(true)),
        set('boss-frame', 'Sprite', 'barFrame', 'visible', bool(true)),
        set('boss-fill', 'Sprite', 'barFill', 'visible', bool(true)),
        run('boss-bar', BAR),
        call('boss-sound', 'Sound', 'sndBossIn', 'play'),
        call('boss-enter', 'Sprite', 'boss', 'glideTo', num(180), num(150), num(2)),
        whileBoss(),
      ]),
      {
        fr: 'Le vaisseau mère entre, va et vient, et tire en éventail tant qu’il a de la vie.',
        en: 'The mothership flies in, goes back and forth, and fires a spread while it has health.',
      },
    ),
    note(
      fn('bar', BAR, [
        note(
          set(
            'bar-width',
            'Sprite',
            'barFill',
            'width',
            math(num(210), '×', math(v('bossHp'), '÷', v('bossMax'))),
          ),
          {
            fr: 'La barre est aussi large que la vie qui reste…',
            en: 'The bar is as wide as the health left…',
          },
        ),
        note(
          set(
            'bar-x',
            'Sprite',
            'barFill',
            'x',
            math(num(75), '+', math(prop('Sprite', 'barFill', 'width'), '÷', num(2))),
          ),
          {
            fr: '… et reste collée à gauche.',
            en: '… and stays stuck to the left.',
          },
        ),
      ]),
      { fr: 'La barre de vie du vaisseau mère.', en: 'The mothership’s health bar.' },
    ),
    note(
      on(
        'boss-hit',
        'Sprite',
        'boss',
        'hit',
        [
          when('bh-if', cmp(v('bossOn'), '=', bool(true)), [
            change('bh-hp', 'bossHp', -1),
            run('bh-bar', BAR),
            set('bh-flash', 'Sprite', 'boss', 'costume', num(2)),
            when(
              'bh-dead',
              cmp(v('bossHp'), '≤', num(0)),
              [
                setVar('bh-off', 'bossOn', bool(false)),
                change('bh-score', 'score', 500),
                run('bh-show', FN.score),
                call('bh-shake', 'GameScene', scene, 'shake', num(0.8)),
                count('bh-booms', 'boomCount', 1, 5, 1, [
                  run('bh-boom', BOOM, {
                    boomX: math(self('boss', 'x'), '+', random(-70, 70)),
                    boomY: math(self('boss', 'y'), '+', random(-40, 40)),
                  }),
                  wait('bh-boom-wait', 0.12),
                ]),
                set('bh-hide', 'Sprite', 'boss', 'visible', bool(false)),
                set('bh-frame', 'Sprite', 'barFrame', 'visible', bool(false)),
                set('bh-fill', 'Sprite', 'barFill', 'visible', bool(false)),
                run('bh-bonus', BONUS, { boomX: num(180), boomY: num(160) }),
                run('bh-next', NEXT),
              ],
              [wait('bh-wait', 0.06), set('bh-unflash', 'Sprite', 'boss', 'costume', num(1))],
            ),
          ]),
        ],
        'laser',
      ),
      {
        fr: 'Chaque tir enlève un point de vie au vaisseau mère.',
        en: 'Each shot takes one health point from the mothership.',
      },
    ),
    on(
      'bullet-hit-ship',
      'Sprite',
      'bullet',
      'hit',
      [
        when('bhs-clone', and(play(), self('bullet', 'isClone')), [
          call('bhs-delete', 'Sprite', 'bullet', 'delete'),
          run('bhs-hurt', HURT),
        ]),
      ],
      'ship',
    ),
    on(
      'enemy-hit-ship',
      'Sprite',
      'enemy',
      'hit',
      [
        when('ehs-clone', and(play(), self('enemy', 'isClone')), [
          change('ehs-left', 'enemiesLeft', -1),
          run('ehs-boom', BOOM, { boomX: self('enemy', 'x'), boomY: self('enemy', 'y') }),
          call('ehs-delete', 'Sprite', 'enemy', 'delete'),
          run('ehs-hurt', HURT),
          run('ehs-check', { fr: 'vérifier la vague', en: 'check the wave' }),
        ]),
      ],
      'ship',
    ),
    note(
      fn('hurt', HURT, [
        when('hurt-safe', and(play(), not(v('safe'))), [
          when(
            'hurt-shield',
            cmp(v('shielded'), '=', bool(true)),
            [
              note(setVar('hurt-shield-off', 'shielded', bool(false)), {
                fr: 'Le bouclier encaisse le coup.',
                en: 'The shield takes the hit.',
              }),
              set('hurt-bubble', 'Sprite', 'bubble', 'visible', bool(false)),
              call('hurt-shield-sound', 'Sound', 'sndBonus', 'play'),
            ],
            [
              change('hurt-life', 'lives', -1),
              run('hurt-lives', LIVES),
              call('hurt-sound', 'Sound', 'sndHurt', 'play'),
              call('hurt-shake', 'GameScene', scene, 'shake', num(0.35)),
              when(
                'hurt-over',
                cmp(v('lives'), '≤', num(0)),
                [
                  setVar('hurt-lost', 'state', str(STATE.lost)),
                  run('hurt-boom', BOOM, { boomX: self('ship', 'x'), boomY: self('ship', 'y') }),
                  set('hurt-hide', 'Sprite', 'ship', 'visible', bool(false)),
                  wait('hurt-wait', 1),
                  set('hurt-pause', 'GameScene', scene, 'paused', bool(true)),
                  run('hurt-end', FN.end),
                ],
                [
                  note(setVar('hurt-safe-on', 'safe', bool(true)), {
                    fr: 'Une seconde et demie sans pouvoir être touché (il clignote).',
                    en: 'One second and a half without being hit (it blinks).',
                  }),
                  count('hurt-blink', 'blink', 1, 6, 1, [
                    set('hurt-dim', 'Sprite', 'ship', 'opacity', num(30)),
                    wait('hurt-dim-wait', 0.12),
                    set('hurt-light', 'Sprite', 'ship', 'opacity', num(100)),
                    wait('hurt-light-wait', 0.12),
                  ]),
                  setVar('hurt-safe-off', 'safe', bool(false)),
                ],
              ),
            ],
          ),
        ]),
      ]),
      {
        fr: '… perd une vie, sauf s’il a un bouclier.',
        en: '… loses a life, unless it has a shield.',
      },
    ),
    fn('lives', LIVES, [
      set('lv-text', 'SceneText', 'livesText', 'text', join(str('× '), v('lives'))),
    ]),
  ]
}

/** The mothership's life: back and forth, a spread of shots, while it lives. */
function whileBoss(): Block {
  return {
    type: 'controls_whileUntil',
    id: 'boss-loop',
    fields: { MODE: 'WHILE' },
    inputs: {
      BOOL: { block: and(play(), cmp(v('bossOn'), '=', bool(true))) },
      DO: {
        block: chainBlocks([
          call(
            'boss-move',
            'Sprite',
            'boss',
            'glideTo',
            random(70, 290),
            random(110, 200),
            num(1.1),
          ),
          when('boss-fire-if', and(play(), cmp(v('bossOn'), '=', bool(true))), [
            call('boss-shot-sound', 'Sound', 'sndLaser', 'play'),
            count('boss-fan', 'fan', -2, 2, 1, [
              call(
                'boss-shot-go',
                'Sprite',
                'bullet',
                'goTo',
                math(self('boss', 'x'), '+', math(v('fan'), '×', num(30))),
                math(self('boss', 'y'), '+', num(50)),
              ),
              call('boss-shot', 'Sprite', 'bullet', 'clone'),
            ]),
          ]),
        ]),
      },
    },
  }
}

function chainBlocks(blocks: Block[]): Block {
  const [first, ...rest] = blocks
  if (!first) throw new Error('empty chain')
  return rest.length ? { ...first, next: { block: chainBlocks(rest) } } : first
}

export const GALAXY_PATROL: GameSource = {
  id: 'galaxy-patrol',
  order: 25,
  mode: 'studio',
  icon: '🚀',
  accent: 'indigo',
  title: { fr: 'Patrouille Galactique', en: 'Galaxy Patrol' },
  description: {
    fr: 'Tir spatial : vagues d’ennemis en formation, bonus, et un vaisseau mère toutes les quatre vagues.',
    en: 'Space shooter: waves of enemies in formation, power-ups, and a mothership every four waves.',
  },
  theme: { primary: '#8a3ffc', font: 'rounded' },
  variables: [
    ...KIT_VARIABLES,
    { key: 'lives', name: { fr: 'vies', en: 'lives' }, initial: 3 },
    { key: 'shipSpeed', name: { fr: 'vitesseVaisseau', en: 'shipSpeed' }, initial: 330 },
    { key: 'fireRate', name: { fr: 'cadenceTir', en: 'fireRate' }, initial: 0.22 },
    { key: 'bossEvery', name: { fr: 'bossToutesLes', en: 'bossEvery' }, initial: 4 },
    { key: 'wave', name: { fr: 'vague', en: 'wave' }, initial: 0 },
    { key: 'rows', name: { fr: 'rangées', en: 'rows' }, initial: 1 },
    { key: 'row', name: { fr: 'rangée', en: 'row' }, initial: 1 },
    { key: 'column', name: { fr: 'colonne', en: 'column' }, initial: 1 },
    { key: 'enemiesLeft', name: { fr: 'ennemisRestants', en: 'enemiesLeft' }, initial: 0 },
    { key: 'hits', name: { fr: 'tirsRéussis', en: 'hits' }, initial: 0 },
    { key: 'triple', name: { fr: 'tirTriple', en: 'tripleShot' }, initial: false },
    { key: 'shielded', name: { fr: 'bouclier', en: 'shielded' }, initial: false },
    { key: 'safe', name: { fr: 'protégé', en: 'safe' }, initial: false },
    { key: 'bossOn', name: { fr: 'bossLà', en: 'bossHere' }, initial: false },
    { key: 'bossHp', name: { fr: 'vieBoss', en: 'bossHealth' }, initial: 0 },
    { key: 'bossMax', name: { fr: 'vieBossMax', en: 'bossMaxHealth' }, initial: 1 },
    { key: 'boomX', name: { fr: 'xExplosion', en: 'boomX' }, initial: 0 },
    { key: 'boomY', name: { fr: 'yExplosion', en: 'boomY' }, initial: 0 },
    { key: 'boomCount', name: { fr: 'explosion', en: 'boomCount' }, initial: 0 },
    { key: 'fan', name: { fr: 'éventail', en: 'fan' }, initial: 0 },
    { key: 'blink', name: { fr: 'clignote', en: 'blink' }, initial: 0 },
  ],
  screen: { key: 'game', name: { fr: 'Jeu', en: 'Game' }, props: { padding: 0 } },
  components: [
    {
      key: scene,
      type: 'GameScene',
      name: { fr: 'Espace', en: 'Space' },
      props: { background: '#0b0d2e', edges: 'pass', sceneHeight: 720 },
      children: [
        sprite(
          'starsA',
          { fr: 'Étoiles1', en: 'Stars1' },
          { costumes: ['asset:stars'], x: 180, y: 360, width: 360, height: 720, vy: 70 },
        ),
        sprite(
          'starsB',
          { fr: 'Étoiles2', en: 'Stars2' },
          { costumes: ['asset:stars'], x: 180, y: -360, width: 360, height: 720, vy: 70 },
        ),
        sprite(
          'planet',
          { fr: 'Planète', en: 'Planet' },
          { costumes: ['asset:planet'], x: 280, y: 160, width: 120, height: 120, vy: 18 },
        ),
        sprite(
          'powerUp',
          { fr: 'Bonus', en: 'PowerUp' },
          {
            costumes: ['asset:triple', 'asset:shield', 'asset:life'],
            x: -100,
            y: -100,
            width: 40,
            height: 40,
            visible: false,
            collision: 'circle',
          },
        ),
        sprite(
          'laser',
          { fr: 'Laser', en: 'Laser' },
          {
            costumes: ['asset:laser'],
            x: -100,
            y: -200,
            width: 10,
            height: 28,
            visible: false,
            collision: 'box',
          },
        ),
        sprite(
          'bullet',
          { fr: 'TirEnnemi', en: 'EnemyShot' },
          {
            costumes: ['asset:bullet'],
            x: -100,
            y: -300,
            width: 18,
            height: 18,
            visible: false,
            collision: 'circle',
          },
        ),
        sprite(
          'enemy',
          { fr: 'Ennemi', en: 'Enemy' },
          {
            costumes: ['asset:saucer', 'asset:wasp', 'asset:crab'],
            x: -100,
            y: -400,
            width: 50,
            height: 42,
            visible: false,
            collision: 'box',
          },
        ),
        sprite(
          'boss',
          { fr: 'VaisseauMère', en: 'Mothership' },
          {
            costumes: ['asset:boss', 'asset:boss-hurt'],
            x: 180,
            y: -80,
            width: 180,
            height: 120,
            visible: false,
            collision: 'box',
          },
        ),
        sprite(
          'boom',
          { fr: 'Explosion', en: 'Explosion' },
          {
            costumes: ['asset:boom-1', 'asset:boom-2', 'asset:boom-3'],
            x: -100,
            y: -500,
            width: 64,
            height: 64,
            visible: false,
          },
        ),
        sprite(
          'ship',
          { fr: 'Vaisseau', en: 'Ship' },
          {
            costumes: ['asset:ship-1', 'asset:ship-2'],
            x: 180,
            y: 560,
            width: 56,
            height: 64,
            collision: 'box',
            edges: 'stop',
          },
        ),
        sprite(
          'bubble',
          { fr: 'Bulle', en: 'Bubble' },
          { costumes: ['asset:bubble'], x: 180, y: 560, width: 88, height: 88, visible: false },
        ),
        sprite(
          'barFrame',
          { fr: 'CadreVie', en: 'HealthFrame' },
          { costumes: ['asset:bar-frame'], x: 180, y: 92, width: 220, height: 26, visible: false },
        ),
        sprite(
          'barFill',
          { fr: 'Vie', en: 'Health' },
          { costumes: ['asset:bar-fill'], x: 180, y: 92, width: 210, height: 16, visible: false },
        ),
        sprite(
          'heart',
          { fr: 'Cœur', en: 'Heart' },
          { costumes: ['asset:heart'], x: 30, y: 38, width: 30, height: 30, visible: false },
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
            color: '#ffffff',
            outline: false,
            visible: false,
          },
        },
        {
          key: 'waveText',
          type: 'SceneText',
          name: { fr: 'TexteVague', en: 'WaveText' },
          props: {
            text: '',
            x: 345,
            y: 38,
            align: 'right',
            fontSize: 20,
            color: '#c3b5ff',
            outline: false,
            visible: false,
          },
        },
        {
          key: 'bannerText',
          type: 'SceneText',
          name: { fr: 'TexteAnnonce', en: 'BannerText' },
          props: {
            text: '',
            x: 180,
            y: 320,
            fontSize: 44,
            color: '#ffe066',
            outline: false,
            visible: false,
          },
        },
        {
          key: 'stick',
          type: 'Joystick',
          name: { fr: 'Manette', en: 'Stick' },
          props: { x: 285, y: 640, size: 120, color: '#c3b5ff', keys: 'arrows', visible: false },
        },
        ...kitComponents(KIT),
      ],
    },
    {
      key: 'guns',
      type: 'Timer',
      name: { fr: 'Canons', en: 'Guns' },
      props: { interval: 0.22, repeat: true, autostart: false },
    },
    {
      key: 'tripleTimer',
      type: 'Timer',
      name: { fr: 'MinuteurTriple', en: 'TripleTimer' },
      props: { interval: 10, repeat: false, autostart: false },
    },
    {
      key: 'sndLaser',
      type: 'Sound',
      name: { fr: 'SonLaser', en: 'LaserSound' },
      props: { src: 'asset:laser-sound', volume: 40 },
    },
    {
      key: 'sndBoom',
      type: 'Sound',
      name: { fr: 'SonExplosion', en: 'BoomSound' },
      props: { src: 'asset:boom-sound' },
    },
    {
      key: 'sndBonus',
      type: 'Sound',
      name: { fr: 'SonBonus', en: 'BonusSound' },
      props: { src: 'asset:bonus-sound' },
    },
    {
      key: 'sndHurt',
      type: 'Sound',
      name: { fr: 'SonTouché', en: 'HurtSound' },
      props: { src: 'asset:hurt' },
    },
    {
      key: 'sndBossIn',
      type: 'Sound',
      name: { fr: 'SonBoss', en: 'BossSound' },
      props: { src: 'asset:boss-sound' },
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
            'ship-1': { fr: 'vaisseau', en: 'ship' },
            'ship-2': { fr: 'vaisseau à pleine puissance', en: 'ship at full power' },
            laser: { fr: 'laser', en: 'laser' },
            bullet: { fr: 'tir ennemi', en: 'enemy shot' },
            saucer: { fr: 'soucoupe', en: 'saucer' },
            wasp: { fr: 'guêpe de l’espace', en: 'space wasp' },
            crab: { fr: 'crabe de l’espace', en: 'space crab' },
            boss: { fr: 'vaisseau mère', en: 'mothership' },
            'boss-hurt': { fr: 'vaisseau mère touché', en: 'mothership hit' },
            'boom-1': { fr: 'explosion 1', en: 'explosion 1' },
            'boom-2': { fr: 'explosion 2', en: 'explosion 2' },
            'boom-3': { fr: 'explosion 3', en: 'explosion 3' },
            triple: { fr: 'bonus tir triple', en: 'triple shot power-up' },
            shield: { fr: 'bonus bouclier', en: 'shield power-up' },
            life: { fr: 'bonus vie', en: 'life power-up' },
            bubble: { fr: 'bouclier', en: 'shield' },
            stars: { fr: 'étoiles', en: 'stars' },
            planet: { fr: 'planète', en: 'planet' },
            'bar-frame': { fr: 'cadre de la barre de vie', en: 'health bar frame' },
            'bar-fill': { fr: 'barre de vie', en: 'health bar' },
            heart: { fr: 'cœur', en: 'heart' },
          }[key] ?? { fr: key, en: key },
          svg: file,
        },
      ]),
    ),
    ...kitArt(KIT),
  },
  sounds: {
    'laser-sound': {
      name: { fr: 'laser', en: 'laser' },
      wav: wav([{ wave: 'square', from: 1600, to: 500, seconds: 0.09, volume: 0.3, duty: 0.2 }]),
    },
    'boom-sound': { name: { fr: 'explosion', en: 'explosion' }, wav: COMMON_SOUNDS.explosion() },
    'bonus-sound': { name: { fr: 'bonus', en: 'power-up' }, wav: COMMON_SOUNDS.powerUp() },
    hurt: { name: { fr: 'touché', en: 'hit' }, wav: COMMON_SOUNDS.hurt() },
    'boss-sound': {
      name: { fr: 'arrivée du boss', en: 'boss arrives' },
      wav: wav(melody([-12, -9, -12, -5, -12], 0.16, { wave: 'saw', volume: 0.3 })),
    },
    ...kitSounds(),
  },
  cover: cover(),
}
