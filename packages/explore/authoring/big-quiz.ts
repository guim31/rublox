import {
  type Block,
  bool,
  call,
  change,
  cmp,
  count,
  emptyList,
  fn,
  item,
  join,
  length,
  list,
  math,
  not,
  note,
  num,
  on,
  open,
  prop,
  push,
  put,
  random,
  run,
  set,
  setVar,
  split,
  str,
  type Text,
  v,
  when,
} from './dsl.ts'
import type { AppSource, ComponentSource, LevelSource, TourStepSource } from './types.ts'

/**
 * Le grand quiz (The Big Quiz). Level 1: one question and checking the answer. Level 2: a list
 * of questions gone through with an index. Level 3: a timer per question, a score, a results
 * screen. Level 4: themes to choose, shuffled questions (the shuffle explained), records kept.
 */

const CHECK = { fr: 'vérifier la réponse', en: 'check the answer' }
const SHOW = { fr: 'afficher la question', en: 'show the question' }
const NEXT = { fr: 'passer à la question suivante', en: 'go to the next question' }
const LOAD = { fr: 'choisir les questions', en: 'pick the questions' }
const MIX = { fr: 'mélanger les questions', en: 'shuffle the questions' }

type Question = { q: Text; options: [Text, Text, Text]; answer: 0 | 1 | 2 }

const pair = (fr: string, en: string) => ({ fr, en })

/** Questions of the first theme: general knowledge (levels 1 to 4). */
const GENERAL: Question[] = [
  {
    q: pair('Combien de pattes a une araignée ?', 'How many legs does a spider have?'),
    options: ['6', '8', '10'],
    answer: 1,
  },
  {
    q: pair(
      'De quelle couleur est le ciel quand il fait beau ?',
      'What colour is the sky on a sunny day?',
    ),
    options: [pair('Vert', 'Green'), pair('Bleu', 'Blue'), pair('Rouge', 'Red')],
    answer: 1,
  },
  { q: pair('Combien font 7 × 6 ?', 'What is 7 × 6?'), options: ['42', '36', '48'], answer: 0 },
  {
    q: pair('Quel animal fait « miaou » ?', 'Which animal says “meow”?'),
    options: [pair('Le chien', 'The dog'), pair('Le chat', 'The cat'), pair('La vache', 'The cow')],
    answer: 1,
  },
  {
    q: pair('Combien de jours dans une semaine ?', 'How many days in a week?'),
    options: ['5', '7', '10'],
    answer: 1,
  },
]

const SPACE: Question[] = [
  {
    q: pair('Quelle planète est la plus proche du Soleil ?', 'Which planet is closest to the Sun?'),
    options: [pair('Mercure', 'Mercury'), 'Mars', 'Jupiter'],
    answer: 0,
  },
  {
    q: pair('Comment s’appelle notre galaxie ?', 'What is our galaxy called?'),
    options: [
      pair('La Voie lactée', 'The Milky Way'),
      pair('Andromède', 'Andromeda'),
      pair('La Grande Ourse', 'The Great Bear'),
    ],
    answer: 0,
  },
  {
    q: pair('Quelle est la plus grande planète ?', 'Which is the biggest planet?'),
    options: [pair('Saturne', 'Saturn'), 'Jupiter', pair('La Terre', 'Earth')],
    answer: 1,
  },
  {
    q: pair('Qu’est-ce que le Soleil ?', 'What is the Sun?'),
    options: [
      pair('Une planète', 'A planet'),
      pair('Une étoile', 'A star'),
      pair('Une lune', 'A moon'),
    ],
    answer: 1,
  },
  {
    q: pair(
      'Combien de planètes tournent autour du Soleil ?',
      'How many planets go around the Sun?',
    ),
    options: ['7', '8', '9'],
    answer: 1,
  },
]

const ANIMALS: Question[] = [
  {
    q: pair('Quel est le plus grand animal du monde ?', 'What is the biggest animal in the world?'),
    options: [
      pair('L’éléphant', 'The elephant'),
      pair('La baleine bleue', 'The blue whale'),
      pair('La girafe', 'The giraffe'),
    ],
    answer: 1,
  },
  {
    q: pair('Combien de bosses a un dromadaire ?', 'How many humps does a dromedary have?'),
    options: ['1', '2', '3'],
    answer: 0,
  },
  {
    q: pair('Que mange surtout le panda ?', 'What does a panda mostly eat?'),
    options: [
      pair('Du bambou', 'Bamboo'),
      pair('Du poisson', 'Fish'),
      pair('Des fraises', 'Strawberries'),
    ],
    answer: 0,
  },
  {
    q: pair('Quel oiseau ne vole pas ?', 'Which bird cannot fly?'),
    options: [
      pair('Le pigeon', 'The pigeon'),
      pair('Le manchot', 'The penguin'),
      pair('L’aigle', 'The eagle'),
    ],
    answer: 1,
  },
  {
    q: pair('Où vit le poisson-clown ?', 'Where does the clownfish live?'),
    options: [
      pair('Dans la mer', 'In the sea'),
      pair('Dans un lac', 'In a lake'),
      pair('Dans une rivière', 'In a river'),
    ],
    answer: 0,
  },
]

