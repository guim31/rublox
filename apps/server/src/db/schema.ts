import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Instance-wide key/value settings (J0: proves the migration pipeline end to end). */
export const instanceSettings = pgTable('instance_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
