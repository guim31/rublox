import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value.buffer, value.byteOffset, value.byteLength),
  fromDriver: (value) => new Uint8Array(value),
})

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

/** Instance-wide key/value settings (`settings.ts` gives them a type). */
export const instanceSettings = pgTable('instance_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---- Better Auth (SPEC § 6.8). Property names are Better Auth's field names. ---------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  /** The display name (`displayName` in the SPEC). */
  name: text('name').notNull(),
  /** Required by Better Auth: accounts without an address get a `@rublox.invalid` one. */
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  // username plugin
  username: text('username').unique(),
  displayUsername: text('display_username'),
  // admin plugin: `role` is `user` or `admin`, `banned` disables the account
  role: text('role').default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  // Rublox profile
  avatar: text('avatar'),
  locale: text('locale'),
  uiMode: text('ui_mode'),
  theme: text('theme'),
  /** Set for member accounts created by a space manager (no e-mail, password reset by them). */
  managedBySpaceId: text('managed_by_space_id'),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
    activeOrganizationId: text('active_organization_id'),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

export const passkey = pgTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    transports: text('transports'),
    createdAt: timestamp('created_at', { withTimezone: true }),
    aaguid: text('aaguid'),
  },
  (t) => [
    index('passkey_user_id_idx').on(t.userId),
    index('passkey_credential_id_idx').on(t.credentialID),
  ],
)

/** A space (family, class, team): a Better Auth organization. */
export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: text('metadata'),
})

/** Membership of a space. `role`: `owner` and `admin` are managers, `member` a member. */
export const member = pgTable(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('member_organization_user_idx').on(t.organizationId, t.userId),
    index('member_user_id_idx').on(t.userId),
  ],
)

/** Required by the organization plugin; unused (Rublox invitations are `invites`). */
export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

// ---- Rublox --------------------------------------------------------------------------------

/** What a space is and what its members may do (SPEC § 4.7). */
export const spaceSettings = pgTable('space_settings', {
  spaceId: text('space_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  membersCanPublish: boolean('members_can_publish').notNull().default(true),
  membersCanUseAi: boolean('members_can_use_ai').notNull().default(false),
  membersCanShareInGallery: boolean('members_can_share_in_gallery').notNull().default(false),
})

/** Invitation links. Only a keyed hash of the code is stored. */
export const invites = pgTable('invites', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull().unique(),
  note: text('note'),
  createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
  /** Instance role of the new account: `user` or `admin`. */
  role: text('role').notNull().default('user'),
  spaceId: text('space_id').references(() => organization.id, { onDelete: 'cascade' }),
  /** Role in `spaceId`: `manager` or `member`. */
  spaceRole: text('space_role'),
  maxUses: integer('max_uses').notNull().default(1),
  uses: integer('uses').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: createdAt(),
})

/** Who used an invitation, and when (usage follow-up in the admin pages). */
export const inviteUses = pgTable(
  'invite_uses',
  {
    inviteId: text('invite_id')
      .notNull()
      .references(() => invites.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    usedAt: timestamp('used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.inviteId, t.userId] })],
)

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The space of a member account's project (its managers can see it). */
    spaceId: text('space_id').references(() => organization.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    /** `private`, or `gallery` once shared in the gallery of the instance (J6). */
    visibility: text('visibility').notNull().default('private'),
    /** The gallery project this one was remixed from (null once that one is deleted). */
    remixOfId: text('remix_of_id'),
    /** "Remix of X by Y", kept even when the original is deleted: `{ id, name, owner }`. */
    remixOf: jsonb('remix_of'),
    /** Mode of the project (`junior` or `studio`), for the filters of the gallery. */
    uiMode: text('ui_mode'),
    /** When it was shared in the gallery. */
    sharedAt: timestamp('shared_at', { withTimezone: true }),
    /** Taken out of the gallery by an administrator: the owner cannot share it again. */
    galleryRemovedAt: timestamp('gallery_removed_at', { withTimezone: true }),
    /** The owner lets the AI component work in the published app (billed to them, J6). */
    appAiAllowed: boolean('app_ai_allowed').notNull().default(false),
    /** Start screen, theme and language: the dashboard thumbnail (`ProjectSummary.preview`). */
    preview: jsonb('preview'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('projects_owner_idx').on(t.ownerId),
    index('projects_space_idx').on(t.spaceId),
    index('projects_deleted_idx').on(t.deletedAt),
    index('projects_remix_idx').on(t.remixOfId),
    index('projects_visibility_idx').on(t.visibility),
  ],
)

/** Sharing with other accounts: `viewer` or `editor`. */
export const projectMembers = pgTable(
  'project_members',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] }), index('pm_user_idx').on(t.userId)],
)

