import { BADGES, type BadgeId, badgesFromProgress, badgesFromProject } from '@rublox/learn'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Mascot } from '../components/brand.tsx'
import { useDoc } from '../editor/context.tsx'
import { usePrefs } from '../lib/prefs.ts'
import { play } from './sounds.ts'
import { awardBadge, useLearn } from './store.ts'

/** Looks for badges earned by the project being edited, and by the progression. */
export function BadgeWatcher() {
  const doc = useDoc()
  const progress = useLearn((s) => s.progress)
  const loaded = useLearn((s) => s.loaded)
  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => {
      for (const id of new Set([...badgesFromProject(doc), ...badgesFromProgress(progress)])) {
        if (!progress.badges[id]) void awardBadge(id)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [doc, progress, loaded])
  return null
}

/** Announces new badges, with the mascot in Junior. Studio can hide badges (SPEC § 4.10). */
export function BadgeToasts() {
  const { t } = useTranslation()
  const queue = useLearn((s) => s.newBadges)
  const mode = usePrefs((s) => s.mode)
  const show = usePrefs((s) => s.showBadges)
  useEffect(() => {
    if (!queue.length) return
    useLearn.setState({ newBadges: [] })
    if (mode === 'studio' && !show) return
    queue.forEach((id: BadgeId, index) => {
      const badge = BADGES.find((b) => b.id === id)
      const texts = t(`learn.badges.${id}` as 'learn.badges.loop', {
        returnObjects: true,
      }) as unknown as {
        title: string
        text: string
      }
      setTimeout(() => {
        play('badge')
        toast(t('learn.badgeEarned', { title: texts.title }), {
          description: texts.text,
          icon:
            mode === 'junior' ? (
              <Mascot size={30} mood="cheer" />
            ) : (
              <span aria-hidden="true">{badge?.icon}</span>
            ),
          duration: 5000,
        })
      }, index * 700)
    })
  }, [queue, mode, show, t])
  return null
}
