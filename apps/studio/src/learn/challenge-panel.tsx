import { type Challenge, evaluate, getChallenge, type LearnState } from '@rublox/learn'
import { ChevronDown, ChevronUp, Lightbulb, Star, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { IconButton } from '../components/ui/button.tsx'
import { useDoc } from '../editor/context.tsx'
import { useEditor } from '../editor/store.ts'
import { cn } from '../lib/cn.ts'
import { usePrefs } from '../lib/prefs.ts'
import { Confetti } from './confetti.tsx'
import { play } from './sounds.ts'
import { ensureProgress, saveChallenge, useLearn } from './store.ts'

/** The challenge of this project, if any: its goal and its three stars, checked live. */
export function ChallengePanel({
  projectId,
  tab,
  workspace,
}: {
  projectId: string
  tab: 'design' | 'blocks' | 'data'
  workspace: string
}) {
  const active = useLearn((s) => (s.challenge?.projectId === projectId ? s.challenge : null))

  const loaded = useLearn((s) => s.loaded)
  useEffect(() => {
    let cancelled = false
    // Waits for the progression of whoever is signed in (`sync.ts`).
    if (!loaded) return
    void ensureProgress().then((progress) => {
      if (cancelled || useLearn.getState().challenge?.projectId === projectId) return
      const entry = Object.values(progress.challenges).find((c) => c.projectId === projectId)
      if (entry && getChallenge(entry.id))
        useLearn.setState({ challenge: { id: entry.id, projectId, collapsed: false } })
    })
    return () => {
      cancelled = true
    }
  }, [projectId, loaded])

  const challenge = active ? getChallenge(active.id) : undefined
  if (!active || !challenge) return null
  return (
    <Panel
      challenge={challenge}
      projectId={projectId}
      collapsed={active.collapsed}
      tab={tab}
      workspace={workspace}
    />
  )
}

function Panel({
  challenge,
  projectId,
  collapsed,
  tab,
  workspace,
}: {
  challenge: Challenge
  projectId: string
  collapsed: boolean
  tab: 'design' | 'blocks' | 'data'
  workspace: string
}) {
  const { t } = useTranslation()
  const doc = useDoc()
  const locale = usePrefs((s) => s.locale)
  const events = useLearn((s) => s.events)
  const previewScreen = useLearn((s) => s.previewScreen)
  const best = useLearn((s) => s.progress.challenges[challenge.id]?.stars ?? 0)
  const slowMotion = useEditor((s) => s.slow.enabled)
  const [hint, setHint] = useState(false)
  const [party, setParty] = useState(false)
  const texts = challenge.texts[locale]

  const state: LearnState = useMemo(
    () => ({
      doc,
      tab,
      workspace,
      selectedType: null,
      events,
      previewScreen,
      slowMotion,
    }),
    [doc, tab, workspace, events, previewScreen, slowMotion],
  )
  const earned = challenge.stars.map((star) => evaluate(star, state))
  const count = earned.filter(Boolean).length

  // A new best: saved, celebrated.
  const saved = useRef(best)
  useEffect(() => {
    if (count <= saved.current) return
    saved.current = count
    void saveChallenge({
      id: challenge.id,
      projectId,
      stars: count,
      updatedAt: new Date().toISOString(),
    })
    if (count === 3) {
      play('finish')
      setParty(true)
      toast.success(t('challenge.allStars'))
    } else {
      play('star')
      toast.success(t('challenge.starEarned'))
    }
  }, [count, challenge.id, projectId, t])

  const close = () => useLearn.setState({ challenge: null })
  const toggle = () =>
    useLearn.setState((s) => ({
      challenge: s.challenge && { ...s.challenge, collapsed: !collapsed },
    }))

  return (
    <>
      {party ? <Confetti /> : null}
      <section
        aria-label={t('challenge.label', { title: texts.title })}
        className="rx-pop fixed bottom-14 left-4 z-30 w-[320px] rounded-ui-lg border border-border bg-surface shadow-2 junior:bottom-16 junior:w-[350px]"
        data-testid="challenge-panel"
      >
        <header className="flex items-center gap-2 px-3 py-2">
          <Trophy size={16} className="shrink-0 text-yellow" />
          <h2 className="min-w-0 flex-1 truncate font-strong">{texts.title}</h2>
          <span
            className="flex items-center gap-0.5"
            role="img"
            aria-label={t('learn.starsOf', { count })}
          >
            {earned.map((on, index) => (
              <Star
                // biome-ignore lint/suspicious/noArrayIndexKey: three fixed stars
                key={index}
                size={15}
                className={on ? 'text-yellow' : 'text-border-strong'}
                fill={on ? 'currentColor' : 'none'}
              />
            ))}
          </span>
          <IconButton
            size="sm"
            label={collapsed ? t('challenge.expand') : t('challenge.collapse')}
            onClick={toggle}
          >
            {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </IconButton>
          <IconButton size="sm" label={t('challenge.close')} onClick={close}>
            <X size={15} />
          </IconButton>
        </header>
        {collapsed ? null : (
          <div className="flex flex-col gap-2.5 border-t border-border px-3 pt-2.5 pb-3">
            <p className="text-ui-sm leading-relaxed">{texts.goal}</p>
            <ol className="flex flex-col gap-1.5">
              {texts.stars.map((text, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: three fixed stars
                  key={index}
                  className={cn(
                    'flex items-start gap-2 rounded-ui px-2 py-1.5 text-ui-sm transition-colors',
                    earned[index] ? 'bg-yellow-soft' : 'bg-surface-2',
                  )}
                  data-testid={`challenge-star-${index + 1}`}
                  data-earned={earned[index] ? 'true' : 'false'}
                >
                  <Star
                    size={15}
                    className={cn('mt-0.5 shrink-0', earned[index] ? 'text-yellow' : 'text-muted')}
                    fill={earned[index] ? 'currentColor' : 'none'}
                  />
                  {text}
                </li>
              ))}
            </ol>
            {texts.hint ? (
              hint ? (
                <p className="flex gap-1.5 text-ui-sm text-muted">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-yellow" />
                  {texts.hint}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setHint(true)}
                  className="inline-flex items-center gap-1 self-start rounded text-ui-sm font-strong text-primary-text hover:underline"
                >
                  <Lightbulb size={14} />
                  {t('challenge.hint')}
                </button>
              )
            ) : null}
          </div>
        )}
      </section>
    </>
  )
}
