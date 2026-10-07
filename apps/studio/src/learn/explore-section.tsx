import { EXPLORE_APPS, type ExploreApp, levelKey } from '@rublox/explore'
import type { Accent } from '@rublox/learn'
import { useNavigate } from '@tanstack/react-router'
import { Check, Copy, Info, Play, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../components/ui/button.tsx'
import { cn } from '../lib/cn.ts'
import { errorMessage } from '../lib/errors.ts'
import { usePrefs } from '../lib/prefs.ts'
import { useMe } from '../lib/session.ts'
import { openLevelCopy } from './explore-start.ts'
import { useLearn } from './store.ts'

const ACCENTS: Record<Accent, string> = {
  indigo: 'bg-primary-soft',
  coral: 'bg-coral-soft',
  yellow: 'bg-yellow-soft',
  mint: 'bg-mint-soft',
}

/**
 * "Apps to take apart" (J9): one card per app, its four levels, and "Open a copy". Loaded
 * on demand by the learning page (the levels are big).
 */
export default function ExploreSection() {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="learn-explore" className="mt-10" data-testid="explore-section">
      <h2 id="learn-explore" className="text-ui-lg font-strong">
        {t('explore.section')}
      </h2>
      <p className="mt-1 max-w-3xl text-ui-sm text-muted">{t('explore.lead')}</p>
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {EXPLORE_APPS.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </ul>
    </section>
  )
}

function AppCard({ app }: { app: ExploreApp }) {
  const { t } = useTranslation()
  const locale = usePrefs((s) => s.locale)
  const progress = useLearn((s) => s.progress.explore)
  const me = useMe()
  const navigate = useNavigate()
  const entries = app.levels.map((level) => progress[levelKey(app.id, level.level)])
  // The first level not finished yet.
  const [picked, pick] = useState(
    () =>
      app.levels[
        Math.max(
          0,
          entries.findIndex((entry) => !entry?.done),
        )
      ]?.level ?? 1,
  )
  const [busy, setBusy] = useState(false)
  const level = app.levels.find((entry) => entry.level === picked) ?? app.levels[0]
  if (!level) return null
  const entry = progress[levelKey(app.id, level.level)]
  const texts = app.texts[locale]
  const levelTexts = level.texts[locale]
  const total = level.challenges.length
  const open = (projectId: string) =>
    navigate({ to: '/p/$projectId', params: { projectId }, search: { tab: 'blocks' } })
  const start = async () => {
    setBusy(true)
    try {
      const id = await openLevelCopy(
        level,
        t('explore.copyName', { title: texts.title, level: level.level }),
      )
      await open(id)
    } catch (error) {
      toast.error(errorMessage(t, error))
      setBusy(false)
    }
  }
  const resume = () => {
    if (!entry) return
    useLearn.setState({
      explore: {
        app: app.id,
        level: level.level,
        projectId: entry.projectId,
        view: entry.tourDone ? 'challenges' : 'tour',
        step: entry.tourDone ? 0 : entry.step,
        paused: false,
        collapsed: false,
      },
      events: [],
    })
    void open(entry.projectId)
  }
  return (
    <li
      className="flex flex-col overflow-hidden rounded-ui-lg border border-border bg-surface shadow-1"
      data-testid={`explore-${app.id}`}
    >
      <div className={cn('flex items-center gap-4 px-5 py-4', ACCENTS[app.accent])}>
        <span aria-hidden="true" className="text-[44px] leading-none">
          {app.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-strong text-ui-lg">{texts.title}</h3>
          <span className="text-ui-sm text-muted">{t(`explore.kinds.${app.kind}`)}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-ui-sm text-muted">{texts.summary}</p>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-ui-sm font-strong">{t('explore.levels')}</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {app.levels.map((option, index) => {
              const done = entries[index]?.done
              const selected = option.level === level.level
              return (
                <button
                  key={option.level}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(option.level)}
                  data-testid={`explore-${app.id}-level-${option.level}`}
                  className={cn(
                    'relative flex h-10 items-center justify-center gap-1 rounded-ui border font-strong transition-colors junior:h-12',
                    selected
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-border bg-surface-2 hover:border-border-strong',
                  )}
                >
                  {option.level}
                  {done ? (
                    <Check
                      size={14}
                      strokeWidth={3}
                      className={selected ? '' : 'text-mint-text'}
                      aria-label={t('explore.levelDone')}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className="flex flex-1 flex-col gap-1 rounded-ui bg-surface-2 p-3">
          <p className="font-strong">
            {t('explore.level', { level: level.level })} · {levelTexts.title}
          </p>
          <p className="text-ui-sm text-muted">{levelTexts.summary}</p>
          {entry ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-sm">
              {entry.tourDone ? (
                <span className="inline-flex items-center gap-1 text-mint-text">
                  <Check size={14} strokeWidth={3} />
                  {t('explore.tourDone')}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Star
                  size={14}
                  className={entry.challenges.length ? 'text-yellow' : 'text-muted'}
                  fill={entry.challenges.length ? 'currentColor' : 'none'}
                />
                {t('explore.challengesDone', { done: entry.challenges.length, total })}
              </span>
            </p>
          ) : null}
        </div>
        <p className="flex items-start gap-1.5 text-ui-sm text-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t('explore.copyNote')} {me.data?.user ? null : t('explore.copyNoteGuest')}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {entry ? (
            <Button size="sm" icon={<Play size={14} />} onClick={resume}>
              {t('explore.resume')}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            icon={<Copy size={14} />}
            disabled={busy}
            onClick={start}
            data-testid="explore-open"
            aria-label={`${entry ? t('explore.openAgain') : t('explore.open')} : ${texts.title}, ${t('explore.level', { level: level.level })}`}
          >
            {entry ? t('explore.openAgain') : t('explore.open')}
          </Button>
        </div>
      </div>
    </li>
  )
}
