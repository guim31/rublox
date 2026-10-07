import type { Block, Text } from './dsl.ts'

/** A check of `@rublox/learn` (`Condition`), whose values may be `{ fr, en }`. */
export type Check = Record<string, unknown> & { kind: string }

export type TourStepSource = {
  id: string
  /** `block:<id>`, `slow-motion`, `preview`… (see `Target` in `@rublox/learn`). */
  target?: string
  check?: Check
  mood?: 'happy' | 'wave' | 'think' | 'cheer' | 'oops'
  text: Text
  hint?: Text
}

export type ChallengeSource = {
  id: string
  check: Check
  /** The block the challenge is about: "Show the block". */
  block?: string
  text: Text
  hint: Text
}

export type ComponentSource = {
  key: string
  type: string
  name?: Text
  props?: Record<string, unknown>
  children?: ComponentSource[]
}

export type ScreenSource = {
  key: string
  name: Text
  props?: Record<string, unknown>
  components: ComponentSource[]
  blocks: Block[]
}

export type LevelSource = {
  title: Text
  summary: Text
  /** Shown when the tour is over. */
  done: Text
  theme?: Record<string, unknown>
  variables: { key: string; name: Text; kind?: 'app' | 'stored'; initial?: unknown }[]
  screens: ScreenSource[]
  appBlocks?: Block[]
  tour: TourStepSource[]
  challenges: ChallengeSource[]
}

export type AppSource = {
  id: string
  order: number
  kind: 'game' | 'quiz' | 'tool'
  icon: string
  accent: 'indigo' | 'coral' | 'yellow' | 'mint'
  title: Text
  summary: Text
  /** The four levels, each complete and playable, each taking the previous one up. */
  level(n: 1 | 2 | 3 | 4): LevelSource
}