const text = (value: Text) => value
const both = (a: Text, b: Text, c: Text): Text =>
  typeof a === 'string' && typeof b === 'string' && typeof c === 'string'
    ? `${a}|${b}|${c}`
    : {
        fr: [a, b, c].map((x) => (typeof x === 'string' ? x : x.fr)).join('|'),
        en: [a, b, c].map((x) => (typeof x === 'string' ? x : x.en)).join('|'),
      }

/** The three lists of a theme: questions, choices ("a|b|c"), answers. */
function lists(prefix: string, questions: Question[]): Block[] {
  return [
    note(setVar(`${prefix}-questions`, 'questions', list(...questions.map((q) => str(q.q)))), {
      fr: 'Les questions, dans l’ordre.',
      en: 'The questions, in order.',
    }),
    note(
      setVar(
        `${prefix}-choices`,
        'choices',
        list(...questions.map((q) => str(both(...q.options)))),
      ),
      { fr: 'Les 3 réponses possibles, séparées par |', en: 'The 3 possible answers, split by |' },
    ),
    note(
      setVar(
        `${prefix}-answers`,
        'answers',
        list(...questions.map((q) => str(text(q.options[q.answer])))),
      ),
      { fr: 'La bonne réponse de chaque question.', en: 'The right answer of each question.' },
    ),
  ]
}

function quizComponents(n: number): ComponentSource[] {
  const first = GENERAL[0] as Question
  const options = first.options
  return [
    {
      key: 'title',
      type: 'Text',
      name: { fr: 'Titre', en: 'Title' },
      props: {
        text: { fr: '❓ Le grand quiz', en: '❓ The Big Quiz' },
        fontSize: 26,
        bold: true,
        align: 'center',
      },
    },
    ...(n >= 3
      ? [
          {
            key: 'status',
            type: 'Row',
            name: { fr: 'État', en: 'Status' },
            props: { justify: 'between' },
            children: [
              {
                key: 'timeText',
                type: 'Text',
                name: { fr: 'TexteTemps', en: 'TimeText' },
                props: { text: '⏱ 10', bold: true },
              },
              {
                key: 'scoreText',
                type: 'Text',
                name: { fr: 'TexteScore', en: 'ScoreText' },
                props: { text: { fr: 'Score : 0', en: 'Score: 0' }, bold: true },
              },
            ],
          },
          {
            key: 'timeBar',
            type: 'ProgressBar',
            name: { fr: 'BarreTemps', en: 'TimeBar' },
            props: { value: 100 },
          },
        ]
      : []),
    ...(n >= 2
      ? [
          {
            key: 'counter',
            type: 'Text',
            name: { fr: 'Compteur', en: 'Counter' },
            props: { text: 'Question 1 / 5', color: '@muted', align: 'center' },
          },
        ]
      : []),
    {
      key: 'question',
      type: 'Text',
      name: { fr: 'Question', en: 'Question' },
      props: { text: first.q, fontSize: 22, align: 'center' },
    },
    ...(['a', 'b', 'c'] as const).map((key, index) => ({
      key,
      type: 'Button',
      name: { fr: `Réponse${key.toUpperCase()}`, en: `Answer${key.toUpperCase()}` },
      props: { text: options[index] as Text, variant: 'outline' },
    })),
    {
      key: 'feedback',
      type: 'Text',
      name: { fr: 'Résultat', en: 'Feedback' },
      props: { text: '', fontSize: 20, bold: true, align: 'center' },
    },
    ...(n >= 2
      ? [
          {
            key: 'next',
            type: 'Button',
            name: { fr: 'Suivante', en: 'Next' },
            props: { text: { fr: 'Question suivante →', en: 'Next question →' } },
          },
        ]
      : []),
    ...(n >= 3
      ? [
          {
            key: 'chrono',
            type: 'Timer',
            name: { fr: 'Chrono', en: 'Clock' },
            props: { interval: 1, repeat: true, autostart: false },
          },
        ]
      : []),
  ]
}

