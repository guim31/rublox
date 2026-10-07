import {
  type Block,
  between,
  call,
  change,
  choose,
  cmp,
  emptyList,
  fn,
  forEach,
  join,
  math,
  named,
  note,
  num,
  on,
  prop,
  push,
  round,
  run,
  set,
  setVar,
  str,
  v,
  when,
} from './dsl.ts'
import type { AppSource, ComponentSource, LevelSource, TourStepSource } from './types.ts'

/**
 * Ma tirelire (My Piggy Bank), a tool. Level 1: add money. Level 2: spending, and the balance
 * computed by a loop over every movement. Level 3: a savings goal and a progress bar.
 * Level 4: a chart (J5) and the history kept on the phone.
 */

const SHOW = { fr: 'afficher le solde', en: 'show the balance' }

/** "× 1": what is typed is a text; multiplying makes it a number. */
const typed = (input: string, id: string) =>
  named(id, math(prop('TextInput', input, 'text'), '×', num(1)))

function components(n: number): ComponentSource[] {
  return [
    {
      key: 'title',
      type: 'Text',
      name: { fr: 'Titre', en: 'Title' },
      props: {
        text: { fr: '🐷 Ma tirelire', en: '🐷 My piggy bank' },
        fontSize: 26,
        bold: true,
        align: 'center',
      },
    },
    {
      key: 'balance',
      type: 'Text',
      name: { fr: 'Solde', en: 'Balance' },
      props: { text: '0 €', fontSize: 44, bold: true, align: 'center', color: '@primary' },
    },
    ...(n >= 3
      ? [
          {
            key: 'goalBox',
            type: 'Box',
            name: { fr: 'CadreObjectif', en: 'GoalBox' },
            props: { padding: 12, gap: 8, radius: 16, background: '@surface' },
            children: [
              {
                key: 'goalText',
                type: 'Text',
                name: { fr: 'TexteObjectif', en: 'GoalText' },
                props: { text: { fr: 'Objectif : 20 €', en: 'Goal: 20 €' }, bold: true },
              },
              {
                key: 'goalBar',
                type: 'ProgressBar',
                name: { fr: 'BarreObjectif', en: 'GoalBar' },
                props: { value: 0, thickness: 14 },
              },
              {
                key: 'goalLeft',
                type: 'Text',
                name: { fr: 'TexteReste', en: 'LeftText' },
                props: { text: { fr: 'Encore 20 €', en: '20 € to go' }, fontSize: 14 },
              },
            ],
          },
        ]
      : []),
    {
      key: 'amount',
      type: 'TextInput',
      name: { fr: 'Montant', en: 'Amount' },
      props: { inputType: 'number', placeholder: { fr: 'Combien ?', en: 'How much?' } },
    },
    {
      key: 'actions',
      type: 'Row',
      name: { fr: 'Boutons', en: 'Buttons' },
      props: { gap: 12 },
      children: [
        {
          key: 'add',
          type: 'Button',
          name: { fr: 'Ajouter', en: 'Add' },
          props: { text: { fr: '+ Ajouter', en: '+ Add' }, grow: true },
        },
        ...(n >= 2
          ? [
              {
                key: 'spend',
                type: 'Button',
                name: { fr: 'Depenser', en: 'Spend' },
                props: {
                  text: { fr: '− Dépenser', en: '− Spend' },
                  grow: true,
                  variant: 'outline',
                },
              },
            ]
          : []),
      ],
    },
    ...(n >= 3
      ? [
          {
            key: 'goalRow',
            type: 'Row',
            name: { fr: 'LigneObjectif', en: 'GoalRow' },
            props: { gap: 8, alignItems: 'center' },
            children: [
              {
                key: 'goalInput',
                type: 'TextInput',
                name: { fr: 'NouvelObjectif', en: 'NewGoal' },
                props: {
                  inputType: 'number',
                  placeholder: { fr: 'Objectif', en: 'Goal' },
                  grow: true,
                },
              },
              {
                key: 'setGoal',
                type: 'Button',
                name: { fr: 'ChangerObjectif', en: 'SetGoal' },
                props: { text: { fr: '🎯 Changer', en: '🎯 Set' }, variant: 'outline' },
              },
            ],
          },
        ]
      : []),
    ...(n >= 4
      ? [
          {
            key: 'chart',
            type: 'Chart',
            name: { fr: 'Graphique', en: 'Chart' },
            props: {
              chartType: 'line',
              title: { fr: 'Mon solde', en: 'My balance' },
              points: [],
              height: 180,
            },
          },
        ]
      : []),
    ...(n >= 2
      ? [
          {
            key: 'history',
            type: 'ListView',
            name: { fr: 'Historique', en: 'History' },
            props: { items: [] },
          },
        ]
      : []),
  ]
}

