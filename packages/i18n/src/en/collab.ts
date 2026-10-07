/** Strings of the J4b: editing a project with several people at once (SPEC § 4.9). */
export const collab = {
  presence: {
    label: 'Who is in the project',
    count_one: '{{count}} other person in the project',
    count_other: '{{count}} other people in the project',
    title: 'In the project right now',
    where: '{{tab}} · {{screen}}',
    nowhere: 'Arriving…',
    readOnly: 'Only looking',
    join: 'Go there',
    joinHint: 'Opens the screen {{name}} is on',
    more: '+{{count}}',
    tabs: { design: 'Design', blocks: 'Blocks' },
    app: 'App',
    selects: '{{name}} picked this component',
    onBlock: '{{name}} is on this stack',
  },
  conflict: {
    title: 'Stack changed by {{name}}',
    text: 'You both changed the same stack of blocks at once: {{name}}’s version, saved last, is kept.',
    someone: 'someone',
    show: 'Show',
  },
}
