import { useEffect } from 'react'
import { useMe } from '../lib/session.ts'
import { browserProgressStore } from '../storage/learning.ts'
import { setProgressStore } from './store.ts'

/**
 * Picks the progression of whoever uses the studio: the guest's, or the account's. Both live
 * in this browser for now; the server tables (SPEC § 6.8, `learning_progress`, `badges`) can
 * replace the account's store without touching anything else (`ProgressStore`).
 */
export function useLearningSync(): void {
  const me = useMe()
  const userId = me.isPending ? undefined : (me.data?.user?.id ?? null)
  useEffect(() => {
    if (userId === undefined) return
    setProgressStore(browserProgressStore(userId ?? 'guest'))
  }, [userId])
}