function blocks(n: number): Block[] {
  const stacks: Block[] = []
  stacks.push(
    note(on('open', 'Screen', 'bank', 'open', [run('open-show', SHOW)]), {
      fr: n >= 4 ? 'À l’ouverture : le solde gardé sur le téléphone.' : 'À l’ouverture : le solde.',
      en: n >= 4 ? 'When it opens: the balance kept on the phone.' : 'When it opens: the balance.',
    }),
    note(
      on('add', 'Button', 'add', 'click', [
        n >= 2
          ? note(push('add-money', 'moves', typed('amount', 'add-amount')), {
              fr: 'On note le mouvement dans la liste.',
              en: 'We write the movement in the list.',
            })
          : note(change('add-money', 'total', typed('amount', 'add-amount')), {
              fr: '« × 1 » change le texte tapé en nombre.',
              en: '“× 1” turns the typed text into a number.',
            }),
        run('add-show', SHOW),
        call('add-clear', 'TextInput', 'amount', 'clear'),
      ]),
      { fr: 'Ajouter ce qui est tapé.', en: 'Add what is typed.' },
    ),
  )
  if (n >= 2) {
    stacks.push(
      note(
        on('spend', 'Button', 'spend', 'click', [
          note(push('spend-money', 'moves', math(num(0), '-', typed('amount', 'spend-amount'))), {
            fr: 'Une dépense est un nombre négatif.',
            en: 'Spending is a negative number.',
          }),
          run('spend-show', SHOW),
          call('spend-clear', 'TextInput', 'amount', 'clear'),
        ]),
        {
          fr: 'Dépenser : on note le montant en moins.',
          en: 'Spend: we write the amount as a minus.',
        },
      ),
    )
  }

  const balance = set('show-balance', 'Text', 'balance', 'text', join(v('total'), str(' €')))
  const show: Block[] =
    n >= 2
      ? [
          note(setVar('show-reset', 'total', num(0)), {
            fr: 'On recompte depuis 0…',
            en: 'Count again from 0…',
          }),
          ...(n >= 4
            ? [
                setVar('show-labels-reset', 'labels', emptyList()),
                setVar('show-step', 'step', num(0)),
                call('show-chart-clear', 'Chart', 'chart', 'clear'),
              ]
            : []),
          note(
            forEach('show-loop', 'move', v('moves'), [
              change('show-sum', 'total', v('move')),
              ...(n >= 4
                ? [
                    change('show-count', 'step', 1),
                    note(
                      push(
                        'show-label',
                        'labels',
                        join(
                          choose(cmp(v('move'), '>', num(0)), str('+'), str('')),
                          v('move'),
                          str(' €'),
                        ),
                      ),
                      { fr: '« +5 € » ou « -3 € ».', en: '“+5 €” or “-3 €”.' },
                    ),
                    note(call('show-point', 'Chart', 'chart', 'addPoint', v('step'), v('total')), {
                      fr: 'Un point : le solde après ce mouvement.',
                      en: 'A point: the balance after this movement.',
                    }),
                  ]
                : []),
            ]),
            {
              fr: '… en ajoutant chaque mouvement de la liste.',
              en: '… adding each movement of the list.',
            },
          ),
          balance,
          set('show-history', 'ListView', 'history', 'items', n >= 4 ? v('labels') : v('moves')),
          ...(n >= 3
            ? [
                set(
                  'show-goal-text',
                  'Text',
                  'goalText',
                  'text',
                  join(str({ fr: 'Objectif : ', en: 'Goal: ' }), v('goal'), str(' €')),
                ),
                note(
                  set(
                    'show-bar',
                    'ProgressBar',
                    'goalBar',
                    'value',
                    between(round(math(math(v('total'), '÷', v('goal')), '×', num(100))), 0, 100),
                  ),
                  {
                    fr: 'Le pourcentage : solde ÷ objectif × 100, entre 0 et 100.',
                    en: 'The percentage: total ÷ goal × 100, between 0 and 100.',
                  },
                  260,
                ),
                note(
                  when(
                    'show-reached',
                    cmp(v('total'), '≥', v('goal')),
                    [
                      set(
                        'show-done',
                        'Text',
                        'goalLeft',
                        'text',
                        str({ fr: '🎉 Objectif atteint !', en: '🎉 Goal reached!' }),
                      ),
                    ],
                    [
                      set(
                        'show-left',
                        'Text',
                        'goalLeft',
                        'text',
                        join(
                          str({ fr: 'Encore ', en: '' }),
                          math(v('goal'), '-', v('total')),
                          str({ fr: ' €', en: ' € to go' }),
                        ),
                      ),
                    ],
                  ),
                  { fr: 'Atteint, ou combien il manque.', en: 'Reached, or how much is missing.' },
                ),
              ]
            : []),
        ]
      : [balance]
  stacks.push(
    note(fn('show', SHOW, show), {
      fr: n >= 2 ? 'Le solde n’est jamais gardé : on le recalcule.' : 'Écrit le solde en grand.',
      en:
        n >= 2 ? 'The balance is never kept: it is computed again.' : 'Writes the balance in big.',
    }),
  )
  if (n >= 3) {
    stacks.push(
      note(
        on('set-goal', 'Button', 'setGoal', 'click', [
          when('goal-check', cmp(typed('goalInput', 'goal-typed'), '>', num(0)), [
            setVar('goal-set', 'goal', typed('goalInput', 'goal-value')),
            run('goal-show', SHOW),
            call('goal-clear', 'TextInput', 'goalInput', 'clear'),
          ]),
        ]),
        {
          fr: 'Un nouvel objectif, s’il est plus grand que 0.',
          en: 'A new goal, if it is above 0.',
        },
      ),
    )
  }
  return stacks
}