function quizBlocks(n: number): Block[] {
  const stacks: Block[] = []
  // Which question: its place in the lists (level 2), or in the shuffled order (level 4).
  const at = () => (n >= 4 ? v('number') : v('index'))
  const good = n >= 2 ? item(v('answers'), at()) : str('8')

  if (n >= 2) {
    stacks.push(
      note(
        on('open', 'Screen', 'quiz', 'open', [
          ...(n >= 4 ? [run('open-load', LOAD)] : lists('open', GENERAL)),
          ...(n >= 4 ? [run('open-mix', MIX)] : []),
          setVar('open-index', 'index', num(1)),
          ...(n >= 3 ? [setVar('open-score', 'score', num(0))] : []),
          run('open-show', SHOW),
        ]),
        {
          fr: 'À l’ouverture : les questions, puis la première.',
          en: 'When it opens: the questions, then the first one.',
        },
      ),
      note(
        fn('show', SHOW, [
          ...(n >= 4
            ? [
                note(setVar('show-pick', 'number', item(v('order'), v('index'))), {
                  fr: 'Quelle question ? Celle de l’ordre mélangé.',
                  en: 'Which question? The one in the shuffled order.',
                }),
              ]
            : []),
          set('show-question', 'Text', 'question', 'text', item(v('questions'), at())),
          note(setVar('show-options', 'options', split(item(v('choices'), at()), '|')), {
            fr: '« 6|8|10 » devient une liste de 3 textes.',
            en: '“6|8|10” becomes a list of 3 texts.',
          }),
          set('show-a', 'Button', 'a', 'text', item(v('options'), 1)),
          set('show-b', 'Button', 'b', 'text', item(v('options'), 2)),
          set('show-c', 'Button', 'c', 'text', item(v('options'), 3)),
          set('show-feedback', 'Text', 'feedback', 'text', str('')),
          set(
            'show-counter',
            'Text',
            'counter',
            'text',
            join(str('Question '), v('index'), str(' / '), length(v('questions'))),
          ),
          ...(n >= 3
            ? [
                setVar('show-answered', 'answered', bool(false)),
                setVar('show-time', 'timeLeft', num(10)),
                set('show-time-text', 'Text', 'timeText', 'text', join(str('⏱ '), v('timeLeft'))),
                set('show-bar', 'ProgressBar', 'timeBar', 'value', num(100)),
                call('show-chrono', 'Timer', 'chrono', 'start'),
              ]
            : []),
        ]),
        {
          fr: 'Écrit la question n° « index » et ses 3 réponses.',
          en: 'Writes question number “index” and its 3 answers.',
        },
      ),
    )
  }

  for (const key of ['a', 'b', 'c'] as const) {
    stacks.push(
      note(
        on(`click-${key}`, 'Button', key, 'click', [
          setVar(`click-${key}-set`, 'choice', prop('Button', key, 'text')),
          run(`click-${key}-check`, CHECK),
        ]),
        key === 'a'
          ? {
              fr: 'On retient le texte du bouton touché.',
              en: 'We remember the text of the button tapped.',
            }
          : key === 'b'
            ? { fr: 'Pareil pour le bouton B…', en: 'Same for button B…' }
            : { fr: '… et pour le bouton C.', en: '… and for button C.' },
      ),
    )
  }

  const test = note(
    when(
      'check-test',
      cmp(v('choice'), '=', good),
      [
        set(
          'check-yes',
          'Text',
          'feedback',
          'text',
          str({ fr: 'Bravo ! 🎉', en: 'Well done! 🎉' }),
        ),
        set('check-yes-color', 'Text', 'feedback', 'color', {
          type: 'colour_picker',
          fields: { COLOUR: '#009900' },
        }),
        ...(n >= 3
          ? [
              change('check-point', 'score', 1),
              set(
                'check-score',
                'Text',
                'scoreText',
                'text',
                join(str({ fr: 'Score : ', en: 'Score: ' }), v('score')),
              ),
            ]
          : []),
      ],
      [
        set(
          'check-no',
          'Text',
          'feedback',
          'text',
          join(str({ fr: 'Raté ! C’était : ', en: 'Wrong! It was: ' }), good),
        ),
        set('check-no-color', 'Text', 'feedback', 'color', {
          type: 'colour_picker',
          fields: { COLOUR: '#cc0000' },
        }),
      ],
    ),
    { fr: 'Le choix est-il la bonne réponse ?', en: 'Is the choice the right answer?' },
  )
  stacks.push(
    note(
      fn(
        'check',
        CHECK,
        n >= 3
          ? [
              note(
                when('check-once', not(v('answered')), [
                  setVar('check-mark', 'answered', bool(true)),
                  call('check-stop', 'Timer', 'chrono', 'stop'),
                  test,
                ]),
                { fr: 'Une seule réponse par question.', en: 'Only one answer per question.' },
              ),
            ]
          : [test],
      ),
      {
        fr: 'Compare le choix avec la bonne réponse.',
        en: 'Compares the choice with the right answer.',
      },
    ),
  )

  if (n >= 2) {
    const nextBody: Block[] = [
      change('next-index', 'index', 1),
      note(
        when(
          'next-end',
          cmp(v('index'), '>', length(v('questions'))),
          [
            setVar('next-loop', 'index', num(1)),
            ...(n >= 3 ? [call('next-stop', 'Timer', 'chrono', 'stop')] : []),
            ...(n >= 4
              ? [
                  note(
                    when('next-record', cmp(v('score'), '>', item(v('records'), v('theme'))), [
                      put('next-best', 'records', v('theme'), v('score')),
                    ]),
                    { fr: 'Nouveau record pour ce thème ?', en: 'A new record for this theme?' },
                  ),
                ]
              : []),
            ...(n >= 3 ? [open('next-results', 'results')] : []),
          ],
          n >= 3 ? [run('next-show', SHOW)] : undefined,
        ),
        n >= 3
          ? { fr: 'Après la dernière : les résultats.', en: 'After the last one: the results.' }
          : { fr: 'Après la dernière, on recommence.', en: 'After the last one, start again.' },
      ),
      ...(n >= 3 ? [] : [run('next-show', SHOW)]),
    ]
    if (n >= 3) {
      stacks.push(
        note(on('next', 'Button', 'next', 'click', [run('next-call', NEXT)]), {
          fr: 'Le bouton passe à la suivante.',
          en: 'The button goes to the next one.',
        }),
        note(fn('next-fn', NEXT, nextBody), {
          fr: 'index + 1 : la question d’après.',
          en: 'index + 1: the following question.',
        }),
        note(
          on('tick', 'Timer', 'chrono', 'tick', [
            change('tick-down', 'timeLeft', -1),
            set('tick-text', 'Text', 'timeText', 'text', join(str('⏱ '), v('timeLeft'))),
            note(
              set('tick-bar', 'ProgressBar', 'timeBar', 'value', math(v('timeLeft'), '×', num(10))),
              {
                fr: '10 secondes = barre pleine (100).',
                en: '10 seconds = full bar (100).',
              },
            ),
            when('tick-zero', cmp(v('timeLeft'), '≤', num(0)), [
              call('tick-stop', 'Timer', 'chrono', 'stop'),
              setVar('tick-answered', 'answered', bool(true)),
              set(
                'tick-late',
                'Text',
                'feedback',
                'text',
                str({ fr: 'Trop tard ! ⏰', en: 'Too late! ⏰' }),
              ),
            ]),
          ]),
          { fr: 'Chaque seconde : une de moins.', en: 'Every second: one less.' },
        ),
      )
    } else {
      stacks.push(
        note(on('next', 'Button', 'next', 'click', nextBody), {
          fr: 'index + 1 : la question d’après.',
          en: 'index + 1: the following question.',
        }),
      )
    }
  }

  if (n >= 4) {
    stacks.push(
      note(
        fn('load', LOAD, [
          ...lists('open', GENERAL),
          when('load-space', cmp(v('theme'), '=', num(2)), lists('space', SPACE)),
          when('load-animals', cmp(v('theme'), '=', num(3)), lists('animals', ANIMALS)),
        ]),
        {
          fr: 'Thème 1 par défaut, sinon le 2 ou le 3.',
          en: 'Theme 1 by default, else 2 or 3.',
        },
      ),
      note(
        fn('mix', MIX, [
          setVar('mix-order', 'order', emptyList()),
          note(
            count('mix-fill', 'i', 1, length(v('questions')), 1, [
              push('mix-push', 'order', v('i')),
            ]),
            {
              fr: 'D’abord l’ordre 1, 2, 3, 4, 5.',
              en: 'First the order 1, 2, 3, 4, 5.',
            },
          ),
          note(
            count('mix-loop', 'i', length(v('questions')), 2, 1, [
              note(setVar('mix-pick', 'j', random(1, v('i'))), {
                fr: 'Une place au hasard, jusqu’à i.',
                en: 'A place at random, up to i.',
              }),
              setVar('mix-keep', 'swap', item(v('order'), v('i'))),
              put('mix-swap1', 'order', v('i'), item(v('order'), v('j'))),
              note(put('mix-swap2', 'order', v('j'), v('swap')), {
                fr: 'Échange les places i et j.',
                en: 'Swaps places i and j.',
              }),
            ]),
            {
              fr: 'De la fin vers le début : chaque place reçoit un numéro tiré parmi ceux qui restent.',
              en: 'From the end to the start: each place gets a number drawn from those left.',
            },
            280,
            80,
          ),
        ]),
        {
          fr: 'Le mélange de Fisher-Yates : tous les ordres ont la même chance.',
          en: 'The Fisher-Yates shuffle: every order has the same chance.',
        },
        280,
      ),
    )
  }
  return stacks
}

