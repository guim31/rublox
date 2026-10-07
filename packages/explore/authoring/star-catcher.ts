import {
  type Block,
  bool,
  call,
  change,
  cmp,
  fn,
  join,
  math,
  note,
  num,
  on,
  open,
  random,
  run,
  set,
  setVar,
  str,
  v,
  when,
} from './dsl.ts'
import { OOPS, POP } from './sounds.ts'
import type { AppSource, ComponentSource, LevelSource } from './types.ts'

/**
 * Attrape-étoiles (Star Catcher): a basket catches falling stars. Level 1: one star falls and
 * the basket follows the finger. Level 2: a rain of stars (clones, a timer, chance) and a
 * score. Level 3: lives, game over and an end screen. Level 4: faster and faster, the best
 * score kept on the phone, sounds.
 */

const DROP = { fr: 'faire tomber une étoile', en: 'make a star fall' }
const SHOW = { fr: 'afficher le score', en: 'show the score' }
const CHECK = { fr: 'vérifier si c’est perdu', en: 'check if the game is lost' }

const SCORE = { fr: 'Score : ', en: 'Score: ' }

function components(n: number): ComponentSource[] {
  const scene: ComponentSource = {
    key: 'sky',
    type: 'GameScene',
    name: { fr: 'Ciel', en: 'Sky' },
    props: { background: '#1b1f4b', edges: 'pass' },
    children: [
      {
        key: 'moon',
        type: 'Sprite',
        name: { fr: 'Lune', en: 'Moon' },
        props: { costumes: ['🌙'], x: 300, y: 130, width: 72, height: 72, collision: 'none' },
      },
      {
        key: 'star',
        type: 'Sprite',
        name: { fr: 'Etoile', en: 'Star' },
        props: {
          costumes: ['⭐'],
          x: 180,
          y: -40,
          width: 56,
          height: 56,
          collision: 'circle',
          visible: false,
        },
      },
      {
        key: 'basket',
        type: 'Sprite',
        name: { fr: 'Panier', en: 'Basket' },
        props: {
          costumes: ['🧺'],
          x: 180,
          y: 590,
          width: 96,
          height: 72,
          draggable: true,
          edges: 'stop',
        },
      },
      ...(n >= 2
        ? [
            {
              key: 'scoreText',
              type: 'SceneText',
              name: { fr: 'TexteScore', en: 'ScoreText' },
              props: {
                text: { fr: 'Score : 0', en: 'Score: 0' },
                x: 20,
                y: 40,
                align: 'left',
                color: '#ffffff',
              },
            },
          ]
        : []),
      ...(n >= 3
        ? [
            {
              key: 'livesText',
              type: 'SceneText',
              name: { fr: 'TexteVies', en: 'LivesText' },
              props: { text: '❤️ 3', x: 340, y: 40, align: 'right', color: '#ffffff' },
            },
          ]
        : []),
    ],
  }
  return [
    scene,
    ...(n >= 2
      ? [
          {
            key: 'rain',
            type: 'Timer',
            name: { fr: 'Pluie', en: 'Rain' },
            props: { interval: 1, repeat: true, autostart: false },
          },
        ]
      : []),
    ...(n >= 4
      ? [
          {
            key: 'pop',
            type: 'Sound',
            name: { fr: 'SonAttrape', en: 'CatchSound' },
            props: { src: POP },
          },
          {
            key: 'oops',
            type: 'Sound',
            name: { fr: 'SonRate', en: 'MissSound' },
            props: { src: OOPS },
          },
        ]
      : []),
  ]
}

