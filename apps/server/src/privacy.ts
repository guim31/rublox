import { and, count, eq, inArray, ne } from 'drizzle-orm'
import { isManagerRole } from './access.ts'
import { realEmail } from './auth.ts'
import type { Database } from './db/index.ts'
import {
  account,
  aiUsage,
  assets,
  likes,
  member,
  organization,
  passkey,
  projectFavorites,
  projectMembers,
  projects,
  projectVersions,
  session,
  spaceSettings,
  user,
} from './db/schema.ts'
import { fail, iso } from './http.ts'
import { readProject } from './projects/ydoc.ts'
import type { Services } from './services.ts'

/**
 * Everything Rublox keeps about an account (SPEC § 4.7, RGPD): profile, spaces, sessions,
 * passkeys (names and dates, never keys), projects with their current content and the list of
 * their versions, files, sharing and favorites. Never a password hash or a session token.
 */
export async function exportAccount(services: Services, userId: string) {
  const { db, collab, config } = services
  const [row] = await db.select().from(user).where(eq(user.id, userId))
  if (!row) fail(404, 'not_found')
  const spaces = await db
    .select({
      id: organization.id,
      name: organization.name,
      kind: spaceSettings.kind,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .leftJoin(spaceSettings, eq(spaceSettings.spaceId, organization.id))
    .where(eq(member.userId, userId))
  const sessions = await db
    .select({
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    })
    .from(session)
    .where(eq(session.userId, userId))
  const passkeys = await db
    .select({ name: passkey.name, createdAt: passkey.createdAt, deviceType: passkey.deviceType })
    .from(passkey)
    .where(eq(passkey.userId, userId))
  const owned = await db.select().from(projects).where(eq(projects.ownerId, userId))
  const ownedIds = owned.map((project) => project.id)
  const versions = ownedIds.length
    ? await db
        .select({
          projectId: projectVersions.projectId,
          name: projectVersions.name,
          createdAt: projectVersions.createdAt,
        })
        .from(projectVersions)
        .where(inArray(projectVersions.projectId, ownedIds))
    : []
  const files = await db.select().from(assets).where(eq(assets.ownerId, userId))
  const sharedWithMe = await db
    .select({ projectId: projectMembers.projectId, name: projects.name, role: projectMembers.role })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, userId))
  const favorites = await db
    .select({ projectId: projectFavorites.projectId })
    .from(projectFavorites)
    .where(eq(projectFavorites.userId, userId))

  // J6: likes in the gallery, and the account's use of the AI assistant (no content is kept).
  const liked = await db
    .select({ projectId: likes.projectId, createdAt: likes.createdAt })
    .from(likes)
    .where(eq(likes.userId, userId))
  const aiUses = await db
    .select({
      kind: aiUsage.kind,
      model: aiUsage.model,
      inputTokens: aiUsage.inputTokens,
      outputTokens: aiUsage.outputTokens,
      outcome: aiUsage.outcome,
      createdAt: aiUsage.createdAt,
    })
    .from(aiUsage)
    .where(eq(aiUsage.userId, userId))

  const projectsOut = []
  for (const project of owned) {
    const ydoc = await collab.read(project.id)
    projectsOut.push({
      id: project.id,
      name: project.name,
      createdAt: iso(project.createdAt),
      updatedAt: iso(project.updatedAt),
      deletedAt: iso(project.deletedAt),
      inGallery: project.visibility === 'gallery',
      remixOf: project.remixOf ?? null,
      document: ydoc ? readProject(ydoc) : null,
      versions: versions
        .filter((version) => version.projectId === project.id)
        .map((version) => ({ name: version.name, createdAt: iso(version.createdAt) })),
    })
  }

  return {
    format: 'rublox/account-export',
    exportedAt: new Date().toISOString(),
    profile: {
      id: row.id,
      username: row.username,
      displayName: row.name,
      email: realEmail(row.email),
      avatar: row.avatar,
      locale: row.locale,
      uiMode: row.uiMode,
      theme: row.theme,
      role: row.role,
      disabled: row.banned === true,
      managedBySpaceId: row.managedBySpaceId,
      createdAt: iso(row.createdAt),
    },
    spaces: spaces.map((space) => ({
      id: space.id,
      name: space.name,
      kind: space.kind,
      manager: isManagerRole(space.role),
    })),
    sessions: sessions.map((entry) => ({
      createdAt: iso(entry.createdAt),
      lastSeenAt: iso(entry.updatedAt),
      expiresAt: iso(entry.expiresAt),
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    })),
    passkeys: passkeys.map((entry) => ({ ...entry, createdAt: iso(entry.createdAt) })),
    projects: projectsOut,
    files: files.map((file) => ({
      projectId: file.projectId,
      kind: file.kind,
      mime: file.mime,
      size: file.size,
      sha256: file.sha256,
      url: `${config.appsUrl}/assets/${file.sha256}`,
    })),
    sharedWithMe,
    favorites: favorites.map((entry) => entry.projectId),
    likes: liked.map((entry) => ({ projectId: entry.projectId, createdAt: iso(entry.createdAt) })),
    aiUsage: aiUses.map((entry) => ({ ...entry, createdAt: iso(entry.createdAt) })),
  }
}

/**
 * Deletes an account and what belongs to it: its projects (and their versions and files,
 * whose bytes leave with the next purge), sessions, passkeys, memberships. Refused while it
 * is the last administrator, or the last manager of a space that still has other people or
 * accounts it created (`last_manager`); a space it is alone in goes with it.
 */
export async function deleteAccount(services: Services, userId: string) {
  const { db, collab } = services
  const [row] = await db.select().from(user).where(eq(user.id, userId))
  if (!row) fail(404, 'not_found')
  if (row.role === 'admin') {
    const [admins] = await db
      .select({ total: count() })
      .from(user)
      .where(and(eq(user.role, 'admin'), ne(user.id, userId)))
    if ((admins?.total ?? 0) === 0) fail(409, 'last_admin')
  }
  const lonelySpaces: string[] = []
  const memberships = await db.select().from(member).where(eq(member.userId, userId))
  for (const entry of memberships) {
    if (!isManagerRole(entry.role)) continue
    const others = await db
      .select({ userId: member.userId, role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, entry.organizationId), ne(member.userId, userId)))
    const [created] = await db
      .select({ total: count() })
      .from(user)
      .where(and(eq(user.managedBySpaceId, entry.organizationId), ne(user.id, userId)))
    if (others.length === 0 && (created?.total ?? 0) === 0) {
      lonelySpaces.push(entry.organizationId)
    } else if (!others.some((other) => isManagerRole(other.role))) {
      fail(409, 'last_manager')
    }
  }
  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerId, userId))
  await db.transaction(async (tx) => {
    await deleteUserRows(tx, userId)
    if (lonelySpaces.length) {
      await tx.delete(organization).where(inArray(organization.id, lonelySpaces))
    }
  })
  for (const project of owned) collab.reconnect(project.id)
}

/** Projects, files, sessions and the account itself (the rest cascades). */
async function deleteUserRows(db: Database, userId: string) {
  await db.delete(projects).where(eq(projects.ownerId, userId))
  await db.delete(assets).where(eq(assets.ownerId, userId))
  await db.delete(session).where(eq(session.userId, userId))
  await db.delete(account).where(eq(account.userId, userId))
  await db.delete(user).where(eq(user.id, userId))
}
