import {
  type Block,
  bool,
  call,
  change,
  cmp,
  count,
  fn,
  join,
  math,
  note,
  num,
  on,
  open,
  prop,
  random,
  run,
  set,
  setVar,
  str,
  v,
  when,
} from './dsl.ts'
import { POP, TADA } from './sounds.ts'
import type { AppSource, ComponentSource, LevelSource, TourStepSource } from './types.ts'

/**
 * Casse-briques (Brick Breaker). Level 1: a paddle and a bouncing ball. Level 2: a wall of
 * bricks built by two nested loops, bricks that disappear. Level 3: score and lives.
 * Level 4: difficulty levels and a bonus.
 */

const SERVE = { fr: 'lancer la balle', en: 'serve the ball' }
const WALL = { fr: 'construire le mur', en: 'build the wall' }
const NEW = { fr: 'nouvelle partie', en: 'new game' }
const SHOW = { fr: 'afficher le score', en: 'show the score' }
const STOP = { fr: 'arrêter la balle', en: 'stop the ball' }

const AGAIN = { fr: ' Touche ici pour rejouer.', en: ' Tap here to play again.' }

function components(n: number): ComponentSource[] {
  const children: ComponentSource[] = [
    {
      key: 'ball',
      type: 'Sprite',
      name: { fr: 'Balle', en: 'Ball' },
      props: { costumes: ['⚽'], x: 180, y: 360, width: 32, height: 32, collision: 'circle' },
    },
    {
      key: 'paddle',
      type: 'Sprite',
      name: { fr: 'Raquette', en: 'Paddle' },
      props: {
        costumes: ['🛹'],
        x: 180,
        y: 580,
        width: 90,
        height: 44,
        draggable: true,
        edges: 'stop',
      },
    },
  ]
  if (n >= 2)
    children.push({
      key: 'brick',
      type: 'Sprite',
      name: { fr: 'Brique', en: 'Brick' },
      props: { costumes: ['🧱'], x: 45, y: 100, width: 40, height: 36, visible: false },
    })
  if (n >= 3)
    children.push(
      {
        key: 'scoreText',
        type: 'SceneText',
        name: { fr: 'TexteScore', en: 'ScoreText' },
        props: {
          text: { fr: 'Score : 0', en: 'Score: 0' },
          x: 16,
          y: 30,
          align: 'left',
          color: '#ffffff',
          fontSize: 22,
        },
      },
      {
        key: 'livesText',
        type: 'SceneText',
        name: { fr: 'TexteVies', en: 'LivesText' },
        props: { text: '❤️ 3', x: 344, y: 30, align: 'right', color: '#ffffff', fontSize: 22 },
      },
      {
        key: 'message',
        type: 'SceneText',
        name: { fr: 'Message', en: 'Message' },
        props: {
          text: '',
          x: 180,
          y: 440,
          color: '#ffe066',
          fontSize: 22,
          visible: false,
        },
      },
    )
  if (n >= 4)
    children.push({
      key: 'bonus',
      type: 'Sprite',
      name: { fr: 'Bonus', en: 'Bonus' },
      props: { costumes: ['💖'], x: 180, y: -30, width: 36, height: 36, visible: false },
    })
  return [
    {
      key: 'field',
      type: 'GameScene',
      name: { fr: 'Terrain', en: 'Field' },
      props: { background: '#14213d', edges: 'bounce' },
      children,
    },
    ...(n >= 4
      ? [
          {
            key: 'gift',
            type: 'Timer',
            name: { fr: 'Cadeau', en: 'Gift' },
            props: { interval: 6, repeat: true, autostart: false },
          },
          {
            key: 'pop',
            type: 'Sound',
            name: { fr: 'SonBrique', en: 'BrickSound' },
            props: { src: POP },
          },
          {
            key: 'tada',
            type: 'Sound',
            name: { fr: 'SonGagne', en: 'WinSound' },
            props: { src: TADA },
          },
        ]
      : []),
  ]
}