function level(n: 1 | 2 | 3 | 4): LevelSource {
  const kept = n >= 4 ? ('stored' as const) : ('app' as const)
  return {
    title: TITLES[n],
    summary: SUMMARIES[n],
    done: DONE[n],
    theme: { primary: '#0ca678', font: 'rounded' },
    variables: [
      { key: 'total', name: { fr: 'solde', en: 'total' }, initial: 0 },
      ...(n >= 2
        ? [
            { key: 'moves', name: { fr: 'mouvements', en: 'moves' }, kind: kept, initial: [] },
            { key: 'move', name: { fr: 'mouvement', en: 'move' }, initial: 0 },
          ]
        : []),
      ...(n >= 3
        ? [{ key: 'goal', name: { fr: 'objectif', en: 'goal' }, kind: kept, initial: 20 }]
        : []),
      ...(n >= 4
        ? [
            { key: 'labels', name: { fr: 'lignes', en: 'labels' }, initial: [] },
            { key: 'step', name: { fr: 'numero', en: 'step' }, initial: 0 },
          ]
        : []),
    ],
    screens: [
      {
        key: 'bank',
        name: { fr: 'Tirelire', en: 'PiggyBank' },
        props: { padding: 20, gap: 14 },
        components: components(n),
        blocks: blocks(n),
      },
    ],
    tour: TOURS[n],
    challenges: CHALLENGES[n],
  }
}

