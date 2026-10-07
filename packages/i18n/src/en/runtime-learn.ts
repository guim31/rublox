import type { runtimeLearning as fr } from '../fr/runtime-learn.ts'

/** Runtime strings added by J3: errors explained for children (SPEC § 4.3). */
export const runtimeLearning: { [K in keyof typeof fr]: Record<keyof (typeof fr)[K], string> } = {
  friendly: {
    listIndex: 'The list only has {{length}} item(s), and this block asks for the {{nth}}.',
    emptyList: 'The list is empty, and this block asks for its {{nth}} item.',
    notAList: 'This block expects a list, but it got something else.',
    badLength: 'This block asks for a list of an impossible length (negative or too big).',
    emptyValueProperty:
      'This block looks for “{{property}}” in an empty value: check that a variable got a value.',
    badJson: 'This text is not valid JSON.',
    unknownName: 'This block uses a name that does not exist (a deleted function or variable?).',
  },
}
