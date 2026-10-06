import { APP_WORKSPACE, type ProjectDoc, type ScreenId, type WorkspaceKey } from '@rublox/schema'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { EditorTab } from '../routes/p.$projectId.tsx'

/** The screen shown in Design: the one in the URL, or the start screen. */
export function resolveScreen(doc: ProjectDoc, requested: string | undefined): ScreenId {
  if (requested && doc.screens[requested]) return requested
  return doc.screens[doc.settings.navigation.startScreen]
    ? doc.settings.navigation.startScreen
    : (doc.screenOrder[0] ?? '')
}

/** The workspace shown in Blocks: a screen, or `app`. */
export function resolveWorkspace(doc: ProjectDoc, requested: string | undefined): WorkspaceKey {
  return requested === APP_WORKSPACE ? APP_WORKSPACE : resolveScreen(doc, requested)
}

export function useEditorNavigate(projectId: string) {
  const navigate = useNavigate()
  return useCallback(
    (to: { tab?: EditorTab; screen?: string }) =>
      navigate({
        to: '/p/$projectId',
        params: { projectId },
        search: (previous: { tab?: EditorTab; screen?: string }) => ({
          tab: previous.tab ?? 'design',
          screen: previous.screen,
          ...to,
        }),
        replace: true,
      }),
    [navigate, projectId],
  )
}
