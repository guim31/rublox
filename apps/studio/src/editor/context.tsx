import type { ProjectDoc, Screen, ScreenId } from '@rublox/schema'
import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from 'react'
import type { ProjectSession } from './session.ts'

const SessionContext = createContext<ProjectSession | null>(null)

export function SessionProvider({
  session,
  children,
}: {
  session: ProjectSession
  children: ReactNode
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): ProjectSession {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession outside of the editor')
  return session
}

/** The project as JSON, re-rendered on every change. */
export function useDoc(): ProjectDoc {
  const session = useSession()
  return useSyncExternalStore(session.subscribe, session.getDoc)
}

export function useScreen(screenId: ScreenId): Screen | undefined {
  return useDoc().screens[screenId]
}

export function useSaveState() {
  const session = useSession()
  return useSyncExternalStore(session.subscribe, session.getSaveState)
}

export function useUndoState() {
  const session = useSession()
  const canUndo = useSyncExternalStore(session.subscribe, session.canUndo)
  const canRedo = useSyncExternalStore(session.subscribe, session.canRedo)
  return { canUndo, canRedo }
}

export function useAssetsVersion() {
  const session = useSession()
  return useSyncExternalStore(session.subscribe, session.getAssetsVersion)
}

/**
 * `session.assetUrl` as a value that changes when a file arrives (loaded after the document
 * named it): components memoised by the React Compiler then draw it. Read asset URLs in
 * rendering through this, never through `session.assetUrl` directly. The function reads
 * `version` for real: the compiler keeps only the dependencies a memo actually uses.
 */
export function useAssetUrl(): (value: string) => string | undefined {
  const session = useSession()
  const version = useAssetsVersion()
  return useMemo(
    () => (value: string) => (version >= 0 ? session.assetUrl(value) : undefined),
    [session, version],
  )
}