const message = (id: string, text: { fr: string; en: string }) => [
  set(
    `${id}-text`,
    'SceneText',
    'message',
    'text',
    str({ fr: text.fr + AGAIN.fr, en: text.en + AGAIN.en }),
  ),
  set(`${id}-message`, 'SceneText', 'message', 'visible', bool(true)),
  run(`${id}-stop`, STOP),
]

function gameBlocks(n: number): Block[] {
  const stacks: Block[] = []
  const serve = run('start-serve', SERVE)
  const wall = run('start-wall', WALL)

  if (n <= 2) {
    stacks.push(
      note(on('start', 'GameScene', 'field', 'start', [...(n >= 2 ? [wall] : []), serve]), {
        fr: n >= 2 ? 'Au départ : le mur, puis la balle.' : 'Au départ, on lance la balle.',
        en: n >= 2 ? 'At the start: the wall, then the ball.' : 'At the start, we serve the ball.',
      }),
    )
  } else {
    stacks.push(
      note(on('start', 'GameScene', 'field', 'start', [run('start-new', NEW)]), {
        fr: 'Au départ, une nouvelle partie.',
        en: 'At the start, a new game.',
      }),
      note(
        fn('new', NEW, [
          call('new-clear', 'GameScene', 'field', 'deleteClones'),
          setVar('new-score', 'score', num(0)),
          setVar('new-lives', 'lives', num(3)),
          setVar('new-bricks', 'bricks', num(0)),
          set('new-hide', 'SceneText', 'message', 'visible', bool(false)),
          ...(n >= 4
            ? [
                set('new-gift-pace', 'Timer', 'gift', 'interval', num(6)),
                call('new-gift', 'Timer', 'gift', 'start'),
              ]
            : []),
          wall,
          run('new-show', SHOW),
          serve,
        ]),
        {
          fr: 'Tout remettre à zéro, construire le mur, lancer la balle.',
          en: 'Reset everything, build the wall, serve the ball.',
        },
      ),
      note(
        fn('show', SHOW, [
          set(
            'show-score',
            'SceneText',
            'scoreText',
            'text',
            join(str({ fr: 'Score : ', en: 'Score: ' }), v('score')),
          ),
          set('show-lives', 'SceneText', 'livesText', 'text', join(str('❤️ '), v('lives'))),
        ]),
        { fr: 'Écrit le score et les vies.', en: 'Writes the score and the lives.' },
      ),
    )
  }

  stacks.push(
    note(
      fn('serve', SERVE, [
        call('serve-place', 'Sprite', 'ball', 'goTo', num(180), num(360)),
        ...(n >= 3 ? [set('serve-show', 'Sprite', 'ball', 'visible', bool(true))] : []),
        note(set('serve-vx', 'Sprite', 'ball', 'vx', random(-150, 150)), {
          fr: 'Un peu à gauche ou à droite, au hasard.',
          en: 'A little left or right, at random.',
        }),
        note(set('serve-vy', 'Sprite', 'ball', 'vy', n >= 4 ? v('speed') : num(260)), {
          fr: 'Vers le bas : y grandit.',
          en: 'Downwards: y grows.',
        }),
      ]),
      {
        fr: 'Remet la balle au milieu et la lance.',
        en: 'Puts the ball in the middle and serves it.',
      },
    ),
    note(
      on(
        'bounce',
        'Sprite',
        'ball',
        'hit',
        [
          note(
            set(
              'bounce-vy',
              'Sprite',
              'ball',
              'vy',
              n >= 4 ? math(num(0), '-', v('speed')) : num(-300),
            ),
            { fr: 'Repart vers le haut.', en: 'Goes back up.' },
          ),
          note(
            set(
              'bounce-vx',
              'Sprite',
              'ball',
              'vx',
              math(
                math(prop('Sprite', 'ball', 'x'), '-', prop('Sprite', 'paddle', 'x')),
                '×',
                num(5),
              ),
            ),
            {
              fr: 'Touchée sur le côté : elle part de côté.',
              en: 'Hit on the side: it goes sideways.',
            },
          ),
        ],
        'paddle',
      ),
      { fr: 'La balle rebondit sur la raquette.', en: 'The ball bounces off the paddle.' },
    ),
  )

  const lost: Block[] =
    n >= 3
      ? [
          change('lost-lives', 'lives', -1),
          run('lost-show', SHOW),
          when(
            'lost-test',
            cmp(v('lives'), '≤', num(0)),
            [
              ...message('lost', { fr: 'Perdu !', en: 'Game over!' }),
              ...(n >= 4 ? [call('lost-gift', 'Timer', 'gift', 'stop')] : []),
            ],
            [run('lost-serve', SERVE)],
          ),
        ]
      : [run('lost-serve', SERVE)]
  stacks.push(
    note(
      on('lost', 'Sprite', 'ball', 'edge', lost, 'bottom'),
      n >= 3
        ? { fr: 'Ratée : une vie en moins.', en: 'Missed: one life less.' }
        : { fr: 'Ratée : on relance.', en: 'Missed: serve again.' },
    ),
    note(
      on('follow', 'Sprite', 'paddle', 'drag', [
        set('follow-ground', 'Sprite', 'paddle', 'y', num(580)),
      ]),
      {
        fr: 'La raquette suit ton doigt, en restant en bas.',
        en: 'The paddle follows your finger, staying at the bottom.',
      },
    ),
  )

  if (n >= 2) {
    stacks.push(
      note(
        fn('wall', WALL, [
          note(
            count('wall-rows', 'row', 1, 4, 1, [
              note(
                count('wall-cols', 'col', 1, 7, 1, [
                  call(
                    'wall-place',
                    'Sprite',
                    'brick',
                    'goTo',
                    math(v('col'), '×', num(45)),
                    math(num(60), '+', math(v('row'), '×', num(40))),
                  ),
                  call('wall-clone', 'Sprite', 'brick', 'clone'),
                  ...(n >= 3 ? [change('wall-count', 'bricks', 1)] : []),
                ]),
                {
                  fr: 'Pour chaque rangée, 7 colonnes : 4 × 7 = 28 briques.',
                  en: 'For each row, 7 columns: 4 × 7 = 28 bricks.',
                },
                260,
              ),
            ]),
            { fr: 'Une boucle dans une boucle !', en: 'A loop inside a loop!' },
          ),
        ]),
        {
          fr: 'Place la brique cachée, puis la copie.',
          en: 'Moves the hidden brick, then copies it.',
        },
      ),
      note(
        on('appear', 'Sprite', 'brick', 'clone', [
          set('appear-show', 'Sprite', 'brick', 'visible', bool(true)),
        ]),
        {
          fr: 'Chaque copie se montre.',
          en: 'Each copy shows itself.',
        },
      ),
      note(
        on(
          'break',
          'Sprite',
          'brick',
          'hit',
          [
            call('break-delete', 'Sprite', 'brick', 'delete'),
            note(
              set(
                'break-bounce',
                'Sprite',
                'ball',
                'vy',
                math(num(0), '-', prop('Sprite', 'ball', 'vy')),
              ),
              {
                fr: '0 − vitesse : elle repart dans l’autre sens.',
                en: '0 − speed: it goes the other way.',
              },
            ),
            ...(n >= 3
              ? [
                  change('break-score', 'score', 10),
                  change('break-count', 'bricks', -1),
                  run('break-show', SHOW),
                  ...(n >= 4 ? [call('break-sound', 'Sound', 'pop', 'play')] : []),
                  note(
                    when('break-win', cmp(v('bricks'), '≤', num(0)), [
                      ...message('win', { fr: 'Gagné !', en: 'You win!' }),
                      ...(n >= 4
                        ? [
                            call('win-gift', 'Timer', 'gift', 'stop'),
                            call('win-sound', 'Sound', 'tada', 'play'),
                          ]
                        : []),
                    ]),
                    { fr: 'Plus de briques : gagné !', en: 'No bricks left: you win!' },
                  ),
                ]
              : []),
          ],
          'ball',
        ),
        {
          fr: 'Ici, « Brique » est la brique touchée.',
          en: 'Here, “Brick” is the brick that was hit.',
        },
      ),
    )
  }

  if (n >= 3) {
    stacks.push(
      note(
        fn('stop', STOP, [
          set('stop-vx', 'Sprite', 'ball', 'vx', num(0)),
          set('stop-vy', 'Sprite', 'ball', 'vy', num(0)),
          set('stop-hide', 'Sprite', 'ball', 'visible', bool(false)),
        ]),
        { fr: 'Fin de partie : la balle s’arrête.', en: 'End of the game: the ball stops.' },
      ),
      note(on('retry', 'SceneText', 'message', 'tap', [run('retry-new', NEW)]), {
        fr: 'Toucher le message : on rejoue.',
        en: 'Tap the message: play again.',
      }),
    )
  }

  if (n >= 4) {
    stacks.push(
      note(
        on('gift-tick', 'Timer', 'gift', 'tick', [call('gift-drop', 'Sprite', 'bonus', 'clone')]),
        {
          fr: 'De temps en temps, un cœur bonus tombe.',
          en: 'Now and then, a bonus heart falls.',
        },
      ),
      on('gift-appear', 'Sprite', 'bonus', 'clone', [
        call('gift-place', 'Sprite', 'bonus', 'goTo', random(30, 330), num(-20)),
        set('gift-show', 'Sprite', 'bonus', 'visible', bool(true)),
        set('gift-speed', 'Sprite', 'bonus', 'vy', num(140)),
      ]),
      note(
        on(
          'gift-catch',
          'Sprite',
          'bonus',
          'hit',
          [
            change('gift-life', 'lives', 1),
            run('gift-show-score', SHOW),
            call('gift-delete', 'Sprite', 'bonus', 'delete'),
          ],
          'paddle',
        ),
        { fr: 'Attrapé : une vie de plus !', en: 'Caught: one more life!' },
      ),
    )
  }
  return stacks
}

