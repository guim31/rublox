import type { Locale, Screen, Theme } from '@rublox/schema'

/**
 * What the caller may do with a project (server projects; guest projects are `owner`).
 * `gallery`: a project shared in the gallery, opened read-only ("See the blocks", J6).
 */
export type ProjectAccess = 'owner' | 'editor' | 'viewer' | 'manager' | 'gallery'

export type ProjectOwner = {
  id: string
  displayName: string
  username: string
  avatar: string | null
}

/** What the dashboard shows of a project, without opening its document. */
export type ProjectSummary = {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  favorite: boolean
  /** In the trash since then (restorable for 30 days). */
  deletedAt: string | null
  /** The start screen, drawn as the card's thumbnail. */
  preview: { screen: Screen; theme: Theme; locale: Locale } | null
  /** Server projects only. */
  access?: ProjectAccess
  owner?: ProjectOwner
  /** The space through which a manager sees the project. */
  spaceId?: string | null
  /** "Remix of X by Y": the gallery project it was copied from (J6). */
  remixOf?: { id: string; name: string; owner: string } | null
}

export const TRASH_DAYS = 30