function results(n: number): LevelSource['screens'][number] {
  return {
    key: 'results',
    name: { fr: 'Résultats', en: 'Results' },
    props: { padding: 24, gap: 16, alignItems: 'stretch', justify: 'center' },
    components: [
      {
        key: 'resultTitle',
        type: 'Text',
        name: { fr: 'TitreRésultats', en: 'ResultsTitle' },
        props: {
          text: { fr: '🏁 Résultats', en: '🏁 Results' },
          fontSize: 28,
          bold: true,
          align: 'center',
        },
      },
      {
        key: 'resultScore',
        type: 'Text',
        name: { fr: 'TexteRésultat', en: 'ResultText' },
        props: { text: '', fontSize: 20, align: 'center' },
      },
      ...(n >= 4
        ? [
            {
              key: 'recordText',
              type: 'Text',
              name: { fr: 'TexteRecord', en: 'RecordText' },
              props: { text: '', color: '@primary', bold: true, align: 'center' },
            },
          ]
        : []),
      {
        key: 'replay',
        type: 'Button',
        name: { fr: 'Rejouer', en: 'PlayAgain' },
        props: { text: { fr: 'Rejouer', en: 'Play again' } },
      },
    ],
    blocks: [
      note(
        on('results-open', 'Screen', 'results', 'open', [
          set(
            'results-score',
            'Text',
            'resultScore',
            'text',
            join(
              str({ fr: 'Tu as ', en: 'You got ' }),
              v('score'),
              str({ fr: ' bonnes réponses sur ', en: ' right answers out of ' }),
              length(v('questions')),
            ),
          ),
          ...(n >= 4
            ? [
                set(
                  'results-record',
                  'Text',
                  'recordText',
                  'text',
                  join(
                    str({ fr: 'Record du thème : ', en: 'Theme record: ' }),
                    item(v('records'), v('theme')),
                  ),
                ),
              ]
            : []),
        ]),
        {
          fr: 'Le score, à côté du nombre de questions.',
          en: 'The score, next to the number of questions.',
        },
      ),
      note(
        on('replay', 'Button', 'replay', 'click', [
          open('replay-open', n >= 4 ? 'themes' : 'quiz'),
        ]),
        {
          fr: 'On rejoue.',
          en: 'Play again.',
        },
      ),
    ],
  }
}

