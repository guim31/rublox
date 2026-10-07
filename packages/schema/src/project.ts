import { z } from 'zod'
import { apiConnectionSchema, tableSchema } from './data.ts'

/** Identifies a Rublox project file, whatever its version. */
export const PROJECT_FORMAT = 'rublox/project'
/** Version written by this code. Older versions go through `migrateProject`. */
export const PROJECT_FORMAT_VERSION = 1

export const LOCALES = ['fr', 'en'] as const
export const UI_MODES = ['junior', 'studio'] as const

export const localeSchema = z.enum(LOCALES)
export const uiModeSchema = z.enum(UI_MODES)

/** Key of a block workspace: a screen id, or `app` for what all screens share. */
export const APP_WORKSPACE = 'app'

const id = z.string().min(1).max(64)

export const themeSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  font: z.enum(['system', 'rounded', 'serif', 'mono']),
  radius: z.number().min(0).max(64),
  scheme: z.enum(['light', 'dark', 'auto']),
})

export const navItemSchema = z.object({
  screen: id,
  icon: z.string().optional(),
  label: z.string().optional(),
})

export const componentNodeSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  /** Only the values that differ from the catalog default. */
  props: z.record(z.string(), z.unknown()),
  children: z.array(id).optional(),
  /** Editor state, ignored when the app runs. */
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
})

export const screenSchema = z.object({
  name: z.string().min(1),
  rootId: id,
  components: z.record(id, componentNodeSchema),
  nonVisual: z.array(id),
})

/** One top block (a stack) as saved by `Blockly.serialization.blocks.save`. */
export const blocklyJsonSchema = z.looseObject({ type: z.string() })

export const varDeclSchema = z.object({
  id,
  name: z.string().min(1),
  initial: z.json().optional(),
})

export const ASSET_KINDS = ['image', 'sound', 'video', 'font', 'lottie', 'file'] as const

export const assetSchema = z.object({
  name: z.string(),
  kind: z.enum(ASSET_KINDS),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})

export const projectMetaSchema = z.object({
  id,
  name: z.string(),
  description: z.string().optional(),
  mode: uiModeSchema,
  /** Language of the app being built: localized defaults are resolved in it. */
  locale: localeSchema,
  /**
   * Where the project comes from (J9): a level of an "app to take apart" (`@rublox/explore`).
   * The editor then offers "Show me what's new" and the level's guided tour.
   */
  origin: z
    .object({
      kind: z.literal('explore'),
      app: z.string().min(1).max(64),
      level: z.number().int().min(1).max(20),
    })
    .optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const projectSettingsSchema = z.object({
  theme: themeSchema,
  navigation: z.object({
    kind: z.enum(['stack', 'tabs', 'drawer']),
    startScreen: id,
    items: z.array(navItemSchema).optional(),
  }),
  orientation: z.enum(['portrait', 'landscape', 'any']),
  icon: id.optional(),
})

export const projectDocSchema = z
  .object({
    format: z.literal(PROJECT_FORMAT),
    formatVersion: z.literal(PROJECT_FORMAT_VERSION),
    meta: projectMetaSchema,
    settings: projectSettingsSchema,
    screenOrder: z.array(id).min(1),
    screens: z.record(id, screenSchema),
    blocks: z.record(z.string(), z.record(id, blocklyJsonSchema)),
    variables: z.object({
      app: z.array(varDeclSchema),
      stored: z.array(varDeclSchema),
      shared: z.array(varDeclSchema),
    }),
    assets: z.record(id, assetSchema),
    data: z.object({
      tables: z.record(id, tableSchema),
      apis: z.record(id, apiConnectionSchema),
    }),
  })
  .superRefine((doc, ctx) => {
    const order = new Set(doc.screenOrder)
    if (order.size !== doc.screenOrder.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['screenOrder'],
        message: 'duplicate screen id',
      })
    }
    for (const screenId of doc.screenOrder) {
      if (!doc.screens[screenId]) {
        ctx.addIssue({
          code: 'custom',
          path: ['screenOrder'],
          message: `unknown screen ${screenId}`,
        })
      }
    }
    for (const screenId of Object.keys(doc.screens)) {
      if (!order.has(screenId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['screens', screenId],
          message: 'screen not in order',
        })
      }
    }
    if (!doc.screens[doc.settings.navigation.startScreen]) {
      ctx.addIssue({
        code: 'custom',
        path: ['settings', 'navigation', 'startScreen'],
        message: 'unknown start screen',
      })
    }
    const tableNames = new Set<string>()
    for (const [tableId, table] of Object.entries(doc.data.tables)) {
      if (tableNames.has(table.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['data', 'tables', tableId, 'name'],
          message: 'duplicate',
        })
      }
      tableNames.add(table.name)
      const columns = new Set<string>()
      table.columns.forEach((column, index) => {
        if (columns.has(column.name)) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', 'tables', tableId, 'columns', index, 'name'],
            message: 'duplicate',
          })
        }
        columns.add(column.name)
      })
    }
    const screenNames = new Set<string>()
    for (const [screenId, screen] of Object.entries(doc.screens)) {
      if (screenNames.has(screen.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['screens', screenId, 'name'],
          message: 'duplicate',
        })
      }
      screenNames.add(screen.name)
      checkTree(screen, (message, path) =>
        ctx.addIssue({
          code: 'custom',
          path: ['screens', screenId, ...path],
          message,
        }),
      )
    }
  })

