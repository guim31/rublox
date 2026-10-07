import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from './db/index.ts'
import { instanceSettings } from './db/schema.ts'

/** Instance settings changed in the admin pages (SPEC § 4.13). */
export const settingsSchema = z.object({
  instanceName: z.string().trim().min(1).max(60),
  galleryEnabled: z.boolean(),
  aiEnabled: z.boolean(),
  /** AI requests per account and per day (J6). */
  aiDailyQuota: z.number().int().min(0).max(10_000),
  maxUploadMb: z.number().min(1).max(10_240),
  storageQuotaMb: z.number().min(1).max(1_048_576),
})

export type InstanceSettings = z.infer<typeof settingsSchema>
const KEYS = Object.keys(settingsSchema.shape) as (keyof InstanceSettings)[]

/** The settings of each database, for checks that only get the database (`projectAccess`). */
const stores = new WeakMap<Database, SettingsStore>()

export function settingsOf(db: Database): SettingsStore | undefined {
  return stores.get(db)
}

export class SettingsStore {
  private cache: InstanceSettings | undefined

  constructor(
    private readonly db: Database,
    private readonly defaults: InstanceSettings,
  ) {
    stores.set(db, this)
  }

  async get(): Promise<InstanceSettings> {
    if (this.cache) return this.cache
    const rows = await this.db
      .select()
      .from(instanceSettings)
      .where(inArray(instanceSettings.key, KEYS))
    const stored: Record<string, unknown> = {}
    for (const row of rows) stored[row.key] = row.value
    const merged = { ...this.defaults }
    for (const key of KEYS) {
      const parsed = settingsSchema.shape[key].safeParse(stored[key])
      if (parsed.success) Object.assign(merged, { [key]: parsed.data })
    }
    this.cache = merged
    return merged
  }

  async update(patch: Partial<InstanceSettings>): Promise<InstanceSettings> {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue
      await this.db
        .insert(instanceSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: instanceSettings.key, set: { value, updatedAt: new Date() } })
    }
    this.cache = undefined
    return this.get()
  }
}

export const MB = 1024 * 1024