function themes(): LevelSource['screens'][number] {
  const all = [
    { key: 'general', number: 1, label: { fr: '🧠 Culture générale', en: '🧠 General knowledge' } },
    { key: 'space', number: 2, label: { fr: '🚀 L’espace', en: '🚀 Space' } },
    { key: 'animals', number: 3, label: { fr: '🐾 Les animaux', en: '🐾 Animals' } },
  ]
  return {
    key: 'themes',
    name: { fr: 'Thèmes', en: 'Themes' },
    props: { padding: 24, gap: 16, alignItems: 'stretch', justify: 'center' },
    components: [
      {
        key: 'pick',
        type: 'Text',
        name: { fr: 'Choisis', en: 'Pick' },
        props: {
          text: { fr: 'Choisis un thème', en: 'Pick a theme' },
          fontSize: 26,
          bold: true,
          align: 'center',
        },
      },
      ...all.map((theme) => ({
        key: `theme-${theme.key}`,
        type: 'Button',
        name: { fr: `Theme${theme.number}`, en: `Theme${theme.number}` },
        props: { text: theme.label },
      })),
    ],
    blocks: all.map((theme) =>
      note(
        on(`theme-${theme.key}`, 'Button', `theme-${theme.key}`, 'click', [
          setVar(`theme-${theme.key}-set`, 'theme', num(theme.number)),
          open(`theme-${theme.key}-open`, 'quiz'),
        ]),
        theme.number === 1
          ? { fr: 'Le thème est un numéro : 1, 2 ou 3.', en: 'The theme is a number: 1, 2 or 3.' }
          : { fr: `Thème ${theme.number}.`, en: `Theme ${theme.number}.` },
      ),
    ),
  }
}

function level(n: 1 | 2 | 3 | 4): LevelSource {
  const quiz = {
    key: 'quiz',
    name: { fr: 'Quiz', en: 'Quiz' },
    props: { padding: 20, gap: 12 },
    components: quizComponents(n),
    blocks: quizBlocks(n),
  }
  return {
    title: TITLES[n],
    summary: SUMMARIES[n],
    done: DONE[n],
    theme: { primary: '#1971c2', font: 'rounded' },
    variables: [
      { key: 'choice', name: { fr: 'choix', en: 'choice' }, initial: '' },
      ...(n >= 2
        ? [
            { key: 'questions', name: { fr: 'questions', en: 'questions' }, initial: [] },
            { key: 'choices', name: { fr: 'réponses', en: 'choices' }, initial: [] },
            { key: 'answers', name: { fr: 'bonnes', en: 'answers' }, initial: [] },
            { key: 'options', name: { fr: 'options', en: 'options' }, initial: [] },
            { key: 'index', name: { fr: 'index', en: 'index' }, initial: 1 },
          ]
        : []),
      ...(n >= 3
        ? [
            { key: 'score', name: { fr: 'score', en: 'score' }, initial: 0 },
            { key: 'timeLeft', name: { fr: 'temps', en: 'timeLeft' }, initial: 10 },
            { key: 'answered', name: { fr: 'répondu', en: 'answered' }, initial: false },
          ]
        : []),
      ...(n >= 4
        ? [
            { key: 'theme', name: { fr: 'thème', en: 'theme' }, initial: 1 },
            { key: 'order', name: { fr: 'ordre', en: 'order' }, initial: [] },
            { key: 'number', name: { fr: 'numéro', en: 'number' }, initial: 1 },
            { key: 'i', name: { fr: 'i', en: 'i' }, initial: 0 },
            { key: 'j', name: { fr: 'j', en: 'j' }, initial: 0 },
            { key: 'swap', name: { fr: 'garde', en: 'keep' }, initial: 0 },
            {
              key: 'records',
              name: { fr: 'records', en: 'records' },
              kind: 'stored' as const,
              initial: [0, 0, 0],
            },
          ]
        : []),
    ],
    screens: [...(n >= 4 ? [themes()] : []), quiz, ...(n >= 3 ? [results(n)] : [])],
    tour: TOURS[n],
    challenges: CHALLENGES[n],
  }
}

