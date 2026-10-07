import {
  cellSchema,
  HTTP_METHODS,
  type ProjectDoc,
  type RelayError,
  SECRET_NAME,
} from '@rublox/schema'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireProject } from '../access.ts'
import { RELAY_STATUS, RelayFailure } from '../data/relay.ts'
import { MAX_SECRET_BYTES, MAX_SECRETS } from '../data/secrets.ts'
import { SharedError } from '../data/shared.ts'
import { type ApiEnv, fail, iso, jsonBody, requireUser } from '../http.ts'
import { readProject } from '../projects/ydoc.ts'
import type { Services } from '../services.ts'

const secretValue = z
  .string()
  .min(1)
  .refine((value) => Buffer.byteLength(value) <= MAX_SECRET_BYTES)

const valuesSchema = z.record(z.string().max(64), cellSchema)

const trySchema = z.object({
  api: z.string().min(1).max(64),
  method: z.enum(HTTP_METHODS).default('GET'),
  path: z.string().max(2000).default(''),
  query: z.record(z.string().max(200), z.unknown()).optional(),
  body: z.unknown().optional(),
})

/**
 * The data of a project seen from the editor (SPEC § 4.5): tickets of the preview, secrets
 * (names only, values are write-only), "Try" on an API connection, and the content of shared
 * tables and variables.
 */
export function dataRoutes(services: Services) {
  const { db } = services

  /** The project as it is now (the live document). */
  const currentDoc = async (projectId: string): Promise<ProjectDoc> => {
    const ydoc = await services.collab.read(projectId)
    const doc = ydoc ? readProject(ydoc) : null
    if (!doc) fail(404, 'not_found')
    return doc
  }

  const sharedError = (error: unknown): never => {
    if (error instanceof SharedError) {
      if (error.code === 'unknown') fail(404, 'not_found')
      if (error.code === 'too_large' || error.code === 'too_many_rows') fail(413, 'too_large')
      fail(400, 'invalid')
    }
    throw error
  }

  return (
    new Hono<ApiEnv>()
      // A ticket for the preview of a project open in the editor (apps origin, no cookie).
      .post('/:id/data/ticket', async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'read')
        if (project.deletedAt) fail(410, 'in_trash')
        return c.json(services.tickets.issue(project.id))
      })

      .get('/:id/secrets', async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'read')
        const rows = await services.secrets.list(project.id)
        return c.json({
          secrets: rows.map((row) => ({ name: row.name, updatedAt: iso(row.updatedAt) })),
        })
      })
      .put('/:id/secrets/:name', jsonBody(z.object({ value: secretValue })), async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'write')
        const name = c.req.param('name')
        if (!SECRET_NAME.test(name)) fail(400, 'invalid')
        const existing = await services.secrets.list(project.id)
        if (!existing.some((row) => row.name === name) && existing.length >= MAX_SECRETS) {
          fail(413, 'too_large')
        }
        await services.secrets.set(project.id, name, c.req.valid('json').value)
        return c.json({ ok: true })
      })
      .delete('/:id/secrets/:name', async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'write')
        await services.secrets.remove(project.id, c.req.param('name'))
        return c.json({ ok: true })
      })

      // "Try" in the Data tab: the same relay as the app, with the editor's session.
      .post('/:id/data/try', jsonBody(trySchema), async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'write')
        const doc = await currentDoc(project.id)
        try {
          const response = await services.relay.call(
            { projectId: project.id, doc, kind: 'editor' },
            c.req.valid('json'),
          )
          return c.json({ response })
        } catch (error) {
          if (!(error instanceof RelayFailure)) throw error
          return c.json({ error: error.code as RelayError }, RELAY_STATUS[error.code])
        }
      })

      // Shared tables and variables
      .get('/:id/data/tables/:tableId/rows', async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'read')
        return c.json({ rows: await services.shared.rows(project.id, c.req.param('tableId')) })
      })
      .put(
        '/:id/data/tables/:tableId/rows',
        jsonBody(z.object({ rows: z.array(valuesSchema).max(5000) })),
        async (c) => {
          const user = requireUser(c)
          const { project } = await requireProject(db, user.id, c.req.param('id'), 'write')
          const doc = await currentDoc(project.id)
          const rows = await services.shared
            .replaceRows(project.id, doc, c.req.param('tableId'), c.req.valid('json').rows)
            .catch(sharedError)
          return c.json({ rows })
        },
      )
      .post(
        '/:id/data/tables/:tableId/rows',
        jsonBody(z.object({ values: valuesSchema })),
        async (c) => {
          const user = requireUser(c)
          const { project } = await requireProject(db, user.id, c.req.param('id'), 'write')
          const doc = await currentDoc(project.id)
          const row = await services.shared
            .addRow(project.id, doc, c.req.param('tableId'), c.req.valid('json').values, false)
            .catch(sharedError)
          return c.json({ row })
        },
      )
      .patch(
        '/:id/data/tables/:tableId/rows/:rowId',
        jsonBody(z.object({ values: valuesSchema })),
        async (c) => {
          const user = requireUser(c)
          const { project } = await requireProject(db, user.id, c.req.param('id'), 'write')
          const doc = await currentDoc(project.id)
          const row = await services.shared
            .updateRow(
              project.id,
              doc,
              c.req.param('tableId'),
              c.req.param('rowId'),
              c.req.valid('json').values,
              false,
            )
            .catch(sharedError)
          return c.json({ row })
        },
      )
      .delete('/:id/data/tables/:tableId/rows/:rowId', async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'write')
        const doc = await currentDoc(project.id)
        await services.shared
          .removeRow(project.id, doc, c.req.param('tableId'), c.req.param('rowId'), false)
          .catch(sharedError)
        return c.json({ ok: true })
      })
      .get('/:id/data/variables', async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'read')
        const doc = await currentDoc(project.id)
        return c.json({ values: await services.shared.variables(project.id, doc) })
      })
      .delete('/:id/data/variables/:varId', async (c) => {
        const user = requireUser(c)
        const { project } = await requireProject(db, user.id, c.req.param('id'), 'write')
        const doc = await currentDoc(project.id)
        await services.shared.resetVariable(project.id, doc, c.req.param('varId'))
        return c.json({ ok: true })
      })
  )
}
