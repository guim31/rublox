import {
  and,
  type Block,
  bool,
  call,
  change,
  choose,
  cmp,
  ev,
  floor,
  fn,
  fnResult,
  forEach,
  lastIndexOf,
  length,
  list,
  math,
  modulo,
  note,
  num,
  on,
  or,
  prop,
  push,
  random,
  result,
  run,
  set,
  setVar,
  str,
  until,
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
import { coverStyle, INK, ink, rgradient, starPath, svg, symbol, use } from './svg.ts'
import type { GameSource } from './types.ts'

/**
 * Serpentin (Wiggle Snake): a snake moves on a grid at the pace of a timer. Swipe, tap the
 * arrows or use the keyboard to turn; each fruit makes it longer and faster; a golden fruit
 * now and then is worth five. The snake is a list of cells (its path) and clones of a ring;
 * an invisible eraser removes the ring at the end of the tail.
 */

// Pictures

function board(): string {
  return svg(
    360,
    480,
    `<rect width="360" height="480" fill="url(#cells)"/>` +
      `<rect x="1.5" y="1.5" width="357" height="477" rx="6" fill="none" stroke="#1b4a2c" stroke-width="3"/>`,
    `<pattern id="cells" width="60" height="60" patternUnits="userSpaceOnUse">` +
      `<rect width="60" height="60" fill="#a9de7f"/>` +
      `<rect width="30" height="30" fill="#98d16c"/><rect x="30" y="30" width="30" height="30" fill="#98d16c"/>` +
      `<path d="M8 22 l2 -5 l2 5 M42 50 l2 -5 l2 5" stroke="#7fbf57" stroke-width="2" fill="none"/>` +
      `</pattern>`,
  )
}

function head(hurt: boolean): string {
  const eye = (y: number) =>
    hurt
      ? `<path d="M40 ${y - 5} l9 9 M49 ${y - 5} l-9 9" ${ink(3.5)}/>`
      : `<circle cx="44" cy="${y}" r="8" fill="#fff" ${ink(3)}/><circle cx="47" cy="${y}" r="4" fill="${INK}"/><circle cx="48.5" cy="${y - 1.5}" r="1.4" fill="#fff"/>`
  return svg(
    64,
    64,
    `<path d="M6 12 Q6 4 16 4 L40 4 Q60 4 60 32 Q60 60 40 60 L16 60 Q6 60 6 52 Z" fill="url(#skin)" ${ink(3.5)}/>` +
      `<path d="M14 14 q14 -4 28 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.5"/>` +
      eye(20) +
      eye(44) +
      `<circle cx="57" cy="28" r="1.8" fill="${INK}"/><circle cx="57" cy="36" r="1.8" fill="${INK}"/>` +
      (hurt
        ? ''
        : `<path d="M61 32 l4 0 l2 -3 M65 32 l2 3" stroke="#e8344f" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
    rgradient('skin', [
      [0, '#9be35f'],
      [1, '#3f9e3a'],
    ]),
  )
}

function ring(light: boolean): string {
  const [a, b] = light ? ['#a7ea6a', '#4fb245'] : ['#7fd04f', '#358a31']
  return svg(
    64,
    64,
    `<rect x="4" y="4" width="56" height="56" rx="20" fill="url(#r)" ${ink(3.5)}/>` +
      `<circle cx="32" cy="32" r="9" fill="${light ? '#ffe066' : '#ffd23f'}" opacity="0.85" ${ink(2)}/>` +
      `<path d="M14 16 q10 -6 22 -4" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.45"/>`,
    rgradient('r', [
      [0, a],
      [1, b],
    ]),
  )
}

function fruit(squash: number): string {
  return svg(
    64,
    64,
    `<g transform="translate(32 36) scale(${1 + squash * 0.06} ${1 - squash * 0.06}) translate(-32 -36)">` +
      `<path d="M32 18 C18 10 6 20 8 36 C10 52 22 60 32 56 C42 60 54 52 56 36 C58 20 46 10 32 18 Z" fill="url(#f)" ${ink(3.5)}/>` +
      `<ellipse cx="20" cy="30" rx="5" ry="8" fill="#fff" opacity="0.55" transform="rotate(20 20 30)"/></g>` +
      `<path d="M32 18 q-2 -8 2 -14" stroke="#7a4a1d" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M34 10 q12 -8 20 2 q-10 6 -20 -2 Z" fill="#5ac35a" ${ink(2.5)}/>`,
    rgradient('f', [
      [0, '#ff8a8a'],
      [0.6, '#ef3b3b'],
      [1, '#b5172e'],
    ]),
  )
}

function bonus(shine: boolean): string {
  return svg(
    64,
    64,
    `<path d="${starPath(32, 34, 28, 13)}" fill="url(#g)" ${ink(3.5)}/>` +
      `<path d="${starPath(32, 34, 14, 6.5)}" fill="#fff6b0" opacity="0.7"/>` +
      (shine
        ? `<path d="M52 8 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 Z" fill="#fff" ${ink(1.5)}/><path d="M10 50 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#fff" ${ink(1.5)}/>`
        : ''),
    rgradient('g', [
      [0, '#fff3a6'],
      [0.6, '#ffc93c'],
      [1, '#e8930c'],
    ]),
  )
}

function arrowButton(): string {
  return svg(
    72,
    72,
    `<rect x="4" y="8" width="64" height="62" rx="18" fill="#123623"/>` +
      `<rect x="4" y="4" width="64" height="62" rx="18" fill="url(#k)" ${ink(3)}/>` +
      `<path d="M36 18 L54 42 L42 42 L42 54 L30 54 L30 42 L18 42 Z" fill="#2f8f46" ${ink(3)}/>` +
      `<rect x="14" y="10" width="34" height="7" rx="3.5" fill="#fff" opacity="0.6"/>`,
    rgradient('k', [
      [0, '#ffffff'],
      [1, '#d6f2c6'],
    ]),
  )
}

const ART = {
  board: board(),
  head: head(false),
  'head-hurt': head(true),
  'ring-light': ring(true),
  'ring-dark': ring(false),
  fruit: fruit(0),
  'fruit-squash': fruit(1),
  bonus: bonus(true),
  'bonus-dim': bonus(false),
  arrow: arrowButton(),
}

function cover(): string {
  const cells: [number, number][] = [
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 5],
    [5, 4],
    [5, 3],
    [6, 3],
    [7, 3],
    [8, 3],
  ]
  const at = (c: number) => c * 30 + 3
  return svg(
    340,
    220,
    coverStyle(
      '.fruit { animation: bob 0.6s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; } ' +
        '.snake { animation: wiggle 0.8s ease-in-out infinite alternate; } ' +
        '@keyframes bob { to { transform: scale(1.18); } } ' +
        '@keyframes wiggle { to { transform: translateX(6px); } }',
    ) +
      `<defs>${symbol(ART['ring-light'], 'rl')}${symbol(ART['ring-dark'], 'rd')}${symbol(ART.board, 'b')}${symbol(ART.head, 'h')}${symbol(ART.fruit, 'f')}${symbol(ART.bonus, 's')}</defs>` +
      use('b', -20, -20, 380, 507) +
      `<g class="snake">${cells
        .map(([c, r], i) => use(i % 2 ? 'rd' : 'rl', at(c), at(r) - 20, 28, 28))
        .join('')}` +
      `${use('h', at(9) - 2, at(3) - 22, 32, 32)}</g>` +
      `<g class="fruit">${use('f', at(9), at(5) - 20, 34, 34)}</g>` +
      use('s', at(2), at(1) - 20, 34, 34),
  )
}

// Recipe

const scene = 'garden'
const MOVE = { fr: 'faire avancer le serpent', en: 'move the snake' }
const PREPARE = { fr: 'préparer le serpent', en: 'get the snake ready' }
const PLACE = { fr: 'poser un anneau', en: 'put a ring' }
const TURN = { fr: 'tourner', en: 'turn' }
const EAT = { fr: 'manger le fruit', en: 'eat the fruit' }
const EAT_BONUS = { fr: 'manger le fruit doré', en: 'eat the golden fruit' }
const PLACE_FRUIT = { fr: 'poser un fruit', en: 'put a fruit' }
const PLACE_BONUS = { fr: 'poser un fruit doré', en: 'put a golden fruit' }
const FREE = { fr: 'une case libre', en: 'a free cell' }
const X_OF = { fr: 'x de la case', en: 'x of cell' }
const Y_OF = { fr: 'y de la case', en: 'y of cell' }
const CRASH = { fr: 'le serpent se cogne', en: 'the snake bumps' }

const cellX = (cell: Block) => result(X_OF, { n: cell })
const cellY = (cell: Block) => result(Y_OF, { n: cell })
const last = () => ({
  type: 'lists_getIndex',
  fields: { MODE: 'GET', WHERE: 'FROM_START' },
  inputs: { VALUE: { block: v('path') }, AT: { block: length(v('path')) } },
})
const at = (index: Block) => ({
  type: 'lists_getIndex',
  fields: { MODE: 'GET', WHERE: 'FROM_START' },
  inputs: { VALUE: { block: v('path') }, AT: { block: index } },
})
const play = () => cmp(v('state'), '=', str(STATE.play))

const sprite = (key: string, name: { fr: string; en: string }, props: Record<string, unknown>) => ({
  key,
  type: 'Sprite',
  name,
  props: { collision: 'none', ...props },
})

const KIT = {
  scene,
  title: { fr: 'Serpentin', en: 'Wiggle Snake' },
  hint: {
    fr: 'Glisse le doigt, touche les flèches\nou utilise le clavier. Mange les fruits !',
    en: 'Swipe, tap the arrows\nor use the keyboard. Eat the fruits!',
  },
  overTitle: { fr: 'Aïe, un nœud !', en: 'Oops, a knot!' },
  textColor: '#123623',
  scoreColor: '#ffffff',
  scoreY: 36,
  bestY: 532,
  titleSize: 48,
  buttonColor: ['#ff7a45', '#d9480f'] as [string, string],
  panelColor: ['#f4ffe9', '#2f8f46'] as [string, string],
}

const turnOn = (id: string, key: string, dx: number, dy: number) =>
  on(id, 'Sprite', key, 'tap', [run(`${id}-turn`, TURN, { dx: num(dx), dy: num(dy) })])

/** "if the key (or swipe) is …, turn": one test per direction. */
function directions(id: string, value: Block, names: Record<string, [number, number]>): Block[] {
  return Object.entries(names).map(([name, [dx, dy]]) =>
    when(`${id}-${name}`, cmp(value, '=', str(name)), [
      run(`${id}-${name}-turn`, TURN, { dx: num(dx), dy: num(dy) }),
    ]),
  )
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
        note(setVar('set-pace', 'pace', num(0.2)), {
          fr: 'Le temps entre deux pas, au début (en secondes).',
          en: 'The time between two steps, at the start (in seconds).',
        }),
        note(setVar('set-fastest', 'fastest', num(0.075)), {
          fr: 'Le temps le plus court : la vitesse maximale.',
          en: 'The shortest time: the top speed.',
        }),
        note(setVar('set-faster', 'faster', num(0.005)), {
          fr: 'Combien chaque fruit fait accélérer.',
          en: 'How much faster each fruit makes it.',
        }),
        setVar('set-bonus', 'bonusEvery', num(5)),
      ]),
      CHANGE_ME,
    ),
    ...kitBlocks({
      scene,
      onTitle: [
        call('t-clones', 'GameScene', scene, 'deleteClones'),
        set('t-unpause', 'GameScene', scene, 'paused', bool(false)),
        call('t-timer', 'Timer', 'clock', 'stop'),
        set('t-head', 'Sprite', 'head', 'visible', bool(false)),
        set('t-fruit', 'Sprite', 'fruit', 'visible', bool(false)),
        set('t-bonus', 'Sprite', 'bonus', 'visible', bool(false)),
      ],
      onStart: [run('s-prepare', PREPARE)],
      onEnd: [],
    }),
    note(
      fn('prepare', PREPARE, [
        call('p-clones', 'GameScene', scene, 'deleteClones'),
        set('p-unpause', 'GameScene', scene, 'paused', bool(false)),
        note(setVar('p-path', 'path', list(num(8), num(108), num(208))), {
          fr: 'Le chemin du serpent : une case = colonne × 100 + ligne. La dernière, c’est la tête.',
          en: 'The snake’s path: a cell = column × 100 + row. The last one is the head.',
        }),
        setVar('p-size', 'size', num(3)),
        setVar('p-grow', 'grow', num(0)),
        setVar('p-eaten', 'eaten', num(0)),
        setVar('p-dx', 'dirX', num(1)),
        setVar('p-dy', 'dirY', num(0)),
        setVar('p-nx', 'nextX', num(1)),
        setVar('p-ny', 'nextY', num(0)),
        setVar('p-bonus', 'bonusCell', num(-1)),
        setVar('p-cell', 'cell', num(208)),
        forEach('p-rings', 'cell', list(num(8), num(108)), [
          run('p-ring', PLACE, { n: v('cell') }),
        ]),
        call('p-head', 'Sprite', 'head', 'goTo', cellX(num(208)), cellY(num(208))),
        set('p-head-costume', 'Sprite', 'head', 'costume', num(1)),
        set('p-head-turn', 'Sprite', 'head', 'rotation', num(0)),
        set('p-head-show', 'Sprite', 'head', 'visible', bool(true)),
        call('p-eraser', 'Sprite', 'eraser', 'goTo', num(-100), num(-100)),
        set('p-bonus-hide', 'Sprite', 'bonus', 'visible', bool(false)),
        run('p-fruit', PLACE_FRUIT),
        set('p-pace', 'Timer', 'clock', 'interval', v('pace')),
        call('p-start', 'Timer', 'clock', 'start'),
      ]),
      { fr: 'Un serpent de trois cases, au milieu.', en: 'A snake of three cells, in the middle.' },
    ),
    note(
      fnResult(
        'x-of',
        X_OF,
        [],
        math(num(15), '+', math(num(30), '×', floor(math(v('n'), '÷', num(100))))),
        ['n'],
      ),
      {
        fr: 'La colonne est la centaine de la case.',
        en: 'The column is the hundreds of the cell.',
      },
    ),
    note(
      fnResult('y-of', Y_OF, [], math(num(85), '+', math(num(30), '×', modulo(v('n'), 100))), [
        'n',
      ]),
      {
        fr: 'La ligne est le reste de la division par 100.',
        en: 'The row is what is left after dividing by 100.',
      },
    ),
    note(
      fn(
        'place',
        PLACE,
        [
          call('place-go', 'Sprite', 'ring', 'goTo', cellX(v('n')), cellY(v('n'))),
          change('place-step', 'step', 1),
          note(
            set(
              'place-costume',
              'Sprite',
              'ring',
              'costume',
              math(num(1), '+', modulo(v('step'), 2)),
            ),
            {
              fr: 'Un anneau clair, un foncé : des rayures !',
              en: 'A light ring, a dark one: stripes!',
            },
          ),
          call('place-clone', 'Sprite', 'ring', 'clone'),
        ],
        ['n'],
      ),
      { fr: 'Chaque anneau du corps est un clone.', en: 'Each ring of the body is a clone.' },
    ),
    note(
      on('tick', 'Timer', 'clock', 'tick', [when('tick-if', play(), [run('tick-move', MOVE)])]),
      {
        fr: 'Le minuteur donne le rythme : un pas à chaque tic.',
        en: 'The timer sets the pace: one step at each tick.',
      },
    ),
    note(
      fn('move', MOVE, [
        call('m-eraser-away', 'Sprite', 'eraser', 'goTo', num(-100), num(-100)),
        setVar('m-dx', 'dirX', v('nextX')),
        setVar('m-dy', 'dirY', v('nextY')),
        note(setVar('m-col', 'col', math(floor(math(last(), '÷', num(100))), '+', v('dirX'))), {
          fr: 'La case d’après, dans le sens où il va.',
          en: 'The next cell, the way it is going.',
        }),
        setVar('m-row', 'row', math(modulo(last(), 100), '+', v('dirY'))),
        when(
          'm-wall',
          or(
            or(cmp(v('col'), '<', num(0)), cmp(v('col'), '>', num(11))),
            or(cmp(v('row'), '<', num(0)), cmp(v('row'), '>', num(15))),
          ),
          [note(run('m-wall-crash', CRASH), { fr: 'Un mur !', en: 'A wall!' })],
          [
            setVar('m-cell', 'cell', math(math(v('col'), '×', num(100)), '+', v('row'))),
            when(
              'm-grow',
              cmp(v('grow'), '>', num(0)),
              [
                note(change('m-grow-size', 'size', 1), {
                  fr: 'Il grandit : la queue ne bouge pas cette fois.',
                  en: 'It grows: the tail stays this time.',
                }),
                change('m-grow-less', 'grow', -1),
                setVar('m-no-tail', 'tail', num(-1)),
              ],
              [
                setVar(
                  'm-tail',
                  'tail',
                  at(math(math(length(v('path')), '-', v('size')), '+', num(1))),
                ),
              ],
            ),
            when(
              'm-self',
              cmp(
                lastIndexOf(v('path'), v('cell')),
                '>',
                math(math(length(v('path')), '-', v('size')), '+', num(1)),
              ),
              [
                note(run('m-self-crash', CRASH), {
                  fr: 'Il se mord la queue !',
                  en: 'It bites its tail!',
                }),
              ],
              [
                note(run('m-neck', PLACE, { n: last() }), {
                  fr: 'Un anneau là où était la tête…',
                  en: 'A ring where the head was…',
                }),
                push('m-push', 'path', v('cell')),
                call('m-head', 'Sprite', 'head', 'goTo', cellX(v('cell')), cellY(v('cell'))),
                call(
                  'm-look',
                  'Sprite',
                  'head',
                  'pointAt',
                  math(prop('Sprite', 'head', 'x'), '+', v('dirX')),
                  math(prop('Sprite', 'head', 'y'), '+', v('dirY')),
                ),
                when('m-erase', cmp(v('tail'), '≥', num(0)), [
                  note(
                    call(
                      'm-erase-go',
                      'Sprite',
                      'eraser',
                      'goTo',
                      cellX(v('tail')),
                      cellY(v('tail')),
                    ),
                    {
                      fr: '… et la gomme efface le bout de la queue.',
                      en: '… and the eraser wipes the tip of the tail.',
                    },
                  ),
                ]),
                when('m-eat', cmp(v('cell'), '=', v('fruitCell')), [run('m-eat-run', EAT)]),
                when('m-bonus', cmp(v('cell'), '=', v('bonusCell')), [
                  run('m-bonus-run', EAT_BONUS),
                ]),
              ],
            ),
          ],
        ),
      ]),
      {
        fr: 'Un pas : la tête avance d’une case, le corps la suit.',
        en: 'One step: the head moves one cell, the body follows.',
      },
    ),
    note(
      on(
        'erase',
        'Sprite',
        'ring',
        'hit',
        [
          when('erase-clone', prop('Sprite', 'ring', 'isClone'), [
            call('erase-delete', 'Sprite', 'ring', 'delete'),
          ]),
        ],
        'eraser',
      ),
      {
        fr: 'Un anneau touché par la gomme disparaît.',
        en: 'A ring the eraser touches disappears.',
      },
    ),
    note(
      fn(
        'turn',
        TURN,
        [
          when(
            'turn-if',
            or(
              cmp(v('dx'), '≠', math(num(0), '-', v('dirX'))),
              cmp(v('dy'), '≠', math(num(0), '-', v('dirY'))),
            ),
            [setVar('turn-x', 'nextX', v('dx')), setVar('turn-y', 'nextY', v('dy'))],
          ),
        ],
        ['dx', 'dy'],
      ),
      {
        fr: 'Le serpent ne peut pas faire demi-tour d’un coup.',
        en: 'The snake cannot turn right back at once.',
      },
    ),
    note(
      on('keys', 'GameScene', scene, 'keyDown', [
        ...directions('keys', ev('key'), {
          left: [-1, 0],
          right: [1, 0],
          up: [0, -1],
          down: [0, 1],
        }),
      ]),
      { fr: 'Les flèches du clavier.', en: 'The arrow keys.' },
    ),
    note(
      on('swipe', 'GameScene', scene, 'swipe', [
        ...directions('swipe', ev('direction'), {
          left: [-1, 0],
          right: [1, 0],
          up: [0, -1],
          down: [0, 1],
        }),
      ]),
      { fr: 'Glisser le doigt.', en: 'Swiping.' },
    ),
    note(turnOn('pad-up', 'padUp', 0, -1), {
      fr: 'Les flèches à l’écran.',
      en: 'The arrows on the screen.',
    }),
    turnOn('pad-down', 'padDown', 0, 1),
    turnOn('pad-left', 'padLeft', -1, 0),
    turnOn('pad-right', 'padRight', 1, 0),
    note(
      fnResult(
        'free',
        FREE,
        [
          until(
            'free-loop',
            and(
              cmp(lastIndexOf(v('path'), v('spot')), '≤', math(length(v('path')), '-', v('size'))),
              and(cmp(v('spot'), '≠', v('fruitCell')), cmp(v('spot'), '≠', v('bonusCell'))),
            ),
            [
              setVar(
                'free-try',
                'spot',
                math(math(random(0, 11), '×', num(100)), '+', random(0, 15)),
              ),
            ],
          ),
        ],
        v('spot'),
      ),
      {
        fr: 'Essaie des cases au hasard jusqu’à en trouver une où le serpent n’est pas.',
        en: 'Tries random cells until it finds one the snake is not on.',
      },
    ),
    fn('place-fruit', PLACE_FRUIT, [
      setVar('pf-reset', 'spot', v('cell')),
      setVar('pf-cell', 'fruitCell', result(FREE)),
      call('pf-go', 'Sprite', 'fruit', 'goTo', cellX(v('fruitCell')), cellY(v('fruitCell'))),
      set('pf-show', 'Sprite', 'fruit', 'visible', bool(true)),
      call('pf-bob', 'Sprite', 'fruit', 'animate', num(1), num(2), num(3)),
    ]),
    fn('place-bonus', PLACE_BONUS, [
      setVar('pb-reset', 'spot', v('cell')),
      setVar('pb-cell', 'bonusCell', result(FREE)),
      call('pb-go', 'Sprite', 'bonus', 'goTo', cellX(v('bonusCell')), cellY(v('bonusCell'))),
      set('pb-show', 'Sprite', 'bonus', 'visible', bool(true)),
      call('pb-shine', 'Sprite', 'bonus', 'animate', num(1), num(2), num(4)),
      call('pb-timer', 'Timer', 'bonusClock', 'start'),
    ]),
    note(
      fn('eat', EAT, [
        call('eat-sound', 'Sound', 'sndEat', 'play'),
        change('eat-score', 'score', 1),
        run('eat-show', FN.score),
        change('eat-grow', 'grow', 1),
        change('eat-count', 'eaten', 1),
        note(
          set(
            'eat-pace',
            'Timer',
            'clock',
            'interval',
            choose(
              cmp(math(v('pace'), '-', math(v('eaten'), '×', v('faster'))), '>', v('fastest')),
              math(v('pace'), '-', math(v('eaten'), '×', v('faster'))),
              v('fastest'),
            ),
          ),
          { fr: 'Chaque fruit le rend plus rapide.', en: 'Each fruit makes it faster.' },
        ),
        run('eat-next', PLACE_FRUIT),
        when('eat-bonus', cmp(modulo(v('eaten'), v('bonusEvery')), '=', num(0)), [
          run('eat-bonus-place', PLACE_BONUS),
        ]),
      ]),
      {
        fr: 'Miam : un point, un anneau de plus, un peu plus vite.',
        en: 'Yum: one point, one more ring, a bit faster.',
      },
    ),
    note(
      fn('eat-bonus', EAT_BONUS, [
        call('eb-sound', 'Sound', 'sndBonus', 'play'),
        change('eb-score', 'score', 5),
        run('eb-show', FN.score),
        change('eb-grow', 'grow', 2),
        set('eb-hide', 'Sprite', 'bonus', 'visible', bool(false)),
        setVar('eb-cell', 'bonusCell', num(-1)),
        call('eb-timer', 'Timer', 'bonusClock', 'stop'),
      ]),
      { fr: 'Le fruit doré vaut 5 points !', en: 'The golden fruit is worth 5 points!' },
    ),
    note(
      on('bonus-gone', 'Timer', 'bonusClock', 'tick', [
        set('bg-hide', 'Sprite', 'bonus', 'visible', bool(false)),
        setVar('bg-cell', 'bonusCell', num(-1)),
      ]),
      { fr: 'Trop tard : le fruit doré s’en va.', en: 'Too late: the golden fruit goes away.' },
    ),
    note(
      fn('crash', CRASH, [
        setVar('crash-state', 'state', str(STATE.lost)),
        call('crash-sound', 'Sound', 'sndCrash', 'play'),
        call('crash-shake', 'GameScene', scene, 'shake', num(0.4)),
        set('crash-face', 'Sprite', 'head', 'costume', num(2)),
        call('crash-timer', 'Timer', 'clock', 'stop'),
        call('crash-bonus', 'Timer', 'bonusClock', 'stop'),
        set('crash-pause', 'GameScene', scene, 'paused', bool(true)),
        wait('crash-wait', 0.8),
        run('crash-end', FN.end),
      ]),
      { fr: 'Aïe ! La partie est finie.', en: 'Ouch! The game is over.' },
    ),
  ]
}