function gameBlocks(n: number): Block[] {
  // Where a star appears, and how fast it falls: the same blocks at every level.
  const place = call('drop-place', 'Sprite', 'star', 'goTo', random(40, 320), num(-30))
  const show = set('drop-show', 'Sprite', 'star', 'visible', bool(true))
  const speed = set(
    'drop-speed',
    'Sprite',
    'star',
    'vy',
    n >= 4 ? math(num(150), '+', math(v('score'), '×', num(10))) : num(150),
  )
  const fall = [
    note(place, { fr: 'En haut, à un endroit au hasard.', en: 'At the top, somewhere at random.' }),
    show,
    note(
      speed,
      n >= 4
        ? {
            fr: 'Plus le score monte, plus ça tombe vite !',
            en: 'The higher the score, the faster!',
          }
        : { fr: 'Vitesse vers le bas (y augmente).', en: 'Speed downwards (y grows).' },
    ),
  ]
  const stacks: Block[] = []

  stacks.push(
    note(
      on('start', 'GameScene', 'sky', 'start', [
        ...(n >= 2 ? [setVar('start-score', 'score', num(0))] : []),
        ...(n >= 3 ? [setVar('start-lives', 'lives', num(3))] : []),
        ...(n >= 2 ? [run('start-show', SHOW)] : []),
        ...(n >= 2
          ? [
              set('start-pace', 'Timer', 'rain', 'interval', num(1)),
              call('start-rain', 'Timer', 'rain', 'start'),
            ]
          : []),
        run('start-drop', DROP),
      ]),
      n >= 2
        ? {
            fr: 'Au départ : tout à zéro, la pluie commence.',
            en: 'At the start: all to zero, the rain begins.',
          }
        : { fr: 'Au départ, une étoile tombe.', en: 'At the start, a star falls.' },
    ),
  )

  if (n === 1) {
    stacks.push(
      note(fn('drop', DROP, fall), {
        fr: 'Remet l’étoile en haut et la fait tomber.',
        en: 'Puts the star back at the top and lets it fall.',
      }),
    )
  } else {
    stacks.push(
      note(fn('drop', DROP, [call('drop-clone', 'Sprite', 'star', 'clone')]), {
        fr: 'Chaque étoile est un clone de l’étoile cachée.',
        en: 'Each star is a clone of the hidden star.',
      }),
      note(on('appear', 'Sprite', 'star', 'clone', fall), {
        fr: 'Ici, « Etoile » veut dire le nouveau clone.',
        en: 'Here, “Star” means the new clone.',
      }),
      note(on('tick', 'Timer', 'rain', 'tick', [run('tick-drop', DROP)]), {
        fr: 'Chaque fois que le minuteur sonne : une étoile de plus.',
        en: 'Each time the timer rings: one more star.',
      }),
      note(
        fn('show', SHOW, [
          set('show-score', 'SceneText', 'scoreText', 'text', join(str(SCORE), v('score'))),
          ...(n >= 3
            ? [set('show-lives', 'SceneText', 'livesText', 'text', join(str('❤️ '), v('lives')))]
            : []),
        ]),
        {
          fr: 'Écrit les nombres en haut de la scène.',
          en: 'Writes the numbers at the top of the scene.',
        },
      ),
    )
  }

  const end = (id: string) => (n === 1 ? run(id, DROP) : call(id, 'Sprite', 'star', 'delete'))
  stacks.push(
    note(
      on(
        'catch',
        'Sprite',
        'star',
        'hit',
        [
          ...(n >= 2 ? [change('catch-score', 'score', 1), run('catch-show', SHOW)] : []),
          ...(n >= 4 ? [call('catch-sound', 'Sound', 'pop', 'play')] : []),
          end('catch-end'),
        ],
        'basket',
      ),
      n === 1
        ? { fr: 'Attrapée ! Une autre étoile tombe.', en: 'Caught! Another star falls.' }
        : {
            fr: 'Attrapée : un point, et l’étoile disparaît.',
            en: 'Caught: one point, and the star goes.',
          },
    ),
    note(
      on(
        'miss',
        'Sprite',
        'star',
        'edge',
        [
          ...(n >= 3
            ? [change('miss-lives', 'lives', -1), run('miss-show', SHOW), run('miss-check', CHECK)]
            : []),
          ...(n >= 4 ? [call('miss-sound', 'Sound', 'oops', 'play')] : []),
          end('miss-end'),
        ],
        'bottom',
      ),
      n >= 3
        ? { fr: 'Tombée par terre : une vie en moins.', en: 'It hit the ground: one life less.' }
        : { fr: 'Ratée : elle touche le bas.', en: 'Missed: it touches the bottom.' },
    ),
    note(
      on('follow', 'Sprite', 'basket', 'drag', [
        set('follow-ground', 'Sprite', 'basket', 'y', num(590)),
      ]),
      {
        fr: 'Le panier suit ton doigt, mais reste au sol.',
        en: 'The basket follows your finger, but stays on the ground.',
      },
    ),
  )

  if (n >= 3) {
    stacks.push(
      note(
        fn('check', CHECK, [
          when('check-lost', cmp(v('lives'), '≤', num(0)), [
            call('check-stop', 'Timer', 'rain', 'stop'),
            call('check-clear', 'GameScene', 'sky', 'deleteClones'),
            ...(n >= 4
              ? [
                  note(
                    when('check-best', cmp(v('score'), '>', v('best')), [
                      setVar('check-record', 'best', v('score')),
                    ]),
                    { fr: 'Un record ? On le garde.', en: 'A record? Keep it.' },
                  ),
                ]
              : []),
            open('check-end', 'end'),
          ]),
        ]),
        { fr: 'Plus de vies : la partie s’arrête.', en: 'No lives left: the game stops.' },
      ),
    )
  }
  return stacks
}

