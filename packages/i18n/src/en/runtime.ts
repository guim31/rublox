import type { Messages } from '../types.ts'
import { runtimeLearning } from './runtime-learn.ts'

export const runtime: Omit<Messages['runtime'], 'game'> = {
  ...runtimeLearning,
  ok: 'OK',
  cancel: 'Cancel',
  yes: 'Yes',
  no: 'No',
  back: 'Back',
  imagePlaceholder: 'Image',
  stopped: 'The app is stopped.',
  restart: 'Restart',
  noScreen: 'This screen does not exist: {{name}}',
  errors: {
    unknownProperty: '{{component}} has no property “{{property}}”.',
    invalidValue: '“{{value}}” does not fit {{component}}.{{property}}.',
    notAFunction: 'This block tries to use something that is not an action.',
    undefinedValue: 'This block uses an empty value: check that a variable was given a value.',
    tooMuchRecursion: 'A function keeps calling itself forever.',
    generic: 'Error: {{message}}',
  },
}