const pad = (
  key: string,
  name: { fr: string; en: string },
  x: number,
  y: number,
  rotation: number,
) => sprite(key, name, { costumes: ['asset:arrow'], x, y, width: 72, height: 72, rotation })

export const WIGGLE_SNAKE: GameSource = {
  id: 'wiggle-snake',
  order: 23,
  mode: 'studio',
  icon: '🐍',
  accent: 'mint',
  title: { fr: 'Serpentin', en: 'Wiggle Snake' },
  description: {
    fr: 'Le serpent qui grandit à chaque fruit. Glisse, touche les flèches ou joue au clavier.',
    en: 'The snake that grows with each fruit. Swipe, tap the arrows or use the keyboard.',
  },
  theme: { primary: '#2f8f46', font: 'rounded' },
  variables: [
    ...KIT_VARIABLES,
    { key: 'pace', name: { fr: 'rythme', en: 'pace' }, initial: 0.2 },
    { key: 'fastest', name: { fr: 'rythmeMax', en: 'fastest' }, initial: 0.075 },
    { key: 'faster', name: { fr: 'accélération', en: 'speedUp' }, initial: 0.005 },
    { key: 'bonusEvery', name: { fr: 'bonusTous', en: 'bonusEvery' }, initial: 5 },
    { key: 'path', name: { fr: 'chemin', en: 'path' }, initial: [] },
    { key: 'size', name: { fr: 'taille', en: 'size' }, initial: 3 },
    { key: 'grow', name: { fr: 'croissance', en: 'growth' }, initial: 0 },
    { key: 'eaten', name: { fr: 'fruitsMangés', en: 'fruitsEaten' }, initial: 0 },
    { key: 'dirX', name: { fr: 'sensX', en: 'dirX' }, initial: 1 },
    { key: 'dirY', name: { fr: 'sensY', en: 'dirY' }, initial: 0 },
    { key: 'nextX', name: { fr: 'prochainX', en: 'nextX' }, initial: 1 },
    { key: 'nextY', name: { fr: 'prochainY', en: 'nextY' }, initial: 0 },
    { key: 'col', name: { fr: 'colonne', en: 'column' }, initial: 0 },
    { key: 'row', name: { fr: 'ligne', en: 'row' }, initial: 0 },
    { key: 'cell', name: { fr: 'case', en: 'cell' }, initial: 0 },
    { key: 'tail', name: { fr: 'queue', en: 'tail' }, initial: -1 },
    { key: 'spot', name: { fr: 'essai', en: 'spot' }, initial: 0 },
    { key: 'fruitCell', name: { fr: 'caseFruit', en: 'fruitCell' }, initial: -1 },
    { key: 'bonusCell', name: { fr: 'caseBonus', en: 'bonusCell' }, initial: -1 },
    { key: 'step', name: { fr: 'pas', en: 'step' }, initial: 0 },
    { key: 'n', name: { fr: 'n', en: 'n' }, initial: 0 },
    { key: 'dx', name: { fr: 'dx', en: 'dx' }, initial: 0 },
    { key: 'dy', name: { fr: 'dy', en: 'dy' }, initial: 0 },
  ],
  screen: { key: 'game', name: { fr: 'Jeu', en: 'Game' }, props: { padding: 0 } },
  components: [
    {
      key: scene,
      type: 'GameScene',
      name: { fr: 'Jardin', en: 'Garden' },
      props: { background: '#24543a', edges: 'pass', sceneHeight: 720 },
      children: [
        sprite(
          'board',
          { fr: 'Plateau', en: 'Board' },
          { costumes: ['asset:board'], x: 180, y: 310, width: 360, height: 480 },
        ),
        sprite(
          'fruit',
          { fr: 'Fruit', en: 'Fruit' },
          {
            costumes: ['asset:fruit', 'asset:fruit-squash'],
            x: 285,
            y: 325,
            width: 30,
            height: 30,
            visible: false,
          },
        ),
        sprite(
          'bonus',
          { fr: 'FruitDoré', en: 'GoldenFruit' },
          {
            costumes: ['asset:bonus', 'asset:bonus-dim'],
            x: 75,
            y: 145,
            width: 32,
            height: 32,
            visible: false,
          },
        ),
        sprite(
          'ring',
          { fr: 'Anneau', en: 'Ring' },
          {
            costumes: ['asset:ring-light', 'asset:ring-dark'],
            x: -100,
            y: -100,
            width: 28,
            height: 28,
            collision: 'box',
          },
        ),
        sprite(
          'eraser',
          { fr: 'Gomme', en: 'Eraser' },
          {
            costumes: ['asset:ring-light'],
            x: -100,
            y: -100,
            width: 16,
            height: 16,
            opacity: 0,
            collision: 'box',
          },
        ),
        sprite(
          'head',
          { fr: 'Tête', en: 'Head' },
          {
            costumes: ['asset:head', 'asset:head-hurt'],
            x: 165,
            y: 325,
            width: 32,
            height: 32,
            visible: false,
          },
        ),
        pad('padUp', { fr: 'FlècheHaut', en: 'UpArrow' }, 180, 592, 0),
        pad('padLeft', { fr: 'FlècheGauche', en: 'LeftArrow' }, 92, 636, -90),
        pad('padRight', { fr: 'FlècheDroite', en: 'RightArrow' }, 268, 636, 90),
        pad('padDown', { fr: 'FlècheBas', en: 'DownArrow' }, 180, 680, 180),
        ...kitComponents(KIT),
      ],
    },
    {
      key: 'clock',
      type: 'Timer',
      name: { fr: 'Rythme', en: 'Pace' },
      props: { interval: 0.2, repeat: true, autostart: false },
    },
    {
      key: 'bonusClock',
      type: 'Timer',
      name: { fr: 'MinuteurBonus', en: 'BonusTimer' },
      props: { interval: 6, repeat: false, autostart: false },
    },
    {
      key: 'sndEat',
      type: 'Sound',
      name: { fr: 'SonMiam', en: 'EatSound' },
      props: { src: 'asset:eat' },
    },
    {
      key: 'sndBonus',
      type: 'Sound',
      name: { fr: 'SonBonus', en: 'BonusSound' },
      props: { src: 'asset:bonus-sound' },
    },
    {
      key: 'sndCrash',
      type: 'Sound',
      name: { fr: 'SonChoc', en: 'BumpSound' },
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
            board: { fr: 'plateau', en: 'board' },
            head: { fr: 'tête du serpent', en: 'snake head' },
            'head-hurt': { fr: 'tête sonnée', en: 'dizzy head' },
            'ring-light': { fr: 'anneau clair', en: 'light ring' },
            'ring-dark': { fr: 'anneau foncé', en: 'dark ring' },
            fruit: { fr: 'fruit', en: 'fruit' },
            'fruit-squash': { fr: 'fruit écrasé', en: 'squashed fruit' },
            bonus: { fr: 'fruit doré', en: 'golden fruit' },
            'bonus-dim': { fr: 'fruit doré sans éclat', en: 'dim golden fruit' },
            arrow: { fr: 'flèche', en: 'arrow' },
          }[key] ?? { fr: key, en: key },
          svg: file,
        },
      ]),
    ),
    ...kitArt(KIT),
  },
  sounds: {
    eat: {
      name: { fr: 'miam', en: 'yum' },
      wav: wav([
        { wave: 'square', from: 440, to: 880, seconds: 0.08, volume: 0.4, duty: 0.3 },
        { wave: 'square', from: 660, to: 1320, seconds: 0.08, at: 0.06, volume: 0.35, duty: 0.3 },
      ]),
    },
    'bonus-sound': { name: { fr: 'bonus', en: 'bonus' }, wav: COMMON_SOUNDS.powerUp() },
    crash: { name: { fr: 'choc', en: 'bump' }, wav: COMMON_SOUNDS.hurt() },
    ...kitSounds(),
  },
  cover: cover(),
}
