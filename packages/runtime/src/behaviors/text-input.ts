import type { Behavior } from './types.ts'

export type FocusHandle = { focus(): void }

export const textInputBehavior: Behavior = {
  methods: {
    clear: (ctx) => ctx.set('text', ''),
    focus: (ctx) => ctx.handle<FocusHandle>()?.focus(),
  },
}
