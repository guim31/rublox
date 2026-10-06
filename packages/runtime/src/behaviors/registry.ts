import { textInputBehavior } from './text-input.ts'
import type { Behavior } from './types.ts'

/**
 * How each component type behaves while the app runs (SPEC § 6.3), next to its rendering in
 * `RENDERERS`. Types that only show their properties have none.
 */
export const BEHAVIORS: Record<string, Behavior> = {
  TextInput: textInputBehavior,
}