function menu(): LevelSource['screens'][number] {
  const levels = [
    { key: 'easy', name: { fr: 'Facile', en: 'Easy' }, emoji: '🐢', speed: 220 },
    { key: 'medium', name: { fr: 'Moyen', en: 'Medium' }, emoji: '🐇', speed: 300 },
    { key: 'hard', name: { fr: 'Difficile', en: 'Hard' }, emoji: '🚀', speed: 380 },
  ]
  return {
    key: 'menu',
    name: { fr: 'Menu', en: 'Menu' },
    props: {
      padding: 24,
      gap: 16,
      alignItems: 'stretch',
      justify: 'center',
      background: '#14213d',
    },
    components: [
      {
        key: 'title',
        type: 'Text',
        name: { fr: 'Titre', en: 'Title' },
        props: {
          text: { fr: '🧱 Casse-briques', en: '🧱 Brick Breaker' },
          fontSize: 32,
          bold: true,
          color: '#ffe066',
          align: 'center',
        },
      },
      {
        key: 'choose',
        type: 'Text',
        name: { fr: 'Choisis', en: 'Choose' },
        props: {
          text: { fr: 'Choisis ta vitesse :', en: 'Choose your speed:' },
          color: '#ffffff',
          align: 'center',
        },
      },
      ...levels.map((level) => ({
        key: level.key,
        type: 'Button',
        name: level.name,
        props: {
          text: { fr: `${level.emoji} ${level.name.fr}`, en: `${level.emoji} ${level.name.en}` },
        },
      })),
    ],
    blocks: levels.map((level) =>
      note(
        on(level.key, 'Button', level.key, 'click', [
          setVar(`${level.key}-speed`, 'speed', num(level.speed)),
          open(`${level.key}-open`, 'game'),
        ]),
        level.key === 'easy'
          ? { fr: 'Choisir la vitesse, puis jouer.', en: 'Choose the speed, then play.' }
          : { fr: `Vitesse ${level.speed}.`, en: `Speed ${level.speed}.` },
      ),
    ),
  }
}

