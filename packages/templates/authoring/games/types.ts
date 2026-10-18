import type { Block, Text } from '../dsl.ts'

export type ComponentSource = {
  key: string
  type: string
  name?: Text
  props?: Record<string, unknown>
  children?: ComponentSource[]
}

/** A picture (SVG text) or a sound (WAV bytes) of a game, named in both languages. */
export type ArtSource = { name: Text; svg: string }
export type SoundSource = { name: Text; wav: Uint8Array }

/** A game template (J10), written with the language of `dsl.ts`. */
export type GameSource = {
  id: string
  order: number
  mode: 'junior' | 'studio'
  icon: string
  accent: 'indigo' | 'coral' | 'yellow' | 'mint'
  title: Text
  description: Text
  theme?: Record<string, unknown>
  variables: { key: string; name: Text; kind?: 'app' | 'stored'; initial?: unknown }[]
  /** The screen's name, its components (the scene, the sounds) and its stacks of blocks. */
  screen: { key: string; name: Text; props?: Record<string, unknown> }
  components: ComponentSource[]
  blocks: Block[]
  /** Pictures and sounds, by key (`asset:<key>` in properties). */
  art: Record<string, ArtSource>
  sounds: Record<string, SoundSource>
  /** An animated picture of the game for the "New project" dialog (SVG with CSS animation). */
  cover: string
}