const TITLES = {
  1: { fr: 'Ajouter de l’argent', en: 'Adding money' },
  2: { fr: 'Dépenses et solde', en: 'Spending and balance' },
  3: { fr: 'Un objectif', en: 'A goal' },
  4: { fr: 'Graphique et historique', en: 'Chart and history' },
}
const SUMMARIES = {
  1: {
    fr: 'Une case, un bouton, et une variable « solde » qui grandit.',
    en: 'A box, a button, and a “total” variable that grows.',
  },
  2: {
    fr: 'Chaque mouvement est noté dans une liste ; une boucle calcule le solde.',
    en: 'Each movement goes in a list; a loop computes the balance.',
  },
  3: {
    fr: 'Un objectif d’épargne, une barre de progression et un pourcentage.',
    en: 'A savings goal, a progress bar and a percentage.',
  },
  4: {
    fr: 'Un graphique du solde, et un historique gardé sur le téléphone.',
    en: 'A chart of the balance, and a history kept on the phone.',
  },
}
const DONE = {
  1: {
    fr: 'Tu sais comment la tirelire ajoute ce que tu tapes.',
    en: 'You know how the piggy bank adds what you type.',
  },
  2: {
    fr: 'Tu as vu une liste et une boucle « pour chaque ».',
    en: 'You saw a list and a “for each” loop.',
  },
  3: {
    fr: 'Tu as vu un calcul de pourcentage et un « si … sinon ».',
    en: 'You saw a percentage and an “if … else”.',
  },
  4: {
    fr: 'Tu as vu un graphique et des variables gardées sur le téléphone.',
    en: 'You saw a chart and variables kept on the phone.',
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
      fr: 'Tape un nombre dans l’aperçu, puis touche « + Ajouter ».',
      en: 'Type a number in the preview, then tap “+ Add”.',
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
        fr: 'Voici **Ma tirelire** ! Tape un nombre dans l’aperçu et touche « + Ajouter ».',
        en: 'Here is **My piggy bank**! Type a number in the preview and tap “+ Add”.',
      },
    },
    {
      id: 'add',
      target: 'block:add',
      text: {
        fr: 'Quand on touche « Ajouter », la variable **solde** grandit de ce qui est tapé.',
        en: 'When “Add” is tapped, the **total** variable grows by what is typed.',
      },
    },
    {
      id: 'number',
      target: 'block:add-money',
      text: {
        fr: 'Ce qu’on tape est un **texte**. « × 1 » le change en **nombre** : sinon 2 + 3 ferait « 23 » !',
        en: 'What you type is a **text**. “× 1” turns it into a **number**: else 2 + 3 would make “23”!',
      },
    },
    {
      id: 'show',
      target: 'block:show',
      text: {
        fr: 'La fonction écrit le solde suivi de « € ».',
        en: 'The function writes the total followed by “€”.',
      },
    },
    ...slow('add-money', {
      fr: 'Ajoute de l’argent dans l’aperçu : [modifier solde de …] s’allume.',
      en: 'Add money in the preview: [change total by …] lights up.',
    }),
  ],
  2: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 2, on peut aussi dépenser. Clique sur **Nouveau** pour voir ce qui a changé.',
        en: 'In level 2, you can also spend. Click **New** to see what changed.',
      },
    },
    {
      id: 'push',
      target: 'block:add-money',
      text: {
        fr: 'On n’ajoute plus au solde : on note chaque **mouvement** au bout d’une liste.',
        en: 'We no longer add to the total: we write each **movement** at the end of a list.',
      },
    },
    {
      id: 'spend',
      target: 'block:spend-money',
      text: {
        fr: 'Une dépense est notée en négatif : 0 − montant.',
        en: 'Spending is written as a negative: 0 − amount.',
      },
    },
    {
      id: 'loop',
      target: 'block:show-loop',
      text: {
        fr: 'La boucle [pour chaque] passe sur chaque mouvement et l’ajoute au solde, qui repart de 0.',
        en: 'The [for each] loop goes over each movement and adds it to the total, which starts from 0.',
      },
    },
    ...slow('show-sum', {
      fr: 'Ajoute deux fois de l’argent : la boucle s’allume une fois par mouvement.',
      en: 'Add money twice: the loop lights up once per movement.',
    }),
  ],
  3: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 3, un objectif d’épargne et une barre qui se remplit.',
        en: 'In level 3, a savings goal and a bar that fills up.',
      },
    },
    {
      id: 'bar',
      target: 'block:show-bar',
      text: {
        fr: 'Le **pourcentage** : solde ÷ objectif × 100. 10 € sur 20 €, c’est 50 : la barre est à moitié pleine.',
        en: 'The **percentage**: total ÷ goal × 100. 10 € out of 20 € is 50: the bar is half full.',
      },
    },
    {
      id: 'min',
      target: 'block:show-bar',
      text: {
        fr: '[limiter … entre 0 et 100] : la barre ne passe jamais sous 0 ni au-dessus de 100.',
        en: '[constrain … low 0 high 100]: the bar never goes below 0 or above 100.',
      },
    },
    {
      id: 'reached',
      target: 'block:show-reached',
      text: {
        fr: 'Si le solde atteint l’objectif, on fête ; sinon, on dit combien il manque.',
        en: 'If the total reaches the goal, we celebrate; else, we say how much is missing.',
      },
    },
    {
      id: 'goal',
      target: 'block:set-goal',
      text: {
        fr: 'Le bouton 🎯 change l’objectif, seulement si le nombre tapé est plus grand que 0.',
        en: 'The 🎯 button changes the goal, only if the number typed is above 0.',
      },
    },
    ...slow('show-bar', {
      fr: 'Ajoute de l’argent : le bloc de la barre s’allume.',
      en: 'Add money: the bar block lights up.',
    }),
  ],
  4: [
    {
      id: 'hello',
      mood: 'wave',
      text: {
        fr: 'Au niveau 4, un graphique, et la tirelire se souvient de tout, même après l’avoir fermée.',
        en: 'In level 4, a chart, and the piggy bank remembers everything, even after closing it.',
      },
    },
    {
      id: 'stored',
      target: 'block:open',
      text: {
        fr: 'Les variables **mouvements** et **objectif** sont maintenant *stockées* : le téléphone les garde. À l’ouverture, on réaffiche tout.',
        en: 'The **moves** and **goal** variables are now *stored*: the phone keeps them. When it opens, we show everything again.',
      },
    },
    {
      id: 'chart',
      target: 'block:show-point',
      text: {
        fr: 'Dans la boucle, chaque mouvement ajoute un point au **graphique** : le solde à ce moment-là.',
        en: 'In the loop, each movement adds a point to the **chart**: the total at that moment.',
      },
    },
    {
      id: 'label',
      target: 'block:show-label',
      text: {
        fr: '[si … alors … sinon …] en bloc rond donne une valeur : « + » pour un ajout, rien pour une dépense (qui a déjà son « - »).',
        en: 'The round [if … then … else …] block gives a value: “+” for money in, nothing for spending (which already has its “-”).',
      },
    },
    ...slow('show-point', {
      fr: 'Ajoute de l’argent : un point s’ajoute pour chaque mouvement.',
      en: 'Add money: a point is added for each movement.',
    }),
  ],
}