function level(n: 1 | 2 | 3 | 4): LevelSource {
  const game = {
    key: 'game',
    name: { fr: 'Jeu', en: 'Game' },
    props: { padding: 0 },
    components: components(n),
    blocks: gameBlocks(n),
  }
  return {
    title: TITLES[n],
    summary: SUMMARIES[n],
    done: DONE[n],
    theme: { primary: '#e8590c', font: 'rounded' },
    variables: [
      ...(n >= 3
        ? [
            { key: 'score', name: { fr: 'score', en: 'score' }, initial: 0 },
            { key: 'lives', name: { fr: 'vies', en: 'lives' }, initial: 3 },
            { key: 'bricks', name: { fr: 'briques', en: 'bricks' }, initial: 0 },
          ]
        : []),
      ...(n >= 2
        ? [
            { key: 'row', name: { fr: 'rangée', en: 'row' }, initial: 1 },
            { key: 'col', name: { fr: 'colonne', en: 'column' }, initial: 1 },
          ]
        : []),
      ...(n >= 4 ? [{ key: 'speed', name: { fr: 'vitesse', en: 'speed' }, initial: 300 }] : []),
    ],
    screens: n >= 4 ? [menu(), game] : [game],
    tour: TOURS[n],
    challenges: CHALLENGES[n],
  }
}

