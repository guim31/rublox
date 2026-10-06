import type { fr } from './fr/index.ts'

/** French is the reference: every other language has exactly the same keys. */
type Strings<T> = { [K in keyof T]: T[K] extends string ? string : Strings<T[K]> }

export type Messages = Strings<typeof fr>
