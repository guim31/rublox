import { evaluate, fillNames, getTutorial, type LearnState } from '@rublox/learn'
import { useNavigate } from '@tanstack/react-router'
import { Check, GraduationCap, Lightbulb, Pause, Play, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mascot } from '../components/brand.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { useDoc } from '../editor/context.tsx'
import { useEditor } from '../editor/store.ts'
import { cn } from '../lib/cn.ts'
import { usePrefs } from '../lib/prefs.ts'
import { Bubble, RichText } from './bubble.tsx'
import { Confetti } from './confetti.tsx'
import { play } from './sounds.ts'
import { clearEvents, ensureProgress, saveTutorial, useLearn } from './store.ts'

/** How long "Nice one!" stays before the next step. */
const STEP_DONE_MS = 900

/**
 * The tutorial of this project, if one is being followed: the bubble of the current step, its
 * automatic validation, pause, and the final celebration (SPEC § 4.10).
 */
export function TutorialRunner({
  projectId,
  tab,
  workspace,
}: {
  projectId: string
  tab: 'design' | 'blocks'
  workspace: string
}) {
  const active = useLearn((s) => (s.tutorial?.projectId === projectId ? s.tutorial : null))

  // Opening a project whose tutorial is not finished picks it up where it stopped.
  const loaded = useLearn((s) => s.loaded)
  useEffect(() => {
    let cancelled = false
    // Waits for the progression of whoever is signed in (`sync.ts`).
    if (!loaded) return
    void ensureProgress().then((progress) => {
      const state = useLearn.getState()
      if (cancelled || state.tutorial?.projectId === projectId) return
      if (state.dismissed.includes(projectId)) return
      const entry = Object.values(progress.tutorials).find(
        (t) => t.projectId === projectId && t.status === 'started',
      )
      if (entry && getTutorial(entry.id))
        useLearn.setState({
          tutorial: { id: entry.id, projectId, step: entry.step, paused: false, finished: false },
          events: [],
        })
    })
    return () => {
      cancelled = true
    }
  }, [projectId, loaded])

  if (!active) return null
  return <Runner key={active.id} tab={tab} workspace={workspace} />
}