const TITLES = {
  1: { fr: 'La balle rebondit', en: 'The ball bounces' },
  2: { fr: 'Le mur de briques', en: 'The brick wall' },
  3: { fr: 'Score et vies', en: 'Score and lives' },
  4: { fr: 'Vitesses et bonus', en: 'Speeds and a bonus' },
}
const SUMMARIES = {
  1: {
    fr: 'Une raquette et une balle qui rebondit partout. La vitesse dit où va la balle.',
    en: 'A paddle and a ball bouncing everywhere. Speed tells where the ball goes.',
  },
  2: {
    fr: 'Deux boucles, l’une dans l’autre, construisent un mur de 28 briques.',
    en: 'Two loops, one inside the other, build a wall of 28 bricks.',
  },
  3: {
    fr: 'Des points par brique, trois vies, « gagné » et « perdu ».',
    en: 'Points per brick, three lives, “you win” and “game over”.',
  },
  4: {
    fr: 'Un menu pour choisir sa vitesse, et un cœur bonus qui tombe.',
    en: 'A menu to choose your speed, and a bonus heart that falls.',
  },
}
const DONE = {
  1: {
    fr: 'Tu sais comment la balle bouge et rebondit.',
    en: 'You know how the ball moves and bounces.',
  },
  2: {
    fr: 'Tu as vu deux boucles imbriquées et des clones.',
    en: 'You saw two nested loops and clones.',
  },
  3: {
    fr: 'Tu as vu des variables, un « si … sinon » et une fonction de fin.',
    en: 'You saw variables, an “if … else” and an end function.',
  },
  4: {
    fr: 'Tu as vu un menu sur un autre écran, une variable de vitesse et un bonus.',
    en: 'You saw a menu on another screen, a speed variable and a bonus.',
  },
}

const slow = (block: string, watch: { fr: string; en: string }): TourStepSource[] => [
  {
    id: 'slow',
    target: 'slow-motion',
    check: { kind: 'slowMotion' },
    text: {
      fr: 'Lance le **ralenti** pour voir les blocs s’allumer.',
      en: 'Start **slow motion** to see the blocks light up.',
    },
  },
  {
    id: 'watch',
    target: `block:${block}`,
    check: { kind: 'stepped', id: block },
    mood: 'think',
    text: watch,
    hint: {
      fr: 'Attends un peu, ou clique sur « Redémarrer » dans l’aperçu.',
      en: 'Wait a little, or click “Restart” in the preview.',
    },
  },
  {
    id: 'fast',
    target: 'slow-motion',
    check: { kind: 'not', of: { kind: 'slowMotion' } },
    text: {
      fr: 'Arrête le ralenti pour jouer à vitesse normale.',
      en: 'Stop slow motion to play at normal speed.',
    },
  },
]