export const projectFavorites = pgTable(
  'project_favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.projectId] })],
)

/** The Yjs state of each project, and its last JSON form. */
export const projectDocs = pgTable('project_docs', {
  projectId: text('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  state: bytea('state').notNull(),
  json: jsonb('json').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Snapshots: automatic (every 10 minutes of activity) or named. */
export const projectVersions = pgTable(
  'project_versions',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** Null for automatic snapshots. */
    name: text('name'),
    json: jsonb('json').notNull(),
    createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('pv_project_idx').on(t.projectId, t.createdAt)],
)

/**
 * Uploaded files. The bytes live once on disk under `DATA_DIR/assets`, named by their SHA-256;
 * a row per (project, file) gives the owner (quota) and the project.
 */
export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    sha256: text('sha256').notNull(),
    kind: text('kind').notNull(),
    mime: text('mime').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('assets_project_sha_idx')
      .on(t.projectId, t.sha256)
      .where(sql`${t.projectId} is not null`),
    index('assets_sha_idx').on(t.sha256),
    index('assets_owner_idx').on(t.ownerId),
  ],
)

// ---- Publication and live test (J4, SPEC § 4.3, § 4.6) -------------------------------------

/**
 * A project's published app, at `/a/<slug>/` on the apps origin. The slug stays with the
 * project, even unpublished, so that the address never changes from one version to the next.
 */
export const publications = pgTable('publications', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  /** The version served at the address; null while unpublished. */
  currentVersionId: text('current_version_id'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A frozen version of a published app: its settings (name, icon, colours), the project and the
 * code generated from it, and the icons drawn for it (files of the `FileStore`).
 */
export const publicationVersions = pgTable(
  'publication_versions',
  {
    id: text('id').primaryKey(),
    publicationId: text('publication_id')
      .notNull()
      .references(() => publications.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    settings: jsonb('settings').notNull(),
    bundle: jsonb('bundle').notNull(),
    /** SHA-256 of the generated PNG icons, by name (`192`, `512`, `maskable`, `apple`). */
    icons: jsonb('icons').notNull(),
    createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('pubv_number_idx').on(t.publicationId, t.number)],
)

/** Temporary, revocable links of "Test on my phone": only a keyed hash of the token is kept. */
export const liveLinks = pgTable(
  'live_links',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdById: text('created_by_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('live_links_project_idx').on(t.projectId)],
)

// ---- Data and services (J5, SPEC § 4.5, § 6.9) ---------------------------------------------

/**
 * API keys of a project, never written into the project nor into a published app: the relay
 * of the apps origin puts them into the calls. Encrypted with AES-256-GCM under a key derived
 * from `RUBLOX_SECRET` (`data/secrets.ts`).
 */
export const projectSecrets = pgTable(
  'project_secrets',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** `base64(iv | tag | ciphertext)`. */
    value: text('value').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.name] })],
)

/** Shared variables of an app (SPEC § 4.2): one value per project and variable id. */
export const sharedVars = pgTable(
  'shared_vars',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    varId: text('var_id').notNull(),
    value: jsonb('value'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.varId] })],
)

/** Rows of the shared tables of an app (SPEC § 4.5), cells by column id. */
export const sharedRows = pgTable(
  'shared_rows',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    tableId: text('table_id').notNull(),
    rowId: text('row_id').notNull(),
    values: jsonb('values').notNull(),
    /** Insertion order. */
    seq: bigint('seq', { mode: 'number' }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.tableId, t.rowId] }),
    index('shared_rows_order_idx').on(t.projectId, t.tableId, t.seq),
  ],
)

// ---- Gallery and AI assistant (J6, SPEC § 4.11, § 4.12) -----------------------------------

/** "I like" on a gallery project: one per account and project. */
export const likes = pgTable(
  'likes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.projectId] }),
    index('likes_project_idx').on(t.projectId),
  ],
)

/**
 * Usage journal of the AI assistant: one row per request, counted against the daily quota of
 * the account (`userId`). The question and the answer are not kept.
 */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    /** `create`, `explain`, `debug`, `app-text`, `app-image`. */
    kind: text('kind').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /** `ok`, `refused` (declined by the model), `error`. */
    outcome: text('outcome').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ai_usage_user_idx').on(t.userId, t.createdAt),
    index('ai_usage_created_idx').on(t.createdAt),
  ],
)
