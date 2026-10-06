import { useEffect } from 'react'
import { useMe } from '../lib/session.ts'
import { browserProgressStore } from '../storage/learning.ts'
import { setProgressStore } from './store.ts'

/**
 * Picks where the progression lives: this browser in guest mode. Signed-in accounts use the
 * same store until the server keeps it (SPEC § 6.8, `learning_progress`).
 */
export function useLearningSync(): void {
  const me = useMe()
  const userId = me.isPending ? undefined : (me.data?.user?.id ?? null)
  useEffect(() => {
    if (userId === undefined) return
    setProgressStore(browserProgressStore)
  }, [userId])
}