const TOURS: Record<1 | 2 | 3 | 4, TourStepSource[]> = {
  1: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Voici le **Casse-briques** ! Glisse la raquette dans l’aperçu pour renvoyer la balle.',
        en: 'Here is **Brick Breaker**! Drag the paddle in the preview to send the ball back.',
      },
    },
    {
      id: 'serve',
      target: 'block:serve',
      text: {
        fr: 'Un lutin a une **vitesse x** (vers la droite) et une **vitesse y** (vers le bas). La fonction donne les deux à la balle.',
        en: 'A sprite has an **x speed** (to the right) and a **y speed** (downwards). The function gives both to the ball.',
      },
    },
    {
      id: 'bounce',
      target: 'block:bounce',
      text: {
        fr: 'Quand la balle touche la raquette, sa vitesse y devient négative : elle remonte.',
        en: 'When the ball touches the paddle, its y speed becomes negative: it goes back up.',
      },
    },
    {
      id: 'side',
      target: 'block:bounce-vx',
      text: {
        fr: 'Ce calcul compare les x de la balle et de la raquette : touchée à droite, elle part à droite.',
        en: 'This calculation compares the x of the ball and the paddle: hit on the right, it goes right.',
      },
    },
    {
      id: 'lost',
      target: 'block:lost',
      text: {
        fr: 'Les bords de la scène font rebondir. Si la balle touche le bas, on la relance.',
        en: 'The edges of the scene make things bounce. If the ball touches the bottom, we serve again.',
      },
    },
    ...slow('bounce-vy', {
      fr: 'Renvoie la balle avec la raquette : [mettre vitesse y à -300] s’allume.',
      en: 'Send the ball back with the paddle: [set y speed to -300] lights up.',
    }),
  ],
  2: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 2, un mur de briques ! Clique sur **Nouveau** au-dessus des blocs pour voir ce qui a changé.',
        en: 'In level 2, a brick wall! Click **New** above the blocks to see what changed.',
      },
    },
    {
      id: 'wall',
      target: 'block:wall',
      text: {
        fr: 'Une **boucle** répète des blocs. Ici, il y en a deux : pour chaque rangée (1 à 4), on fait 7 colonnes.',
        en: 'A **loop** repeats blocks. Here there are two: for each row (1 to 4), we make 7 columns.',
      },
    },
    {
      id: 'place',
      target: 'block:wall-place',
      text: {
        fr: 'La position vient des compteurs : x = colonne × 45, y = 60 + rangée × 40. Puis on crée un clone à cet endroit.',
        en: 'The position comes from the counters: x = column × 45, y = 60 + row × 40. Then we create a clone there.',
      },
    },
    {
      id: 'break',
      target: 'block:break',
      text: {
        fr: 'Une brique touchée par la balle est supprimée, et la balle repart dans l’autre sens.',
        en: 'A brick hit by the ball is deleted, and the ball goes the other way.',
      },
    },
    ...slow('wall-clone', {
      fr: 'Regarde : [créer un clone de Brique] s’allume 28 fois, une brique à la fois.',
      en: 'Look: [create a clone of Brick] lights up 28 times, one brick at a time.',
    }),
  ],
  3: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 3 : des points, des vies, et des messages « Gagné » ou « Perdu ».',
        en: 'In level 3: points, lives, and “You win” or “Game over” messages.',
      },
    },
    {
      id: 'new',
      target: 'block:new',
      text: {
        fr: 'Les blocs du départ sont rangés dans la fonction « nouvelle partie » : elle sert au départ et pour rejouer.',
        en: 'The starting blocks are now in the function “new game”: it is used at the start and to play again.',
      },
    },
    {
      id: 'count',
      target: 'block:wall-count',
      text: {
        fr: 'La variable **briques** compte les briques construites…',
        en: 'The **bricks** variable counts the bricks that are built…',
      },
    },
    {
      id: 'win',
      target: 'block:break-win',
      text: {
        fr: '… et on en enlève une à chaque brique cassée. À 0, c’est gagné !',
        en: '… and we take one away for each broken brick. At 0, you win!',
      },
    },
    {
      id: 'lost',
      target: 'block:lost-test',
      text: {
        fr: '[si … sinon] : s’il ne reste plus de vies, c’est perdu ; sinon, on relance la balle.',
        en: '[if … else]: if there are no lives left, the game is over; else, we serve again.',
      },
    },
    ...slow('lost-lives', {
      fr: 'Laisse tomber la balle : [modifier vies de -1] s’allume.',
      en: 'Let the ball fall: [change lives by -1] lights up.',
    }),
  ],
  4: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 4, un écran **Menu** pour choisir la vitesse, et des cœurs bonus.',
        en: 'In level 4, a **Menu** screen to choose the speed, and bonus hearts.',
      },
    },
    {
      id: 'menu',
      target: 'screen-picker',
      text: {
        fr: 'Choisis l’écran **Menu** : chaque bouton met la variable **vitesse**, puis ouvre le jeu. Reviens ensuite sur **Jeu**.',
        en: 'Pick the **Menu** screen: each button sets the **speed** variable, then opens the game. Then come back to **Game**.',
      },
    },
    {
      id: 'speed',
      target: 'block:serve-vy',
      text: {
        fr: 'La balle prend la vitesse choisie dans le menu, au lieu de 260.',
        en: 'The ball takes the speed chosen in the menu, instead of 260.',
      },
    },
    {
      id: 'gift',
      target: 'block:gift-tick',
      text: {
        fr: 'Le minuteur **Cadeau** fait tomber un cœur bonus toutes les 6 secondes.',
        en: 'The **Gift** timer drops a bonus heart every 6 seconds.',
      },
    },
    {
      id: 'catch',
      target: 'block:gift-catch',
      text: {
        fr: 'Attrape-le avec la raquette : une vie de plus !',
        en: 'Catch it with the paddle: one more life!',
      },
    },
    ...slow('gift-drop', {
      fr: 'Attends le cœur : [créer un clone de Bonus] s’allume.',
      en: 'Wait for the heart: [create a clone of Bonus] lights up.',
    }),
  ],
}

