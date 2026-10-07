import { z } from 'zod'
import { type ProjectDoc, projectDocSchema } from './project.ts'

// ---- Published apps (SPEC § 4.6) -----------------------------------------------------------

/** Address of a published app: `/a/<slug>/` on the apps origin. 3 to 40 characters. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && !value.includes('--')
}

/** A slug proposed from a name: `Le dé magique !` → `le-de-magique`. */
export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return base.length >= 3 ? base : `${base || 'app'}-${Math.random().toString(36).slice(2, 6)}`
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

/** The icon of a published app: one of the project's images, or an emoji on a colour. */
export const appIconSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('emoji'),
    emoji: z.string().min(1).max(16),
    background: hexColor,
  }),
  z.object({ kind: z.literal('asset'), assetId: z.string().min(1).max(64) }),
])

/** What the "Publish" dialog sets, frozen with each version. */
export const appSettingsSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(300).default(''),
  themeColor: hexColor,
  backgroundColor: hexColor,
  icon: appIconSchema,
})

/** A generated module and the block of each of its lines (`@rublox/blocks`). */
export const moduleCodeSchema = z.object({
  code: z.string().max(4_000_000),
  lineMap: z.array(z.string().nullable()),
})

/** What a player runs: the project and the code generated from it (SPEC § 6.5). */
export const appBundleSchema = z.object({
  doc: projectDocSchema,
  code: z.record(z.string().max(64), moduleCodeSchema),
})

export type AppIcon = z.infer<typeof appIconSchema>
export type AppSettings = z.infer<typeof appSettingsSchema>
export type AppSettingsInput = z.input<typeof appSettingsSchema>
export type ModuleCodeJson = z.infer<typeof moduleCodeSchema>
export type AppBundle = z.infer<typeof appBundleSchema>

/** `/a/<slug>/app.json`: what the published app loads. */
export type PublishedApp = AppBundle & {
  /** Stable id of the publication: the app's local storage is kept under it (SPEC § 6.6). */
  appId: string
  slug: string
  version: number
  settings: AppSettings
}

/** PNG icons generated for each version (SPEC § 4.6), by file name in `/a/<slug>/`. */
export const APP_ICON_FILES = {
  'icon-192.png': { key: '192', size: 192 },
  'icon-512.png': { key: '512', size: 512 },
  'icon-maskable.png': { key: 'maskable', size: 512 },
  'apple-touch-icon.png': { key: 'apple', size: 180 },
} as const

export type AppIconKey = (typeof APP_ICON_FILES)[keyof typeof APP_ICON_FILES]['key']

// ---- Live test on a phone (SPEC § 4.3) -----------------------------------------------------

/** The WebSocket of the phone, on the apps origin. */
export const LIVE_PHONE_PATH = '/_rx/live'
/** The WebSocket of the editor, on the studio origin (session cookie). */
export const LIVE_STUDIO_PATH = '/ws/live'

export type LiveLogEntry = {
  level: 'log' | 'warn' | 'error'
  message: string
  blockId?: string
  workspace?: string
  time: number
}

export type LiveEndReason = 'revoked' | 'expired' | 'not-found'

/** Server → phone. */
export type LiveToPhone =
  | { type: 'load'; bundle: AppBundle }
  | { type: 'restart'; screenId?: string }
  | { type: 'editor'; connected: boolean }
  | { type: 'ended'; reason: LiveEndReason }

/** Phone → server. */
export type LiveFromPhone =
  | { type: 'hello'; device: string }
  | { type: 'log'; entry: LiveLogEntry }
  | { type: 'state'; running: boolean; screenId: string | null }

export type LivePhone = { id: string; device: string; connectedAt: number; running: boolean }

/** Server → editor. */
export type LiveToStudio =
  | { type: 'phones'; phones: LivePhone[] }
  | { type: 'log'; phoneId: string; device: string; entry: LiveLogEntry }
  | { type: 'ended'; reason: LiveEndReason }

/** Editor → server. */
export type LiveFromStudio =
  | { type: 'load'; bundle: AppBundle }
  | { type: 'restart'; screenId?: string }

const logEntrySchema = z.object({
  level: z.enum(['log', 'warn', 'error']),
  message: z.string().max(2000),
  blockId: z.string().max(64).optional(),
  workspace: z.string().max(64).optional(),
  time: z.number(),
})

export const liveFromPhoneSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), device: z.string().max(80) }),
  z.object({ type: z.literal('log'), entry: logEntrySchema }),
  z.object({
    type: z.literal('state'),
    running: z.boolean(),
    screenId: z.string().max(64).nullable(),
  }),
])

export const liveFromStudioSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('load'), bundle: appBundleSchema }),
  z.object({ type: z.literal('restart'), screenId: z.string().max(64).optional() }),
])

// ---- `.rublox` files (SPEC § 4.6) ----------------------------------------------------------

/** A `.rublox` file is a zip: this JSON, then each asset under `assets/<sha256>`. */
export const ARCHIVE_PROJECT_FILE = 'project.json'
export const ARCHIVE_ASSETS_DIR = 'assets/'
export const ARCHIVE_EXTENSION = '.rublox'

/** The asset files a project needs, by SHA-256. */
export function assetHashes(doc: Pick<ProjectDoc, 'assets'>): string[] {
  return [...new Set(Object.values(doc.assets).map((asset) => asset.sha256))]
}