function level(n: 1 | 2 | 3 | 4): LevelSource {
  const screens: LevelSource['screens'] = [
    {
      key: 'game',
      name: { fr: 'Jeu', en: 'Game' },
      props: { padding: 0 },
      components: components(n),
      blocks: gameBlocks(n),
    },
  ]
  if (n >= 3) {
    screens.push({
      key: 'end',
      name: { fr: 'Fin', en: 'End' },
      props: {
        padding: 24,
        gap: 16,
        alignItems: 'center',
        justify: 'center',
        background: '#1b1f4b',
      },
      components: [
        {
          key: 'lost',
          type: 'Text',
          name: { fr: 'Perdu', en: 'Lost' },
          props: {
            text: { fr: 'Partie terminée !', en: 'Game over!' },
            fontSize: 32,
            bold: true,
            color: '#ffe066',
            align: 'center',
          },
        },
        {
          key: 'finalText',
          type: 'Text',
          name: { fr: 'TexteFinal', en: 'FinalText' },
          props: {
            text: { fr: 'Ton score : 0', en: 'Your score: 0' },
            fontSize: 22,
            color: '#ffffff',
            align: 'center',
          },
        },
        ...(n >= 4
          ? [
              {
                key: 'bestText',
                type: 'Text',
                name: { fr: 'TexteRecord', en: 'BestText' },
                props: {
                  text: { fr: 'Meilleur score : 0', en: 'Best score: 0' },
                  fontSize: 18,
                  color: '#ffe066',
                  align: 'center',
                },
              },
            ]
          : []),
        {
          key: 'again',
          type: 'Button',
          name: { fr: 'Rejouer', en: 'PlayAgain' },
          props: { text: { fr: 'Rejouer', en: 'Play again' } },
        },
      ],
      blocks: [
        note(
          on('end-open', 'Screen', 'end', 'open', [
            set(
              'end-score',
              'Text',
              'finalText',
              'text',
              join(str({ fr: 'Ton score : ', en: 'Your score: ' }), v('score')),
            ),
            ...(n >= 4
              ? [
                  set(
                    'end-best',
                    'Text',
                    'bestText',
                    'text',
                    join(str({ fr: 'Meilleur score : ', en: 'Best score: ' }), v('best')),
                  ),
                ]
              : []),
          ]),
          { fr: 'L’écran de fin montre le score.', en: 'The end screen shows the score.' },
        ),
        note(on('again', 'Button', 'again', 'click', [open('again-open', 'game')]), {
          fr: 'Rouvre le jeu : tout repart à zéro.',
          en: 'Opens the game again: all starts from zero.',
        }),
      ],
    })
  }
  return {
    title: TITLES[n],
    summary: SUMMARIES[n],
    done: DONE[n],
    theme: { primary: '#7048e8', font: 'rounded' },
    variables: [
      ...(n >= 2 ? [{ key: 'score', name: { fr: 'score', en: 'score' }, initial: 0 }] : []),
      ...(n >= 3 ? [{ key: 'lives', name: { fr: 'vies', en: 'lives' }, initial: 3 }] : []),
      ...(n >= 4
        ? [{ key: 'best', name: { fr: 'record', en: 'best' }, kind: 'stored' as const, initial: 0 }]
        : []),
    ],
    screens,
    tour: TOURS[n],
    challenges: CHALLENGES[n],
  }
}

