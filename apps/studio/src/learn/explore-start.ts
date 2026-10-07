import type { ExploreLevel } from '@rublox/explore'
import { usePrefs } from '../lib/prefs.ts'
import { queryClient } from '../lib/query.ts'
import { storeProject } from './start.ts'
import { saveExplore, useLearn } from './store.ts'

/** `@rublox/explore` (the levels and their recipes): loaded only where it is needed. */
export const loadExplore = () => import('@rublox/explore')

/**
 * Opens a copy of a level (J9) among one's projects: in the account, or in this browser for a
 * guest. The original never changes; a new copy starts its guided tour. Returns the project.
 */
export async function openLevelCopy(level: ExploreLevel, title: string): Promise<string> {
  const { levelKey, levelProject } = await loadExplore()
  const { locale, mode } = usePrefs.getState()
  const doc = levelProject(level, { locale, mode, name: title })
  const projectId = await storeProject(doc)
  const previous = useLearn.getState().progress.explore[levelKey(level.app, level.level)]
  await saveExplore({
    id: levelKey(level.app, level.level),
    app: level.app,
    level: level.level,
    projectId,
    step: 0,
    tourDone: previous?.tourDone ?? false,
    challenges: previous?.challenges ?? [],
    done: previous?.done ?? false,
    updatedAt: new Date().toISOString(),
  })
  useLearn.setState({
    explore: {
      app: level.app,
      level: level.level,
      projectId,
      view: 'tour',
      step: 0,
      paused: false,
      collapsed: false,
    },
    events: [],
  })
  void queryClient.invalidateQueries({ queryKey: ['projects'] })
  return projectId
}