const CHALLENGES = {
  1: [
    {
      id: 'faster',
      block: 'serve-vy',
      check: { kind: 'blockField', id: 'serve-vy/value', field: 'NUM', min: 350 },
      text: {
        fr: 'Lance la balle plus vite : 350 ou plus.',
        en: 'Serve the ball faster: 350 or more.',
      },
      hint: {
        fr: 'Change le 260 dans « lancer la balle ».',
        en: 'Change the 260 in “serve the ball”.',
      },
    },
    {
      id: 'strong',
      block: 'bounce-vy',
      check: { kind: 'blockField', id: 'bounce-vy/value', field: 'NUM', max: -400 },
      text: {
        fr: 'Rebond plus fort : -400 au lieu de -300.',
        en: 'Stronger bounce: -400 instead of -300.',
      },
      hint: {
        fr: 'Garde le signe moins : il fait remonter la balle.',
        en: 'Keep the minus sign: it sends the ball up.',
      },
    },
    {
      id: 'spin',
      block: 'bounce',
      check: { kind: 'block', type: 'rx_Sprite_call_turn', within: 'bounce' },
      text: {
        fr: 'Fais tourner la balle quand elle touche la raquette.',
        en: 'Make the ball turn when it touches the paddle.',
      },
      hint: {
        fr: 'Prends [tourner … de … degrés] chez Balle.',
        en: 'Take [turn … by … degrees] from Ball.',
      },
    },
  ],
  2: [
    {
      id: 'rows',
      block: 'wall-rows',
      check: { kind: 'blockField', id: 'wall-rows/to', field: 'NUM', equals: 5 },
      text: { fr: 'Construis 5 rangées au lieu de 4.', en: 'Build 5 rows instead of 4.' },
      hint: {
        fr: 'C’est la boucle du dehors : « de 1 à 4 ».',
        en: 'It is the outer loop: “from 1 to 4”.',
      },
    },
    {
      id: 'cols',
      block: 'wall-cols',
      check: { kind: 'blockField', id: 'wall-cols/to', field: 'NUM', equals: 6 },
      text: { fr: 'Fais 6 colonnes au lieu de 7.', en: 'Make 6 columns instead of 7.' },
      hint: { fr: 'C’est la boucle du dedans.', en: 'It is the inner loop.' },
    },
    {
      id: 'spin',
      block: 'break',
      check: { kind: 'block', type: 'rx_Sprite_call_turn', within: 'break' },
      text: {
        fr: 'Fais tourner la balle quand elle casse une brique.',
        en: 'Make the ball turn when it breaks a brick.',
      },
      hint: {
        fr: 'Pose [tourner Balle de … degrés] dans « quand Brique touche Balle ».',
        en: 'Put [turn Ball by … degrees] in “when Brick touches Ball”.',
      },
    },
  ],
  3: [
    {
      id: 'five',
      block: 'new-lives',
      check: { kind: 'blockField', id: 'new-lives/value', field: 'NUM', equals: 5 },
      text: { fr: 'Commence avec 5 vies.', en: 'Start with 5 lives.' },
      hint: { fr: 'C’est dans « nouvelle partie ».', en: 'It is in “new game”.' },
    },
    {
      id: 'points',
      block: 'break-score',
      check: { kind: 'blockField', id: 'break-score/delta', field: 'NUM', equals: 20 },
      text: { fr: 'Donne 20 points par brique.', en: 'Give 20 points per brick.' },
      hint: { fr: 'Regarde [modifier score de 10].', en: 'Look at [change score by 10].' },
    },
    {
      id: 'toast',
      block: 'break-win',
      check: { kind: 'block', type: 'rx_ui_toast', within: 'break-win' },
      text: {
        fr: 'Affiche un message bref quand c’est gagné.',
        en: 'Show a short message when you win.',
      },
      hint: {
        fr: 'Le bloc est dans la catégorie Interface.',
        en: 'The block is in the Interface category.',
      },
    },
  ],
  4: [
    {
      id: 'easy',
      block: 'easy-speed',
      check: { kind: 'blockField', id: 'easy-speed/value', field: 'NUM', max: 180 },
      text: {
        fr: 'Rends « Facile » encore plus facile : 180 ou moins.',
        en: 'Make “Easy” even easier: 180 or less.',
      },
      hint: { fr: 'C’est sur l’écran Menu.', en: 'It is on the Menu screen.' },
    },
    {
      id: 'often',
      block: 'new-gift-pace',
      check: { kind: 'blockField', id: 'new-gift-pace/value', field: 'NUM', max: 4 },
      text: {
        fr: 'Fais tomber un bonus toutes les 4 secondes.',
        en: 'Drop a bonus every 4 seconds.',
      },
      hint: {
        fr: 'C’est l’intervalle de Cadeau, dans « nouvelle partie ».',
        en: 'It is the interval of Gift, in “new game”.',
      },
    },
    {
      id: 'grow',
      block: 'gift-catch',
      check: {
        kind: 'block',
        type: 'rx_Sprite_set',
        fields: { PROP: 'width' },
        within: 'gift-catch',
      },
      text: {
        fr: 'Le bonus fait aussi grandir la raquette.',
        en: 'The bonus also makes the paddle wider.',
      },
      hint: {
        fr: 'Mets la largeur de Raquette à 130 quand on attrape le bonus.',
        en: 'Set the width of Paddle to 130 when the bonus is caught.',
      },
    },
  ],
}

export const brickBreaker: AppSource = {
  id: 'brick-breaker',
  order: 2,
  kind: 'game',
  icon: '🧱',
  accent: 'coral',
  title: { fr: 'Casse-briques', en: 'Brick Breaker' },
  summary: {
    fr: 'Un jeu : renvoie la balle avec ta raquette et casse toutes les briques.',
    en: 'A game: send the ball back with your paddle and break all the bricks.',
  },
  level,
}