const TITLES = {
  1: { fr: 'Une étoile tombe', en: 'A star falls' },
  2: { fr: 'Une pluie d’étoiles', en: 'A rain of stars' },
  3: { fr: 'Trois vies', en: 'Three lives' },
  4: { fr: 'De plus en plus vite', en: 'Faster and faster' },
}
const SUMMARIES = {
  1: {
    fr: 'Le panier suit ton doigt, une étoile tombe. Une fonction la fait tomber.',
    en: 'The basket follows your finger, a star falls. A function makes it fall.',
  },
  2: {
    fr: 'Des clones, un minuteur et le hasard font pleuvoir les étoiles. Un score compte les points.',
    en: 'Clones, a timer and chance make stars rain. A score counts the points.',
  },
  3: {
    fr: 'Une étoile qui touche le sol coûte une vie. Plus de vies : un écran de fin.',
    en: 'A star hitting the ground costs a life. No lives left: an end screen.',
  },
  4: {
    fr: 'La vitesse monte avec le score, le record est gardé sur le téléphone, et il y a des sons.',
    en: 'Speed grows with the score, the record is kept on the phone, and there are sounds.',
  },
}
const DONE = {
  1: {
    fr: 'Tu sais comment l’étoile tombe et comment le panier l’attrape.',
    en: 'You know how the star falls and how the basket catches it.',
  },
  2: {
    fr: 'Tu as vu les clones, le minuteur et le score.',
    en: 'You saw clones, the timer and the score.',
  },
  3: {
    fr: 'Tu as vu les vies, le test « si » et l’écran de fin.',
    en: 'You saw lives, the “if” test and the end screen.',
  },
  4: {
    fr: 'Tu as vu un calcul de vitesse, une variable gardée sur le téléphone et des sons.',
    en: 'You saw a speed formula, a variable kept on the phone, and sounds.',
  },
}

const slowSteps = (block: string, watch: { fr: string; en: string }) => [
  {
    id: 'slow',
    target: 'slow-motion',
    check: { kind: 'slowMotion' },
    text: {
      fr: 'Lance le **ralenti** : les blocs vont s’allumer un par un pendant que le jeu tourne.',
      en: 'Start **slow motion**: blocks will light up one by one while the game runs.',
    },
  },
  {
    id: 'watch',
    target: `block:${block}`,
    check: { kind: 'stepped', id: block },
    mood: 'think' as const,
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
      fr: 'Bien vu ! Arrête le ralenti pour rejouer à vitesse normale.',
      en: 'Well spotted! Stop slow motion to play at normal speed again.',
    },
  },
]