type Issue = (message: string, path: (string | number)[]) => void

/** Every component is reachable exactly once from the root or the non-visual list. */
function checkTree(screen: Screen, issue: Issue): void {
  const seen = new Set<string>()
  const names = new Set<string>()
  const visit = (componentId: string, path: (string | number)[]): void => {
    const node = screen.components[componentId]
    if (!node) {
      issue(`unknown component ${componentId}`, path)
      return
    }
    if (seen.has(componentId)) {
      issue(`component ${componentId} appears twice`, path)
      return
    }
    seen.add(componentId)
    if (names.has(node.name)) issue(`duplicate name ${node.name}`, ['components', componentId])
    names.add(node.name)
    node.children?.forEach((child, index) => {
      visit(child, ['components', componentId, 'children', index])
    })
  }
  visit(screen.rootId, ['rootId'])
  screen.nonVisual.forEach((componentId, index) => {
    visit(componentId, ['nonVisual', index])
  })
  for (const componentId of Object.keys(screen.components)) {
    if (!seen.has(componentId)) issue('orphan component', ['components', componentId])
  }
}

export type Locale = z.infer<typeof localeSchema>
export type UiMode = z.infer<typeof uiModeSchema>
export type Theme = z.infer<typeof themeSchema>
export type NavItem = z.infer<typeof navItemSchema>
export type ComponentNode = z.infer<typeof componentNodeSchema>
export type Screen = z.infer<typeof screenSchema>
export type BlocklyJson = z.infer<typeof blocklyJsonSchema>
export type VarDecl = z.infer<typeof varDeclSchema>
export type VarKind = keyof ProjectDoc['variables']
export type AssetKind = (typeof ASSET_KINDS)[number]
export type Asset = z.infer<typeof assetSchema>
export type ProjectMeta = z.infer<typeof projectMetaSchema>
export type ProjectSettings = z.infer<typeof projectSettingsSchema>
export type ProjectDoc = z.infer<typeof projectDocSchema>

export type ScreenId = string
export type ComponentId = string
export type AssetId = string
/** `ScreenId` or `APP_WORKSPACE`. */
export type WorkspaceKey = string

export const DEFAULT_THEME: Theme = {
  primary: '#5b4bff',
  secondary: '#ff6b5c',
  background: '#ffffff',
  font: 'system',
  radius: 12,
  scheme: 'light',
}
