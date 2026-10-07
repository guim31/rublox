import {
  type Accent,
  BADGES,
  CHALLENGES,
  type Challenge,
  TUTORIALS,
  type Tutorial,
} from '@rublox/learn'
import { useNavigate } from '@tanstack/react-router'
import { Check, Clock, Eye, EyeOff, Play, RotateCcw, Sparkles, Star } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Page } from '../components/app-header.tsx'
import { Mascot } from '../components/brand.tsx'
import { Button } from '../components/ui/button.tsx'
import { cn } from '../lib/cn.ts'
import { errorMessage } from '../lib/errors.ts'
import { usePrefs } from '../lib/prefs.ts'
import { relativeTime } from '../lib/time.ts'
import { openChallenge, resumeTutorial, startChallenge, startTutorial } from './start.ts'
import { ensureProgress, useLearn } from './store.ts'

const ACCENTS: Record<Accent, string> = {
  indigo: 'bg-primary-soft',
  coral: 'bg-coral-soft',
  yellow: 'bg-yellow-soft',
  mint: 'bg-mint-soft',
}

/** The learning page (SPEC § 4.10): tutorials, challenges and badges. */
export function LearnPage() {
  const { t } = useTranslation()
  const mode = usePrefs((s) => s.mode)
  useEffect(() => {
    void ensureProgress()
  }, [])
  const modes =
    mode === 'studio' ? (['studio', 'junior'] as const) : (['junior', 'studio'] as const)
  return (
    <Page title={t('learn.title')} subtitle={t('learn.lead')}>
      <section aria-labelledby="learn-tutorials" className="mt-8">
        <h2 id="learn-tutorials" className="text-ui-lg font-strong">
          {t('learn.tutorials')}
        </h2>
        {modes.map((group) => (
          <div key={group} className="mt-4">
            <h3 className="mb-2 text-ui-sm font-strong text-muted">{t(`learn.${group}`)}</h3>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {TUTORIALS.filter((tutorial) => tutorial.mode === group).map((tutorial) => (
                <TutorialCard key={tutorial.id} tutorial={tutorial} />
              ))}
              {group === 'junior' ? <SoonCard /> : null}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="learn-challenges" className="mt-10">
        <h2 id="learn-challenges" className="text-ui-lg font-strong">
          {t('learn.challenges')}
        </h2>
        <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {[...CHALLENGES]
            .sort((a, b) => (a.mode === b.mode ? 0 : a.mode === mode ? -1 : 1))
            .map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
        </ul>
      </section>

      <BadgesSection />
    </Page>
  )
}

function Card({
  accent,
  icon,
  children,
  testId,
}: {
  accent: Accent
  icon: string
  children: ReactNode
  testId?: string
}) {
  return (
    <li
      className="flex flex-col overflow-hidden rounded-ui-lg border border-border bg-surface shadow-1 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-2"
      data-testid={testId}
    >
      <div className={cn('grid h-24 place-items-center text-[44px]', ACCENTS[accent])}>
        <span aria-hidden="true">{icon}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">{children}</div>
    </li>
  )
}

function useOpen() {
  const navigate = useNavigate()
  return (projectId: string) =>
    navigate({ to: '/p/$projectId', params: { projectId }, search: { tab: 'design' } })
}

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  const { t } = useTranslation()
  const locale = usePrefs((s) => s.locale)
  const entry = useLearn((s) => s.progress.tutorials[tutorial.id])
  const open = useOpen()
  const [busy, setBusy] = useState(false)
  const texts = tutorial.texts[locale]
  const total = tutorial.steps.length
  const start = async () => {
    setBusy(true)
    try {
      await open(await startTutorial(tutorial))
    } catch (error) {
      toast.error(errorMessage(t, error))
      setBusy(false)
    }
  }
  return (
    <Card accent={tutorial.accent} icon={tutorial.icon} testId={`tutorial-${tutorial.id}`}>
      <h4 className="font-strong text-ui-lg">{texts.title}</h4>
      <p className="flex-1 text-ui-sm text-muted">{texts.summary}</p>
      <p className="flex items-center gap-3 text-ui-sm text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock size={14} aria-hidden="true" />
          {t('learn.minutes', { count: tutorial.minutes })}
        </span>
        <span>{t('learn.steps', { count: total })}</span>
      </p>
      {entry?.status === 'started' ? (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((entry.step / total) * 100)}%` }}
            />
          </div>
          <span className="text-ui-sm text-muted">
            {t('learn.inProgress', { step: Math.min(entry.step + 1, total), total })}
          </span>
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {entry?.status === 'done' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 text-ui-sm font-strong text-mint-text">
            <Check size={14} />
            {t('learn.done')}
          </span>
        ) : null}
        <div className="flex-1" />
        {entry?.status === 'started' ? (
          <>
            <Button size="sm" icon={<RotateCcw size={14} />} disabled={busy} onClick={start}>
              {t('learn.restart')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Play size={14} />}
              onClick={() => {
                resumeTutorial(tutorial, entry.projectId, entry.step)
                void open(entry.projectId)
              }}
            >
              {t('learn.resume')}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant={entry?.status === 'done' ? 'secondary' : 'primary'}
            icon={entry?.status === 'done' ? <RotateCcw size={14} /> : <Play size={14} />}
            disabled={busy}
            onClick={start}
            aria-label={`${entry?.status === 'done' ? t('learn.redo') : t('learn.start')} : ${texts.title}`}
          >
            {entry?.status === 'done' ? t('learn.redo') : t('learn.start')}
          </Button>
        )}
      </div>
    </Card>
  )
}

function SoonCard() {
  const { t } = useTranslation()
  return (
    <li className="flex flex-col items-center justify-center gap-2 rounded-ui-lg border border-dashed border-border-strong p-5 text-center">
      <Mascot size={64} mood="think" className="text-text" />
      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-ui-sm font-strong text-muted">
        {t('learn.soon')}
      </span>
      <p className="text-ui-sm text-muted">{t('learn.soonTutorials')}</p>
    </li>
  )
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const { t } = useTranslation()
  const locale = usePrefs((s) => s.locale)
  const entry = useLearn((s) => s.progress.challenges[challenge.id])
  const open = useOpen()
  const [busy, setBusy] = useState(false)
  const texts = challenge.texts[locale]
  const stars = entry?.stars ?? 0
  return (
    <Card accent={challenge.accent} icon={challenge.icon} testId={`challenge-${challenge.id}`}>
      <div className="flex items-start gap-2">
        <h4 className="flex-1 font-strong text-ui-lg">{texts.title}</h4>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-ui-sm text-muted">
          {t(`learn.${challenge.mode}`)}
        </span>
      </div>
      <p className="flex-1 text-ui-sm text-muted">{texts.goal}</p>
      <span
        className="flex items-center gap-0.5"
        role="img"
        aria-label={t('learn.starsOf', { count: stars })}
      >
        {[0, 1, 2].map((index) => (
          <Star
            key={index}
            size={18}
            className={index < stars ? 'text-yellow' : 'text-border-strong'}
            fill={index < stars ? 'currentColor' : 'none'}
          />
        ))}
      </span>
      <div className="mt-1 flex flex-wrap justify-end gap-2">
        {entry ? (
          <Button
            size="sm"
            icon={<Play size={14} />}
            onClick={() => {
              openChallenge(challenge, entry.projectId)
              void open(entry.projectId)
            }}
          >
            {t('learn.resume')}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={entry ? 'secondary' : 'primary'}
          icon={entry ? <RotateCcw size={14} /> : <Sparkles size={14} />}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await open(await startChallenge(challenge))
            } catch (error) {
              toast.error(errorMessage(t, error))
              setBusy(false)
            }
          }}
        >
          {entry ? t('learn.restart') : t('learn.start')}
        </Button>
      </div>
    </Card>
  )
}

function BadgesSection() {
  const { t, i18n } = useTranslation()
  const badges = useLearn((s) => s.progress.badges)
  const { mode, showBadges, set } = usePrefs()
  const hidden = mode === 'studio' && !showBadges
  const earned = BADGES.filter((badge) => badges[badge.id]).length
  return (
    <section aria-labelledby="learn-badges" className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="learn-badges" className="text-ui-lg font-strong">
          {t('learn.badgesTitle')}
        </h2>
        {hidden ? null : (
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-ui-sm text-muted">
            {t('learn.progress', { done: earned, total: BADGES.length })}
          </span>
        )}
        <div className="flex-1" />
        {mode === 'studio' ? (
          <Button
            size="sm"
            variant="ghost"
            icon={showBadges ? <EyeOff size={14} /> : <Eye size={14} />}
            onClick={() => set({ showBadges: !showBadges })}
          >
            {showBadges ? t('learn.hideBadges') : t('learn.showBadges')}
          </Button>
        ) : null}
      </div>
      {hidden ? (
        <p className="mt-3 text-ui-sm text-muted">{t('learn.badgesHidden')}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {BADGES.map((badge) => {
            const award = badges[badge.id]
            const texts = t(`learn.badges.${badge.id}` as 'learn.badges.loop', {
              returnObjects: true,
            }) as unknown as { title: string; text: string }
            return (
              <li
                key={badge.id}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-ui-lg border p-4 text-center',
                  award ? 'border-border bg-surface shadow-1' : 'border-dashed border-border',
                )}
                data-testid={`badge-${badge.id}`}
                data-earned={award ? 'true' : 'false'}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-14 place-items-center rounded-full text-[28px]',
                    award ? ACCENTS[badge.accent] : 'bg-surface-2 opacity-60 grayscale',
                  )}
                >
                  {badge.icon}
                </span>
                <span className="font-strong">{texts.title}</span>
                <span className="text-ui-sm text-muted">{texts.text}</span>
                <span className="text-ui-sm text-muted">
                  {award
                    ? t('learn.earned', { when: relativeTime(award.awardedAt, t, i18n.language) })
                    : badge.available
                      ? t('learn.locked')
                      : t('learn.lockedSoon')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