const TOURS = {
  1: [
    {
      id: 'hello',
      mood: 'wave' as const,
      text: {
        fr: 'Voici **Attrape-étoiles** ! Essaie-le dans l’aperçu : glisse le panier pour attraper l’étoile. Puis on regarde ses blocs.',
        en: 'Here is **Star Catcher**! Try it in the preview: drag the basket to catch the star. Then we look at its blocks.',
      },
    },
    {
      id: 'start',
      target: 'block:start',
      text: {
        fr: 'Tout commence ici : [quand Ciel démarre] appelle la fonction « faire tomber une étoile ».',
        en: 'Everything starts here: [when Sky starts] calls the function “make a star fall”.',
      },
    },
    {
      id: 'drop',
      target: 'block:drop',
      text: {
        fr: 'Une **fonction** range des blocs sous un nom. Celle-ci place l’étoile en haut, au hasard, la montre, puis lui donne une vitesse vers le bas.',
        en: 'A **function** keeps blocks under a name. This one puts the star at the top, at random, shows it, then gives it a speed downwards.',
      },
    },
    {
      id: 'catch',
      target: 'block:catch',
      text: {
        fr: 'Quand l’étoile touche le panier, on appelle la même fonction : l’étoile repart d’en haut. Une fonction sert plusieurs fois !',
        en: 'When the star touches the basket, we call the same function: the star starts again from the top. A function can be used many times!',
      },
    },
    {
      id: 'follow',
      target: 'block:follow',
      text: {
        fr: 'Le panier se glisse au doigt (réglé dans Design). Ce bloc le remet au sol à chaque mouvement : il ne va que de gauche à droite.',
        en: 'The basket can be dragged (set in Design). This block puts it back on the ground at each move: it only goes left and right.',
      },
    },
    ...slowSteps('drop-place', {
      fr: 'Regarde : le bloc [mettre Etoile à x … y …] s’allume chaque fois qu’une étoile repart d’en haut.',
      en: 'Look: the block [put Star at x … y …] lights up each time a star starts again from the top.',
    }),
  ],
  2: [
    {
      id: 'hello',
      mood: 'wave' as const,
      text: {
        fr: 'Au niveau 2, il pleut des étoiles ! Clique sur **Nouveau** en haut des blocs pour voir ce qui a changé.',
        en: 'In level 2, it rains stars! Click **New** above the blocks to see what changed.',
      },
    },
    {
      id: 'drop',
      target: 'block:drop',
      text: {
        fr: 'Maintenant, la fonction crée un **clone** : une copie de l’étoile cachée. Chaque clone tombe tout seul.',
        en: 'Now the function creates a **clone**: a copy of the hidden star. Each clone falls on its own.',
      },
    },
    {
      id: 'appear',
      target: 'block:appear',
      text: {
        fr: 'Ce bloc tourne pour chaque nouveau clone. Ce sont les blocs du niveau 1 : ils ont juste changé de place.',
        en: 'This block runs for each new clone. These are the blocks of level 1: they just moved.',
      },
    },
    {
      id: 'tick',
      target: 'block:tick',
      text: {
        fr: 'Le **minuteur** Pluie sonne chaque seconde, et à chaque fois une étoile de plus tombe.',
        en: 'The **timer** Rain rings every second, and each time one more star falls.',
      },
    },
    {
      id: 'catch',
      target: 'block:catch',
      text: {
        fr: 'Attrapée : la variable **score** grandit de 1, on l’affiche, et le clone est supprimé.',
        en: 'Caught: the **score** variable grows by 1, we show it, and the clone is deleted.',
      },
    },
    {
      id: 'show',
      target: 'block:show',
      text: {
        fr: '[regrouper] colle un texte et un nombre : « Score : » puis la valeur du score.',
        en: '[join] sticks a text and a number together: “Score:” then the value of the score.',
      },
    },
    ...slowSteps('drop-clone', {
      fr: 'Regarde : [créer un clone de Etoile] s’allume à chaque sonnerie du minuteur.',
      en: 'Look: [create a clone of Star] lights up each time the timer rings.',
    }),
  ],
  3: [
    {
      id: 'hello',
      mood: 'wave' as const,
      text: {
        fr: 'Au niveau 3, tu as 3 vies. Laisse tomber 3 étoiles dans l’aperçu pour voir l’écran de fin.',
        en: 'In level 3, you have 3 lives. Let 3 stars fall in the preview to see the end screen.',
      },
    },
    {
      id: 'start',
      target: 'block:start',
      text: {
        fr: 'Au départ, la variable **vies** vaut 3.',
        en: 'At the start, the **lives** variable is 3.',
      },
    },
    {
      id: 'miss',
      target: 'block:miss',
      text: {
        fr: 'Une étoile touche le bas : une vie en moins, on l’affiche, puis on vérifie si c’est perdu.',
        en: 'A star touches the bottom: one life less, we show it, then we check whether the game is lost.',
      },
    },
    {
      id: 'check',
      target: 'block:check',
      text: {
        fr: 'Le bloc [si] pose une question : « vies ≤ 0 ? ». Seulement si c’est vrai, on arrête la pluie, on efface les clones et on ouvre l’écran Fin.',
        en: 'The [if] block asks a question: “lives ≤ 0?”. Only if it is true do we stop the rain, delete the clones and open the End screen.',
      },
    },
    {
      id: 'end',
      target: 'screen-picker',
      text: {
        fr: 'L’écran **Fin** a ses propres blocs : choisis-le ici pour les voir, puis reviens sur Jeu.',
        en: 'The **End** screen has its own blocks: pick it here to see them, then come back to Game.',
      },
    },
    ...slowSteps('miss-lives', {
      fr: 'Regarde : [modifier vies de -1] s’allume quand une étoile tombe par terre. Laisse-en tomber une !',
      en: 'Look: [change lives by -1] lights up when a star hits the ground. Let one fall!',
    }),
  ],
  4: [
    {
      id: 'hello',
      mood: 'wave' as const,
      text: {
        fr: 'Au niveau 4, ça va de plus en plus vite, ton record est gardé, et on entend des sons.',
        en: 'In level 4, it gets faster and faster, your record is kept, and there are sounds.',
      },
    },
    {
      id: 'speed',
      target: 'block:drop-speed',
      text: {
        fr: 'La vitesse est un calcul : 150 + score × 10. Avec 5 points, l’étoile tombe à 200.',
        en: 'The speed is a calculation: 150 + score × 10. With 5 points, the star falls at 200.',
      },
    },
    {
      id: 'best',
      target: 'block:check-best',
      text: {
        fr: 'La variable **record** est *stockée* : le téléphone la garde, même quand on ferme l’appli. On la change seulement si le score est plus grand.',
        en: 'The **best** variable is *stored*: the phone keeps it, even when the app is closed. We change it only if the score is bigger.',
      },
    },
    {
      id: 'sound',
      target: 'block:catch-sound',
      text: {
        fr: 'Un composant **Son** joue un petit bruit à chaque étoile attrapée.',
        en: 'A **Sound** component plays a little noise for each star caught.',
      },
    },
    ...slowSteps('drop-speed', {
      fr: 'Regarde le bloc de vitesse s’allumer pour chaque nouvelle étoile.',
      en: 'Watch the speed block light up for each new star.',
    }),
  ],
}

