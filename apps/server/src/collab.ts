import type { IncomingMessage } from 'node:http'
import { Hocuspocus } from '@hocuspocus/server'
import { type WebSocket, WebSocketServer } from 'ws'
import type * as Y from 'yjs'
import { canWrite, projectAccess } from './access.ts'
import type { Auth } from './auth.ts'
import type { Database } from './db/index.ts'
import type { Logger } from './logger.ts'
import { autoSnapshot, loadStoredDoc, storeDoc } from './projects/store.ts'
import { readProject, SERVER_ORIGIN, writeMeta } from './projects/ydoc.ts'
import { MB } from './settings.ts'
import { headersOf, type UpgradeRoute } from './upgrades.ts'

/** Path of the Yjs WebSocket on the studio origin (SPEC § 6.7). */
export const COLLAB_PATH = '/ws/collab'

/** Why a connection to a document was refused, as the studio reads it (`reason`). */
export type CollabRefusal = 'signed-out' | 'not-found'

interface CollabContext {
  userId: string
}

interface CollabDeps {
  db: Database
  auth: Auth
  config: { studioUrl: string }
  logger?: Pick<Logger, 'debug' | 'info' | 'warn' | 'error'>
}

/**
 * The project documents (Yjs), kept by Hocuspocus (SPEC § 6.4, § 6.7). Each document is named
 * after its project id, loaded from `project_docs` and stored back there (2 s after the last
 * edit, 10 s at most), validated first. Connections are authenticated by the session cookie;
 * viewers and space managers get a read-only connection. Presence and editing by several
 * people at once come with J4, on the same documents.
 */
export class Collab {
  readonly hocuspocus: Hocuspocus<CollabContext>

  constructor(private readonly deps: CollabDeps) {
    const { db, auth, logger } = deps
    this.hocuspocus = new Hocuspocus<CollabContext>({
      name: 'rublox',
      quiet: true,
      debounce: 2000,
      maxDebounce: 10_000,
      // Each document a socket opens is authenticated on its own.
      onAuthenticate: async ({ requestHeaders, documentName, connectionConfig }) => {
        const session = await auth.api.getSession({ headers: requestHeaders })
        if (!session) throw refusal('signed-out')
        const found = await projectAccess(db, session.user.id, documentName)
        if (!found) throw refusal('not-found')
        connectionConfig.readOnly = !canWrite(found.access) || found.project.deletedAt !== null
        return { userId: session.user.id }
      },
      onLoadDocument: async ({ documentName }) => {
        const stored = await loadStoredDoc(db, documentName)
        if (!stored) throw refusal('not-found')
        return stored
      },
      onStoreDocument: async ({ documentName, document, lastContext }) => {
        await this.store(documentName, document, lastContext?.userId || null)
      },
    })
    if (logger) logger.debug('collaboration ready')
  }

  private async store(projectId: string, document: Y.Doc, userId: string | null) {
    const { db, logger } = this.deps
    // The id belongs to the server, whatever a client wrote.
    if (document.getMap('meta').get('id') !== projectId) {
      document.transact(() => writeMeta(document, { id: projectId }), SERVER_ORIGIN)
    }
    const doc = readProject(document)
    if (!doc) {
      // A broken client: keep the last valid state rather than storing a damaged project.
      logger?.warn({ projectId }, 'refused to store an invalid project document')
      return
    }
    if (await storeDoc(db, projectId, document, doc)) {
      await autoSnapshot(db, projectId, doc, userId)
    }
  }

  /**
   * Runs `edit` on the live document of a project (loading it when nobody has it open), so
   * that open editors receive the change, then stores it.
   */
  async edit(projectId: string, userId: string | null, edit: (ydoc: Y.Doc) => void) {
    const connection = await this.hocuspocus.openDirectConnection(projectId, {
      userId: userId ?? '',
    })
    try {
      await connection.transact((document) => edit(document))
    } finally {
      await connection.disconnect()
    }
  }

  /** The current document of a project: the live one when it is open, else the stored one. */
  async read(projectId: string): Promise<Y.Doc | null> {
    const live = this.hocuspocus.documents.get(projectId)
    if (live && !live.isLoading) return live
    return loadStoredDoc(this.deps.db, projectId)
  }

  /** Closes the open connections to a project, so they authenticate again (access changed). */
  reconnect(projectId: string) {
    this.hocuspocus.closeConnections(projectId)
  }

  /** Stores what is pending (shutdown, tests). */
  async flush() {
    const { debouncer, documents } = this.hocuspocus
    await Promise.all(
      [...documents.keys()].map((name) => debouncer.executeNow(`onStoreDocument-${name}`)),
    )
  }

  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: 32 * MB })

  /**
   * The `/ws/collab` endpoint for the server's upgrade router (`upgrades.ts`): studio origin
   * only (the apps origin never sees a session), and the `Origin` header is checked before the
   * upgrade. A missing or expired session is answered inside the Yjs protocol ("permission
   * denied"), never with an HTTP 401 (SPEC § 6.9).
   */
  route(): UpgradeRoute {
    const { studioUrl } = this.deps.config
    return {
      origin: studioUrl,
      path: COLLAB_PATH,
      allowedOrigin: studioUrl,
      handle: (request, socket, head, url) =>
        this.sockets.handleUpgrade(request, socket, head, (ws) => this.accept(ws, request, url)),
    }
  }

  /** Closes the open sockets (shutdown); their documents are stored on close. */
  close() {
    for (const ws of this.sockets.clients) ws.close(1001)
  }

  private accept(ws: WebSocket, request: IncomingMessage, url: URL) {
    const connection = this.hocuspocus.handleConnection(
      ws,
      new Request(url, { headers: headersOf(request) }),
    )
    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const bytes = Array.isArray(data) ? Buffer.concat(data) : data
      connection.handleMessage(
        bytes instanceof ArrayBuffer
          ? new Uint8Array(bytes)
          : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      )
    })
    ws.on('close', (code, reason) => connection.handleClose({ code, reason: reason.toString() }))
    ws.on('error', (error) => this.deps.logger?.warn({ err: error }, 'collaboration socket error'))
  }
}

function refusal(reason: CollabRefusal) {
  return { reason }
}