function Runner({ tab, workspace }: { tab: 'design' | 'blocks'; workspace: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const doc = useDoc()
  const locale = usePrefs((s) => s.locale)
  const mode = usePrefs((s) => s.mode)
  const active = useLearn((s) => s.tutorial)
  const events = useLearn((s) => s.events)
  const previewScreen = useLearn((s) => s.previewScreen)
  const selected = useEditor((s) => s.selected)
  const slowMotion = useEditor((s) => s.slow.enabled)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState(false)
  const tutorial = active ? getTutorial(active.id) : undefined
  const step = active && tutorial ? tutorial.steps[active.step] : undefined
  const texts = tutorial?.texts[locale]

  const state: LearnState = useMemo(
    () => ({
      doc,
      tab,
      workspace,
      selectedType: selected ? (doc.screens[workspace]?.components[selected]?.type ?? null) : null,
      events,
      previewScreen,
      slowMotion,
    }),
    [doc, tab, workspace, selected, events, previewScreen, slowMotion],
  )

  const advancing = useRef(false)
  const advance = async () => {
    if (!active || !tutorial || advancing.current) return
    advancing.current = true
    const next = active.step + 1
    const now = new Date().toISOString()
    const finished = next >= tutorial.steps.length
    useLearn.setState({ tutorial: { ...active, step: next, finished }, events: [] })
    setDone(false)
    setHint(false)
    clearEvents()
    play(finished ? 'finish' : 'step')
    await saveTutorial({
      id: tutorial.id,
      projectId: active.projectId,
      step: next,
      status: finished ? 'done' : 'started',
      updatedAt: now,
      ...(finished ? { completedAt: now } : {}),
    })
    advancing.current = false
  }

  // A step is validated as soon as its check holds…
  useEffect(() => {
    if (!step?.check || step.check.kind === 'manual' || done || active?.paused) return
    if (evaluate(step.check, state)) setDone(true)
  }, [state, step, done, active?.paused])

  // …then "Nice one!" stays a moment, whatever else changes meanwhile.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `advance` reads the latest state
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => void advance(), STEP_DONE_MS)
    return () => clearTimeout(timer)
  }, [done])

  if (!active || !tutorial || !texts) return null

  const quit = () =>
    useLearn.setState((s) => ({ tutorial: null, dismissed: [...s.dismissed, active.projectId] }))

  if (active.finished) {
    return (
      <FinishCard
        title={texts.title}
        text={texts.done}
        onLearn={() => {
          useLearn.setState({ tutorial: null })
          void navigate({ to: '/learn' })
        }}
        onClose={() => useLearn.setState({ tutorial: null })}
      />
    )
  }

  if (active.paused) {
    return (
      <div className="rx-pop fixed bottom-4 left-4 z-[61] flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pr-1.5 pl-4 shadow-2">
        <GraduationCap size={16} className="text-primary-text" />
        <span className="text-ui-sm font-strong">{t('tutorial.paused')}</span>
        <Button
          size="sm"
          variant="primary"
          icon={<Play size={14} />}
          onClick={() => useLearn.setState({ tutorial: { ...active, paused: false } })}
        >
          {t('tutorial.resume')}
        </Button>
      </div>
    )
  }

  if (!step) return null
  const stepTexts = texts.steps[step.id]
  const manual = !step.check || step.check.kind === 'manual'
  const total = tutorial.steps.length
  return (
    <Bubble
      target={step.target}
      doc={doc}
      label={t('tutorial.label', { title: texts.title })}
      fallback={active.step === 0 ? 'center' : 'corner'}
      testId="tutorial-bubble"
    >
      <header className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ui-sm font-strong text-primary-text">
          <GraduationCap size={15} className="shrink-0" />
          <span className="truncate">{texts.title}</span>
        </span>
        <IconButton
          size="sm"
          label={t('tutorial.pause')}
          onClick={() => useLearn.setState({ tutorial: { ...active, paused: true } })}
        >
          <Pause size={14} />
        </IconButton>
        <IconButton size="sm" label={t('tutorial.quit')} onClick={quit}>
          <X size={15} />
        </IconButton>
      </header>
      <div className="flex gap-3">
        {mode === 'junior' ? (
          <Mascot
            size={64}
            mood={done ? 'cheer' : (step.mood ?? 'happy')}
            animated={done || active.step === 0}
            className="shrink-0 text-text"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {done ? (
            <p
              className="rx-pop flex items-center gap-2 text-ui-lg font-strong text-mint-text"
              role="status"
            >
              <span className="grid size-7 place-items-center rounded-full bg-mint text-white">
                <Check size={17} strokeWidth={3} />
              </span>
              {t('tutorial.stepDone')}
            </p>
          ) : (
            <p className="leading-relaxed" data-testid="tutorial-text">
              <RichText text={fillNames(stepTexts?.text ?? '', doc)} />
            </p>
          )}
          {!done && stepTexts?.hint ? (
            hint ? (
              <p className="mt-2 flex gap-1.5 rounded-ui bg-yellow-soft px-2.5 py-1.5 text-ui-sm">
                <Lightbulb size={15} className="mt-0.5 shrink-0 text-yellow" />
                <span>
                  <RichText text={fillNames(stepTexts.hint, doc)} />
                </span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setHint(true)}
                className="mt-2 inline-flex items-center gap-1 rounded text-ui-sm font-strong text-primary-text hover:underline"
              >
                <Lightbulb size={14} />
                {t('tutorial.hint')}
              </button>
            )
          ) : null}
        </div>
      </div>
      <footer className="flex items-center gap-3">
        <Progress step={active.step} total={total} />
        <span className="text-ui-sm text-muted tabular-nums">
          {t('tutorial.step', { step: active.step + 1, total })}
        </span>
        <div className="flex-1" />
        {manual ? (
          <Button variant="primary" size="sm" onClick={() => void advance()} autoFocus>
            {active.step === 0 ? t('tutorial.letsGo') : t('tutorial.next')}
          </Button>
        ) : null}
      </footer>
    </Bubble>
  )
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed list of dots
          key={index}
          className={cn(
            'h-1.5 rounded-full transition-all duration-200',
            index < step ? 'w-1.5 bg-mint' : index === step ? 'w-4 bg-primary' : 'w-1.5 bg-border',
          )}
        />
      ))}
    </div>
  )
}

function FinishCard({
  title,
  text,
  onLearn,
  onClose,
}: {
  title: string
  text: string
  onLearn: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Confetti />
      <div className="fixed inset-0 z-[62] grid place-items-center bg-overlay/40 p-4 rx-anim-in">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-finished"
          className="rx-pop flex w-[min(92vw,440px)] flex-col items-center gap-3 rounded-ui-lg border border-border bg-surface p-7 text-center shadow-3"
          data-testid="tutorial-finished"
        >
          <Mascot size={120} mood="cheer" animated className="text-text" />
          <h2 id="tutorial-finished" className="text-ui-xl font-strong">
            {t('tutorial.finishedTitle')}
          </h2>
          <p className="font-strong text-primary-text">{title}</p>
          <p className="text-muted">{text}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={onClose}>{t('tutorial.keepGoing')}</Button>
            <Button variant="primary" onClick={onLearn} autoFocus>
              {t('tutorial.backToLearn')}
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
