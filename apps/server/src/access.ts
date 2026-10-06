import { and, eq, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Database } from './db/index.ts'
import { member, projectMembers, projects, user } from './db/schema.ts'
import { fail, type SessionUser } from './http.ts'

/** Better Auth organization roles that make a space manager. */
export const MANAGER_ROLES = ['owner', 'admin'] as const

export function isManagerRole(role: string): boolean {
  return (MANAGER_ROLES as readonly string[]).includes(role)
}

/** Ids of the spaces `userId` manages. */
export async function managedSpaceIds(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ spaceId: member.organizationId })
    .from(member)
    .where(and(eq(member.userId, userId), inArray(member.role, [...MANAGER_ROLES])))
  return rows.map((row) => row.spaceId)
}

export async function membership(db: Database, spaceId: string, userId: string) {
  const [row] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, spaceId), eq(member.userId, userId)))
  return row ?? null
}

/** 404 unless `userId` belongs to the space, 403 unless they manage it when `manager`. */
export async function requireMembership(
  db: Database,
  spaceId: string,
  userId: string,
  level: 'member' | 'manager',
) {
  const row = await membership(db, spaceId, userId)
  if (!row) fail(404, 'not_found')
  if (level === 'manager' && !isManagerRole(row.role)) fail(403, 'forbidden')
  return row
}

/**
 * The member accounts a manager may act on (reset a password, delete): accounts **created by
 * a space they manage** (SPEC § 6.9). Being a plain member of the same space is not enough:
 * a manager never gets power over an account they did not create through their space.
 */
export async function requireManagedAccount(
  db: Database,
  actor: SessionUser,
  spaceId: string,
  targetId: string,
) {
  await requireMembership(db, spaceId, actor.id, 'manager')
  const [target] = await db.select().from(user).where(eq(user.id, targetId))
  if (!target || target.managedBySpaceId !== spaceId) fail(404, 'not_found')
  return target
}

export type ProjectAccess = 'owner' | 'editor' | 'viewer' | 'manager'

export const canWrite = (access: ProjectAccess) => access === 'owner' || access === 'editor'

/**
 * What `userId` may do with a project: its owner; an account it is shared with (`editor` or
 * `viewer`); or a manager of a space where the owner is a member (`manager`: read-only).
 */
export async function projectAccess(db: Database, userId: string, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
  if (!project) return null
  if (project.ownerId === userId) return { project, access: 'owner' as ProjectAccess }
  const [shared] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
  if (shared) return { project, access: shared.role as ProjectAccess }
  const managerRow = alias(member, 'manager_row')
  const [managed] = await db
    .select({ spaceId: member.organizationId })
    .from(member)
    .innerJoin(
      managerRow,
      and(
        eq(managerRow.organizationId, member.organizationId),
        eq(managerRow.userId, userId),
        inArray(managerRow.role, [...MANAGER_ROLES]),
      ),
    )
    .where(and(eq(member.userId, project.ownerId), eq(member.role, 'member')))
    .limit(1)
  if (managed) return { project, access: 'manager' as ProjectAccess }
  return null
}

/** The project and the caller's access, or 404 (also when the access is too low to know). */
export async function requireProject(
  db: Database,
  userId: string,
  projectId: string,
  need: 'read' | 'write' | 'owner',
) {
  const found = await projectAccess(db, userId, projectId)
  if (!found) fail(404, 'not_found')
  if (need === 'write' && !canWrite(found.access)) fail(403, 'forbidden')
  if (need === 'owner' && found.access !== 'owner') fail(403, 'forbidden')
  return found
}