const CHALLENGES = {
  1: [
    {
      id: 'faster',
      block: 'drop-speed',
      check: { kind: 'blockField', id: 'drop-speed/value', field: 'NUM', min: 250 },
      text: {
        fr: 'Fais tomber l’étoile plus vite : 250 ou plus.',
        en: 'Make the star fall faster: 250 or more.',
      },
      hint: {
        fr: 'Change le 150 dans « faire tomber une étoile ».',
        en: 'Change the 150 in “make a star fall”.',
      },
    },
    {
      id: 'higher',
      block: 'follow-ground',
      check: { kind: 'blockField', id: 'follow-ground/value', field: 'NUM', max: 560 },
      text: {
        fr: 'Remonte le panier : mets 500 au lieu de 590.',
        en: 'Lift the basket: put 500 instead of 590.',
      },
      hint: {
        fr: 'C’est dans le bloc « quand on glisse Panier ».',
        en: 'It is in the “when Basket is dragged” block.',
      },
    },
    {
      id: 'spin',
      block: 'catch',
      check: { kind: 'block', type: 'rx_Sprite_call_turn', within: 'catch' },
      text: {
        fr: 'Quand tu attrapes l’étoile, fais-la tourner.',
        en: 'When you catch the star, make it turn.',
      },
      hint: {
        fr: 'Prends [tourner … de … degrés] chez Etoile, et pose-le dans « quand Etoile touche Panier ».',
        en: 'Take [turn … by … degrees] from Star, and drop it in “when Star touches Basket”.',
      },
    },
  ],
  2: [
    {
      id: 'more',
      block: 'start-pace',
      check: { kind: 'blockField', id: 'start-pace/value', field: 'NUM', max: 0.6 },
      text: {
        fr: 'Fais pleuvoir plus : une étoile toutes les 0,5 seconde.',
        en: 'More rain: one star every 0.5 second.',
      },
      hint: {
        fr: 'Change l’intervalle de Pluie au départ.',
        en: 'Change the interval of Rain at the start.',
      },
    },
    {
      id: 'double',
      block: 'catch-score',
      check: { kind: 'blockField', id: 'catch-score/delta', field: 'NUM', equals: 2 },
      text: { fr: 'Gagne 2 points par étoile.', en: 'Win 2 points per star.' },
      hint: { fr: 'Regarde [modifier score de 1].', en: 'Look at [change score by 1].' },
    },
    {
      id: 'wide',
      block: 'drop-place',
      check: {
        kind: 'all',
        of: [
          { kind: 'blockField', id: 'drop-place/arg0/from', field: 'NUM', max: 20 },
          { kind: 'blockField', id: 'drop-place/arg0/to', field: 'NUM', min: 340 },
        ],
      },
      text: {
        fr: 'Fais tomber les étoiles d’un bord à l’autre : de 20 à 340.',
        en: 'Make stars fall from edge to edge: from 20 to 340.',
      },
      hint: { fr: 'C’est le nombre au hasard de x.', en: 'It is the random number for x.' },
    },
  ],
  3: [
    {
      id: 'five',
      block: 'start-lives',
      check: { kind: 'blockField', id: 'start-lives/value', field: 'NUM', equals: 5 },
      text: { fr: 'Donne 5 vies au lieu de 3.', en: 'Give 5 lives instead of 3.' },
      hint: {
        fr: 'C’est au départ, dans [mettre vies à 3].',
        en: 'It is at the start, in [set lives to 3].',
      },
    },
    {
      id: 'hard',
      block: 'miss-lives',
      check: { kind: 'blockField', id: 'miss-lives/delta', field: 'NUM', equals: -2 },
      text: {
        fr: 'Mode difficile : perds 2 vies par étoile ratée.',
        en: 'Hard mode: lose 2 lives per missed star.',
      },
      hint: {
        fr: 'Change le -1 dans « quand Etoile touche le bord du bas ».',
        en: 'Change the -1 in “when Star touches the bottom edge”.',
      },
    },
    {
      id: 'message',
      block: 'check-lost',
      check: { kind: 'block', type: 'rx_ui_toast', within: 'check-lost' },
      text: {
        fr: 'Affiche un message bref quand c’est perdu.',
        en: 'Show a short message when the game is lost.',
      },
      hint: {
        fr: 'Le bloc est dans la catégorie Interface.',
        en: 'The block is in the Interface category.',
      },
    },
  ],
  4: [
    {
      id: 'gentle',
      block: 'drop-speed',
      check: { kind: 'blockField', id: 'drop-speed/value/b/b', field: 'NUM', equals: 5 },
      text: {
        fr: 'Accélère plus doucement : 5 par point au lieu de 10.',
        en: 'Speed up more gently: 5 per point instead of 10.',
      },
      hint: {
        fr: 'C’est le 10 du calcul de vitesse.',
        en: 'It is the 10 in the speed calculation.',
      },
    },
    {
      id: 'quick',
      block: 'drop-speed',
      check: { kind: 'blockField', id: 'drop-speed/value/a', field: 'NUM', min: 200 },
      text: {
        fr: 'Fais démarrer les étoiles à 200 au lieu de 150.',
        en: 'Make stars start at 200 instead of 150.',
      },
      hint: {
        fr: 'C’est le 150 du calcul de vitesse.',
        en: 'It is the 150 in the speed calculation.',
      },
    },
    {
      id: 'sad',
      block: 'check-lost',
      check: { kind: 'block', type: 'rx_Sound_call_play', within: 'check-lost' },
      text: {
        fr: 'Joue un son quand la partie est perdue.',
        en: 'Play a sound when the game is lost.',
      },
      hint: {
        fr: 'Pose [jouer SonRate] dans le [si] de « vérifier si c’est perdu ».',
        en: 'Put [play MissSound] in the [if] of “check if the game is lost”.',
      },
    },
  ],
}

export const starCatcher: AppSource = {
  id: 'star-catcher',
  order: 1,
  kind: 'game',
  icon: '🌟',
  accent: 'indigo',
  title: { fr: 'Attrape-étoiles', en: 'Star Catcher' },
  summary: {
    fr: 'Un jeu : attrape les étoiles avec ton panier avant qu’elles touchent le sol.',
    en: 'A game: catch the stars with your basket before they hit the ground.',
  },
  level,
}