const TITLES = {
  1: { fr: 'Une question', en: 'One question' },
  2: { fr: 'Une liste de questions', en: 'A list of questions' },
  3: { fr: 'Chrono et score', en: 'Clock and score' },
  4: { fr: 'Thèmes et mélange', en: 'Themes and shuffle' },
}
const SUMMARIES = {
  1: {
    fr: 'Trois boutons, une variable « choix », et un « si … sinon » qui vérifie la réponse.',
    en: 'Three buttons, a “choice” variable, and an “if … else” that checks the answer.',
  },
  2: {
    fr: 'Les questions sont rangées dans des listes, et une variable « index » dit où on en est.',
    en: 'The questions live in lists, and an “index” variable says where we are.',
  },
  3: {
    fr: 'Un minuteur par question, une barre de temps, un score et un écran de résultats.',
    en: 'A timer per question, a time bar, a score and a results screen.',
  },
  4: {
    fr: 'Trois thèmes, des questions mélangées à chaque partie, et un record par thème.',
    en: 'Three themes, questions shuffled each game, and a record per theme.',
  },
}
const DONE = {
  1: {
    fr: 'Tu sais comment le quiz vérifie une réponse.',
    en: 'You know how the quiz checks an answer.',
  },
  2: { fr: 'Tu as vu des listes et un index.', en: 'You saw lists and an index.' },
  3: {
    fr: 'Tu as vu un minuteur, un score et un deuxième écran.',
    en: 'You saw a timer, a score and a second screen.',
  },
  4: {
    fr: 'Tu as vu un vrai algorithme : le mélange de Fisher-Yates.',
    en: 'You saw a real algorithm: the Fisher-Yates shuffle.',
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
      fr: 'Touche une réponse dans l’aperçu, ou clique sur « Redémarrer ».',
      en: 'Tap an answer in the preview, or click “Restart”.',
    },
  },
  {
    id: 'fast',
    target: 'slow-motion',
    check: { kind: 'not', of: { kind: 'slowMotion' } },
    text: { fr: 'Arrête le ralenti.', en: 'Stop slow motion.' },
  },
]

