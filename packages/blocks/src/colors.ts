/**
 * Category colours, shared by the toolbox, the blocks, the component palette and the help
 * (SPEC § 5.5). Blocks draw white text on them: keep them saturated and dark enough.
 */
export const CATEGORY_COLORS = {
  events: '#c77c0e',
  components: '#0f8f7f',
  control: '#d9770f',
  logic: '#3b6fd8',
  math: '#2a9454',
  text: '#c23a8c',
  lists: '#7b4fd6',
  variables: '#d9543a',
  functions: '#a23fbf',
  screens: '#5b4bff',
  interface: '#1883b8',
  debug: '#5d6b7e',
  colour: '#b0396b',
  data: '#a35f00',
  objects: '#4f6d2a',
} as const

export type BlockCategory = keyof typeof CATEGORY_COLORS
