import type {
  ComponentId,
  Locale,
  ProjectDoc,
  ScreenId,
  UiMode,
  WorkspaceKey,
} from '@rublox/schema'
import type { LogEntry, ModuleCode } from './engine.ts'
import type { Scheme } from './theme.ts'

/**
 * Messages between the editor (studio origin) and the preview (apps origin), SPEC § 6.5.
 * Each side checks `event.origin` against the configured origin of the other.
 */
export type StudioToPlayer =
  | {
      type: 'rx:load'
      doc: ProjectDoc
      code: Record<WorkspaceKey, ModuleCode>
      /** Files of the project's assets, by asset id (sent when they change). */
      assets?: Record<string, Blob>
      locale: Locale
      mode: UiMode
      scheme?: Scheme
      /** Screen the editor is on: shown when the app (re)starts. */
      screenId?: ScreenId
    }
  | { type: 'rx:restart'; screenId?: ScreenId }
  | { type: 'rx:stop' }
  | { type: 'rx:scheme'; scheme?: Scheme }
  | { type: 'rx:inspect'; enabled: boolean }

export type PlayerToStudio =
  | { type: 'rx:ready' }
  | { type: 'rx:log'; entry: LogEntry }
  | { type: 'rx:state'; running: boolean; screenId: ScreenId | null }
  | { type: 'rx:select'; screenId: ScreenId; componentId: ComponentId }

const STUDIO_TYPES = new Set(['rx:load', 'rx:restart', 'rx:stop', 'rx:scheme', 'rx:inspect'])
const PLAYER_TYPES = new Set(['rx:ready', 'rx:log', 'rx:state', 'rx:select'])

function hasType(data: unknown, types: Set<string>): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string' &&
    types.has((data as { type: string }).type)
  )
}

export function isStudioMessage(data: unknown): data is StudioToPlayer {
  return hasType(data, STUDIO_TYPES)
}

export function isPlayerMessage(data: unknown): data is PlayerToStudio {
  return hasType(data, PLAYER_TYPES)
}

/** `http://localhost:5173/x` → `http://localhost:5173`; invalid → `''`. */
export function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

export type RubloxConfig = { studioUrl: string; appsUrl: string }

/**
 * Reads the configuration the server writes into `index.html`
 * (`<script id="rublox-config" type="application/json">`).
 */
export function readConfig(doc: Document = document): RubloxConfig {
  const fallback = {
    studioUrl: 'http://localhost:5173',
    appsUrl: 'http://127.0.0.1:5174',
  }
  try {
    const text = doc.getElementById('rublox-config')?.textContent
    const parsed = text ? (JSON.parse(text) as Partial<RubloxConfig>) : {}
    return {
      studioUrl: typeof parsed.studioUrl === 'string' ? parsed.studioUrl : fallback.studioUrl,
      appsUrl: typeof parsed.appsUrl === 'string' ? parsed.appsUrl : fallback.appsUrl,
    }
  } catch {
    return fallback
  }
}
