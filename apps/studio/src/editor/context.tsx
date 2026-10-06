import type { ProjectDoc, Screen, ScreenId } from '@rublox/schema'
import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react'
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
