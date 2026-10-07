import { blocklyJsonSchema, themeSchema, uiModeSchema } from '@rublox/schema'
import { z } from 'zod'

/**
 * An app recipe (`AppSpec`): screens, components, variables and blocks, written by people
 * (the templates of `content/templates/`) or proposed by the AI assistant. `buildProject`
 * turns it into a `ProjectDoc`: it gives the ids, resolves the names, and refuses anything the
 * catalog or the blocks do not know.
 *
 * Any string may be localized, `{ "fr": "…", "en": "…" }`: the recipe is built in one
 * language. In blocks, a component, a screen or a variable is named by its `key` (or its
 * name) instead of an id: `"fields": { "COMPONENT": "roll" }`, `"VAR": "score"`.
 */

const localized = <T extends z.ZodType>(value: T) =>
  z.union([value, z.object({ fr: value, en: value }).strict()])

export const localizedText = localized(z.string())

export type ComponentSpec = {
  /** A stable name for the blocks of the recipe (defaults to the name). */
  key?: string
  type: string
  name?: z.infer<typeof localizedText>
  props?: Record<string, unknown>
  children?: ComponentSpec[]
}

export const componentSpecSchema: z.ZodType<ComponentSpec> = z.lazy(() =>
  z
    .object({
      key: z.string().min(1).max(64).optional(),
      type: z.string().min(1).max(64),
      name: localizedText.optional(),
      props: z.record(z.string(), z.unknown()).optional(),
      children: z.array(componentSpecSchema).max(200).optional(),
    })
    .strict(),
)

export const screenSpecSchema = z
  .object({
    key: z.string().min(1).max(64).optional(),
    name: localizedText,
    /** Properties of the screen itself (its background, its padding…). */
    props: z.record(z.string(), z.unknown()).optional(),
    /** The visible components of the screen, in order, and its invisible ones. */
    components: z.array(componentSpecSchema).max(200).default([]),
    /** Stacks of blocks of the screen (Blockly JSON, see above). */
    blocks: z.array(blocklyJsonSchema).max(200).default([]),
    /** Icon and label in the tab bar or the drawer. */
    navIcon: z.string().max(40).optional(),
    navLabel: localizedText.optional(),
  })
  .strict()

export const variableSpecSchema = z
  .object({
    key: z.string().min(1).max(64).optional(),
    name: localizedText,
    /** `stored` variables are kept on the phone. */
    kind: z.enum(['app', 'stored']).default('app'),
    initial: z.unknown().optional(),
  })
  .strict()

export const appSpecSchema = z
  .object({
    name: localizedText,
    description: localizedText.optional(),
    mode: uiModeSchema.optional(),
    theme: themeSchema.partial().optional(),
    navigation: z.enum(['stack', 'tabs', 'drawer']).default('stack'),
    variables: z.array(variableSpecSchema).max(100).default([]),
    screens: z.array(screenSpecSchema).min(1).max(12),
    /** Stacks of the `app` workspace (app start, shared functions). */
    appBlocks: z.array(blocklyJsonSchema).max(100).default([]),
  })
  .strict()

export type AppSpec = z.input<typeof appSpecSchema>
export type ParsedAppSpec = z.output<typeof appSpecSchema>
export type ScreenSpec = z.output<typeof screenSpecSchema>
export type VariableSpec = z.output<typeof variableSpecSchema>
