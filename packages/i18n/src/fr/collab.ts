/** Strings of the J4b: editing a project with several people at once (SPEC § 4.9). */
export const collab = {
  presence: {
    label: 'Qui est dans le projet',
    count_one: '{{count}} autre personne dans le projet',
    count_other: '{{count}} autres personnes dans le projet',
    title: 'Dans le projet en ce moment',
    where: '{{tab}} · {{screen}}',
    nowhere: 'Arrive…',
    readOnly: 'Regarde seulement',
    join: 'Aller voir',
    joinHint: 'Ouvre l’écran où se trouve {{name}}',
    more: '+{{count}}',
    tabs: { design: 'Design', blocks: 'Blocs' },
    app: 'Appli',
    selects: '{{name}} a choisi ce composant',
    onBlock: '{{name}} est sur cette pile',
  },
  conflict: {
    title: 'Pile modifiée par {{name}}',
    text: 'Vous avez changé la même pile de blocs en même temps : c’est la version de {{name}}, enregistrée en dernier, qui est gardée.',
    someone: 'quelqu’un',
    show: 'Montrer',
  },
}