const TOURS: Record<1 | 2 | 3 | 4, TourStepSource[]> = {
  1: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Voici **Le grand quiz** ! Réponds à la question dans l’aperçu, puis regardons comment il sait si c’est juste.',
        en: 'Here is **The Big Quiz**! Answer the question in the preview, then let’s see how it knows if you are right.',
      },
    },
    {
      id: 'click',
      target: 'block:click-a',
      text: {
        fr: 'Quand on touche un bouton, on range son texte dans la variable **choix**. Une variable, c’est une boîte avec un nom.',
        en: 'When a button is tapped, we put its text in the **choice** variable. A variable is a box with a name.',
      },
    },
    {
      id: 'check',
      target: 'block:check',
      text: {
        fr: 'Les trois boutons appellent la même fonction : on n’écrit la vérification qu’une fois.',
        en: 'The three buttons call the same function: the check is written only once.',
      },
    },
    {
      id: 'test',
      target: 'block:check-test',
      text: {
        fr: '[si … sinon] : si le choix vaut « 8 », on écrit « Bravo » en vert ; sinon, la bonne réponse en rouge.',
        en: '[if … else]: if the choice is “8”, we write “Well done” in green; else, the right answer in red.',
      },
    },
    ...slow('check-test', {
      fr: 'Touche une réponse dans l’aperçu : regarde le [si] s’allumer, puis une seule des deux branches.',
      en: 'Tap an answer in the preview: watch the [if] light up, then only one of the two branches.',
    }),
  ],
  2: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 2, cinq questions ! Clique sur **Nouveau** pour voir ce qui a changé.',
        en: 'In level 2, five questions! Click **New** to see what changed.',
      },
    },
    {
      id: 'lists',
      target: 'block:open',
      text: {
        fr: 'Une **liste** range plusieurs valeurs dans une seule variable : les questions, les réponses possibles, les bonnes réponses.',
        en: 'A **list** keeps several values in one variable: the questions, the possible answers, the right answers.',
      },
    },
    {
      id: 'index',
      target: 'block:show-question',
      text: {
        fr: '[élément n° … de la liste] lit une case. La variable **index** dit laquelle : 1, puis 2, puis 3…',
        en: '[item # … of the list] reads one slot. The **index** variable says which one: 1, then 2, then 3…',
      },
    },
    {
      id: 'split',
      target: 'block:show-options',
      text: {
        fr: '« 6|8|10 » est coupé à chaque | : on obtient une liste de 3 réponses, une par bouton.',
        en: '“6|8|10” is cut at each |: we get a list of 3 answers, one per button.',
      },
    },
    {
      id: 'next',
      target: 'block:next',
      text: {
        fr: 'Le bouton ajoute 1 à l’index. Après la dernière question, l’index revient à 1.',
        en: 'The button adds 1 to the index. After the last question, the index goes back to 1.',
      },
    },
    ...slow('show-question', {
      fr: 'Touche « Question suivante » : la question est relue dans la liste.',
      en: 'Tap “Next question”: the question is read from the list again.',
    }),
  ],
  3: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 3, 10 secondes par question, un score, et un écran de résultats à la fin.',
        en: 'In level 3, 10 seconds per question, a score, and a results screen at the end.',
      },
    },
    {
      id: 'tick',
      target: 'block:tick',
      text: {
        fr: 'Le minuteur **Chrono** sonne chaque seconde : le temps baisse de 1, la barre aussi. À 0, c’est trop tard.',
        en: 'The **Clock** timer rings every second: the time goes down by 1, the bar too. At 0, it’s too late.',
      },
    },
    {
      id: 'once',
      target: 'block:check-once',
      text: {
        fr: 'La variable **répondu** (vrai ou faux) empêche de répondre deux fois à la même question.',
        en: 'The **answered** variable (true or false) stops you answering the same question twice.',
      },
    },
    {
      id: 'point',
      target: 'block:check-point',
      text: { fr: 'Une bonne réponse : un point.', en: 'A right answer: one point.' },
    },
    {
      id: 'results',
      target: 'block:next-end',
      text: {
        fr: 'Après la dernière question, on ouvre l’écran **Résultats**. Choisis-le dans la liste des écrans pour voir ses blocs.',
        en: 'After the last question, we open the **Results** screen. Pick it in the list of screens to see its blocks.',
      },
    },
    ...slow('tick-down', {
      fr: 'Regarde [modifier temps de -1] s’allumer chaque seconde.',
      en: 'Watch [change timeLeft by -1] light up every second.',
    }),
  ],
  4: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 4, on choisit un thème, les questions sont mélangées, et chaque thème a son record.',
        en: 'In level 4, you pick a theme, the questions are shuffled, and each theme has its record.',
      },
    },
    {
      id: 'load',
      target: 'block:load',
      text: {
        fr: 'Le thème est un numéro. Le thème 1 est chargé d’abord ; [si] le thème vaut 2 ou 3, ses listes le remplacent.',
        en: 'The theme is a number. Theme 1 is loaded first; [if] the theme is 2 or 3, its lists replace it.',
      },
    },
    {
      id: 'fill',
      target: 'block:mix-fill',
      text: {
        fr: 'Pour mélanger, on ne bouge pas les questions : on fait une liste **ordre** : 1, 2, 3, 4, 5…',
        en: 'To shuffle, we don’t move the questions: we make an **order** list: 1, 2, 3, 4, 5…',
      },
    },
    {
      id: 'mix',
      target: 'block:mix-loop',
      text: {
        fr: '… puis, de la dernière place à la 2ᵉ, on échange chaque place avec une place au hasard avant elle. C’est l’algorithme de **Fisher-Yates** : chaque ordre a autant de chances.',
        en: '… then, from the last place to the 2nd, we swap each place with a random place before it. It is the **Fisher-Yates** algorithm: every order has the same chance.',
      },
    },
    {
      id: 'pick',
      target: 'block:show-pick',
      text: {
        fr: 'La question n° index est celle de l’ordre mélangé.',
        en: 'Question number index is the one in the shuffled order.',
      },
    },
    {
      id: 'record',
      target: 'block:next-record',
      text: {
        fr: 'La liste **records** est *stockée* : le téléphone garde un record par thème.',
        en: 'The **records** list is *stored*: the phone keeps a record per theme.',
      },
    },
    ...slow('mix-swap2', {
      fr: 'Regarde les échanges s’allumer : 4 échanges pour 5 questions.',
      en: 'Watch the swaps light up: 4 swaps for 5 questions.',
    }),
  ],
}