const CHALLENGES = {
  1: [
    {
      id: 'euros',
      block: 'show-balance',
      check: { kind: 'blockField', id: 'show-balance/value/add1', field: 'TEXT', not: ' €' },
      text: {
        fr: 'Écris « euros » (ou ta monnaie) au lieu de « € ».',
        en: 'Write “euros” (or your money) instead of “€”.',
      },
      hint: { fr: 'C’est dans « afficher le solde ».', en: 'It is in “show the balance”.' },
    },
    {
      id: 'toast',
      block: 'add',
      check: { kind: 'block', type: 'rx_ui_toast', within: 'add' },
      text: {
        fr: 'Montre un message bref quand tu ajoutes de l’argent.',
        en: 'Show a short message when you add money.',
      },
      hint: {
        fr: 'Le bloc est dans la catégorie Interface.',
        en: 'The block is in the Interface category.',
      },
    },
    {
      id: 'ten',
      block: 'add-money',
      check: {
        kind: 'all',
        of: [
          { kind: 'component', type: 'Button', min: 2 },
          { kind: 'block', type: 'math_change', min: 2 },
        ],
      },
      text: {
        fr: 'Ajoute un bouton « +10 € » qui ajoute 10 au solde.',
        en: 'Add a “+10 €” button that adds 10 to the total.',
      },
      hint: {
        fr: 'Pose un bouton dans Design, puis [quand … est cliqué] avec [modifier solde de 10].',
        en: 'Put a button in Design, then [when … is clicked] with [change total by 10].',
      },
    },
  ],
  2: [
    {
      id: 'toast',
      block: 'spend',
      check: { kind: 'block', type: 'rx_ui_toast', within: 'spend' },
      text: {
        fr: 'Affiche un message bref quand tu dépenses.',
        en: 'Show a short message when you spend.',
      },
      hint: {
        fr: 'Pose-le dans « quand Depenser est cliqué ».',
        en: 'Put it in “when Spend is clicked”.',
      },
    },
    {
      id: 'red',
      block: 'show',
      check: { kind: 'block', type: 'rx_Text_set', fields: { PROP: 'color' }, within: 'show' },
      text: {
        fr: 'Change la couleur du solde dans « afficher le solde ».',
        en: 'Change the colour of the total in “show the balance”.',
      },
      hint: {
        fr: 'Avec un [si], tu peux même le mettre en rouge quand il est sous 0.',
        en: 'With an [if], you can even make it red when it is below 0.',
      },
    },
    {
      id: 'reset',
      block: 'show-reset',
      check: {
        kind: 'all',
        of: [
          { kind: 'component', type: 'Button', min: 3 },
          { kind: 'block', type: 'lists_create_empty' },
        ],
      },
      text: {
        fr: 'Ajoute un bouton « Tout effacer » qui vide la liste.',
        en: 'Add a “Clear all” button that empties the list.',
      },
      hint: {
        fr: '[mettre mouvements à] [créer une liste vide], puis appelle « afficher le solde ».',
        en: '[set moves to] [create empty list], then call “show the balance”.',
      },
    },
  ],
  3: [
    {
      id: 'party',
      block: 'show-reached',
      check: { kind: 'block', type: 'rx_ui_toast', within: 'show-reached' },
      text: {
        fr: 'Fête l’objectif atteint avec un message bref.',
        en: 'Celebrate the goal with a short message.',
      },
      hint: { fr: 'Dans la première branche du [si].', en: 'In the first branch of the [if].' },
    },
    {
      id: 'words',
      block: 'show-done',
      check: {
        kind: 'blockField',
        id: 'show-done/value',
        field: 'TEXT',
        not: { fr: '🎉 Objectif atteint !', en: '🎉 Goal reached!' },
      },
      text: {
        fr: 'Écris ton propre message d’objectif atteint.',
        en: 'Write your own “goal reached” message.',
      },
      hint: {
        fr: 'Change le texte « 🎉 Objectif atteint ! ».',
        en: 'Change the text “🎉 Goal reached!”.',
      },
    },
    {
      id: 'color',
      block: 'show-reached',
      check: {
        kind: 'block',
        type: 'rx_ProgressBar_set',
        fields: { PROP: 'color' },
        within: 'show-reached',
      },
      text: {
        fr: 'Change la couleur de la barre quand l’objectif est atteint.',
        en: 'Change the colour of the bar when the goal is reached.',
      },
      hint: {
        fr: '[mettre couleur de BarreObjectif à …] dans le [si].',
        en: '[set color of GoalBar to …] in the [if].',
      },
    },
  ],
  4: [
    {
      id: 'bars',
      block: 'show-point',
      check: { kind: 'prop', type: 'Chart', prop: 'chartType', equals: 'bar' },
      text: {
        fr: 'Fais un graphique en barres au lieu d’une courbe.',
        en: 'Make a bar chart instead of a line.',
      },
      hint: {
        fr: 'Choisis le graphique dans Design : son type.',
        en: 'Select the chart in Design: its type.',
      },
    },
    {
      id: 'label',
      block: 'show-point',
      check: { kind: 'block', type: 'text_join', within: 'show-point' },
      text: {
        fr: 'Écris « n°1 », « n°2 »… sous les points.',
        en: 'Write “#1”, “#2”… under the points.',
      },
      hint: {
        fr: 'Remplace l’étiquette par [regrouper « n° » numero].',
        en: 'Replace the label with [join “#” step].',
      },
    },
    {
      id: 'count',
      block: 'show',
      check: { kind: 'block', type: 'lists_length' },
      text: {
        fr: 'Montre aussi le nombre de mouvements.',
        en: 'Also show the number of movements.',
      },
      hint: {
        fr: '[longueur de mouvements] donne ce nombre.',
        en: '[length of moves] gives that number.',
      },
    },
  ],
}

export const piggyBank: AppSource = {
  id: 'piggy-bank',
  order: 4,
  kind: 'tool',
  icon: '🐷',
  accent: 'mint',
  title: { fr: 'Ma tirelire', en: 'My Piggy Bank' },
  summary: {
    fr: 'Un utilitaire : note ce que tu gagnes et ce que tu dépenses, et suis ton objectif.',
    en: 'A tool: write down what you get and what you spend, and follow your goal.',
  },
  level,
}
