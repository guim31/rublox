import {
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  type ProjectDoc,
  projectDocSchema,
} from './project.ts'

/** A step from `from` to `from + 1`. It receives and returns plain JSON. */
export type Migration = {
  from: number
  description: string
  up: (doc: Record<string, unknown>) => Record<string, unknown>
}

/**
 * Registered steps, oldest first. To change the format: bump `PROJECT_FORMAT_VERSION`, add a
 * step here from the previous version, and add a fixture of the previous version to the tests.
 */
export const MIGRATIONS: readonly Migration[] = []

export type ProjectFormatErrorCode = 'not-a-project' | 'too-new' | 'missing-migration' | 'invalid'

export class ProjectFormatError extends Error {
  override name = 'ProjectFormatError'
  constructor(
    readonly code: ProjectFormatErrorCode,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message)
  }
}

/**
 * Brings any saved project up to the current format and validates it. Throws a
 * `ProjectFormatError` whose `code` says what went wrong.
 */
export function migrateProject(
  input: unknown,
  migrations: readonly Migration[] = MIGRATIONS,
  target: number = PROJECT_FORMAT_VERSION,
): ProjectDoc {
  if (
    !input ||
    typeof input !== 'object' ||
    (input as { format?: unknown }).format !== PROJECT_FORMAT
  ) {
    throw new ProjectFormatError('not-a-project', 'not a Rublox project')
  }
  let doc = structuredClone(input) as Record<string, unknown>
  let version = doc.formatVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ProjectFormatError('invalid', 'invalid format version')
  }
  if (version > target) {
    throw new ProjectFormatError('too-new', `format ${version} is newer than ${target}`)
  }
  while (version < target) {
    const step = migrations.find((migration) => migration.from === version)
    if (!step) throw new ProjectFormatError('missing-migration', `no migration from ${version}`)
    doc = { ...step.up(doc), formatVersion: version + 1 }
    version += 1
  }
  if (target !== PROJECT_FORMAT_VERSION) return doc as ProjectDoc
  const result = projectDocSchema.safeParse(doc)
  if (!result.success) throw new ProjectFormatError('invalid', result.error.message, result.error)
  return result.data
}