const CHALLENGES = {
  1: [
    {
      id: 'question',
      block: 'check-test',
      check: {
        kind: 'all',
        of: [
          {
            kind: 'not',
            of: {
              kind: 'prop',
              type: 'Text',
              prop: 'text',
              contains: { fr: 'araignée', en: 'spider' },
            },
          },
          { kind: 'blockField', id: 'check-test/if0/b', field: 'TEXT', not: '8' },
        ],
      },
      text: {
        fr: 'Change la question (dans Design) et sa bonne réponse (dans le [si]).',
        en: 'Change the question (in Design) and its right answer (in the [if]).',
      },
      hint: {
        fr: 'Par exemple : « Combien de roues a un vélo ? », réponses 1, 2, 3, et « 2 » dans le [si].',
        en: 'For example: “How many wheels does a bike have?”, answers 1, 2, 3, and “2” in the [if].',
      },
    },
    {
      id: 'cheer',
      block: 'check-yes',
      check: {
        kind: 'blockField',
        id: 'check-yes/value',
        field: 'TEXT',
        not: { fr: 'Bravo ! 🎉', en: 'Well done! 🎉' },
      },
      text: { fr: 'Écris ton propre message de victoire.', en: 'Write your own winning message.' },
      hint: { fr: 'Change le texte « Bravo ! 🎉 ».', en: 'Change the text “Well done! 🎉”.' },
    },
    {
      id: 'toast',
      block: 'check-test',
      check: { kind: 'block', type: 'rx_ui_toast', within: 'check-test' },
      text: {
        fr: 'Affiche aussi un message bref quand c’est gagné.',
        en: 'Also show a short message when it’s right.',
      },
      hint: {
        fr: 'Le bloc est dans la catégorie Interface.',
        en: 'The block is in the Interface category.',
      },
    },
  ],
  2: [
    {
      id: 'sixth',
      block: 'open-questions',
      check: {
        kind: 'all',
        of: [
          { kind: 'block', type: 'text', within: 'open-questions', min: 6 },
          { kind: 'block', type: 'text', within: 'open-choices', min: 6 },
          { kind: 'block', type: 'text', within: 'open-answers', min: 6 },
        ],
      },
      text: {
        fr: 'Ajoute une 6ᵉ question, ses réponses et sa bonne réponse.',
        en: 'Add a 6th question, its answers and its right answer.',
      },
      hint: {
        fr: 'Clique sur la roue des blocs [créer une liste avec] pour ajouter une case aux trois listes.',
        en: 'Click the gear of the [create list with] blocks to add a slot to the three lists.',
      },
    },
    {
      id: 'of',
      block: 'show-counter',
      check: { kind: 'blockField', id: 'show-counter/value/add2', field: 'TEXT', not: ' / ' },
      text: {
        fr: 'Écris « Question 1 sur 5 » au lieu de « 1 / 5 ».',
        en: 'Write “Question 1 of 5” instead of “1 / 5”.',
      },
      hint: {
        fr: 'Change le texte « / » dans « afficher la question ».',
        en: 'Change the text “/” in “show the question”.',
      },
    },
    {
      id: 'color',
      block: 'check-no-color',
      check: { kind: 'blockField', id: 'check-no-color/value', field: 'COLOUR', not: '#cc0000' },
      text: {
        fr: 'Choisis une autre couleur pour « Raté ».',
        en: 'Choose another colour for “Wrong”.',
      },
      hint: { fr: 'Clique sur la pastille de couleur rouge.', en: 'Click the red colour swatch.' },
    },
  ],
  3: [
    {
      id: 'longer',
      block: 'show-time',
      check: { kind: 'blockField', id: 'show-time/value', field: 'NUM', equals: 15 },
      text: { fr: 'Donne 15 secondes par question.', en: 'Give 15 seconds per question.' },
      hint: {
        fr: 'C’est [mettre temps à 10] dans « afficher la question ».',
        en: 'It is [set timeLeft to 10] in “show the question”.',
      },
    },
    {
      id: 'double',
      block: 'check-point',
      check: { kind: 'blockField', id: 'check-point/delta', field: 'NUM', equals: 2 },
      text: { fr: 'Donne 2 points par bonne réponse.', en: 'Give 2 points per right answer.' },
      hint: { fr: 'Regarde [modifier score de 1].', en: 'Look at [change score by 1].' },
    },
    {
      id: 'late',
      block: 'tick-zero',
      check: { kind: 'block', type: 'rx_ui_toast', within: 'tick-zero' },
      text: {
        fr: 'Affiche un message bref quand le temps est fini.',
        en: 'Show a short message when time is up.',
      },
      hint: {
        fr: 'Pose-le dans le [si] de « quand Chrono sonne ».',
        en: 'Put it in the [if] of “when Clock rings”.',
      },
    },
  ],
  4: [
    {
      id: 'space',
      block: 'space-questions',
      check: {
        kind: 'all',
        of: [
          { kind: 'block', type: 'text', within: 'space-questions', min: 6 },
          { kind: 'block', type: 'text', within: 'space-choices', min: 6 },
          { kind: 'block', type: 'text', within: 'space-answers', min: 6 },
        ],
      },
      text: {
        fr: 'Ajoute une question au thème de l’espace.',
        en: 'Add a question to the space theme.',
      },
      hint: {
        fr: 'Elles sont dans « choisir les questions ».',
        en: 'They are in “pick the questions”.',
      },
    },
    {
      id: 'three',
      block: 'next-end',
      check: { kind: 'block', type: 'math_number', fields: { NUM: 3 }, within: 'next-end' },
      text: {
        fr: 'Des parties de 3 questions : arrête après la 3ᵉ.',
        en: 'Games of 3 questions: stop after the 3rd.',
      },
      hint: {
        fr: 'Dans « passer à la question suivante », compare l’index avec 3 au lieu de la longueur de la liste.',
        en: 'In “go to the next question”, compare the index with 3 instead of the length of the list.',
      },
    },
    {
      id: 'cheer',
      block: 'next-record',
      check: { kind: 'block', type: 'rx_ui_toast', within: 'next-record' },
      text: {
        fr: 'Affiche « Nouveau record ! » quand il y en a un.',
        en: 'Show “New record!” when there is one.',
      },
      hint: {
        fr: 'Un message bref dans le [si] du record.',
        en: 'A short message in the record [if].',
      },
    },
  ],
}

export const bigQuiz: AppSource = {
  id: 'big-quiz',
  order: 3,
  kind: 'quiz',
  icon: '❓',
  accent: 'yellow',
  title: { fr: 'Le grand quiz', en: 'The Big Quiz' },
  summary: {
    fr: 'Un quiz à trois réponses, avec un chrono, un score et des thèmes.',
    en: 'A three-answer quiz, with a clock, a score and themes.',
  },
  level,
}
