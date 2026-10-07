import type { ExploreLevel, LevelChallenge, TourStep } from '@rublox/explore'
import { evaluate, findBlock, type LearnState } from '@rublox/learn'
import type { ProjectDoc } from '@rublox/schema'
import { useNavigate } from '@tanstack/react-router'
import {
  Check,
  ChevronDown,
  Circle,
  Compass,
  Crosshair,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Turtle,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Mascot } from '../components/brand.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { useDoc } from '../editor/context.tsx'
import { useEditorNavigate } from '../editor/nav.ts'
import { toggleSlowMotion } from '../editor/preview/slow-motion.tsx'
import { useEditor } from '../editor/store.ts'
import { cn } from '../lib/cn.ts'
import { usePrefs } from '../lib/prefs.ts'
import { Bubble, RichText } from './bubble.tsx'
import { Confetti } from './confetti.tsx'
import { loadExplore, openLevelCopy } from './explore-start.ts'
import { play } from './sounds.ts'
import { type ActiveExplore, ensureProgress, saveExplore, useLearn } from './store.ts'

type Explore = Awaited<ReturnType<typeof loadExplore>>

/** How long "Well spotted!" stays before the next step. */
const STEP_DONE_MS = 900

/** `@rublox/explore`, once loaded, for a project copied from a level (J9). */
export function useExploreModule(doc: ProjectDoc): Explore | null {
  const [module, setModule] = useState<Explore | null>(null)
  const from = doc.meta.origin?.kind === 'explore'
  useEffect(() => {
    if (!from || module) return
    let cancelled = false
    void loadExplore().then((loaded) => {
      if (!cancelled) setModule(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [from, module])
  return from ? module : null
}

/**
 * The guided tour of a level of an app to take apart, then its modification challenges
 * (J9). Shown in a project copied from a level (`meta.origin`).
 */
export function ExploreRunner({
  projectId,
  tab,
  workspace,
}: {
  projectId: string
  tab: 'design' | 'blocks' | 'data'
  workspace: string
}) {
  const doc = useDoc()
  const explore = useExploreModule(doc)
  const level = explore ? explore.levelOf(doc) : undefined
  const active = useLearn((s) => (s.explore?.projectId === projectId ? s.explore : null))
  const loaded = useLearn((s) => s.loaded)

  // Opening a copy picks its tour or its challenges up where they were.
  useEffect(() => {
    if (!level || !explore || !loaded) return
    let cancelled = false
    void ensureProgress().then((progress) => {
      if (cancelled || useLearn.getState().explore?.projectId === projectId) return
      const entry = progress.explore[explore.levelKey(level.app, level.level)]
      const mine = entry?.projectId === projectId ? entry : undefined
      useLearn.setState({
        explore: {
          app: level.app,
          level: level.level,
          projectId,
          view: mine && !mine.tourDone ? 'tour' : 'challenges',
          step: mine && !mine.tourDone ? mine.step : 0,
          paused: false,
          // A copy whose tour was never followed here waits, folded, out of the way.
          collapsed: !mine,
        },
        events: [],
      })
    })
    return () => {
      cancelled = true
    }
  }, [level, explore, loaded, projectId])

  if (!explore || !level || !active) return null
  const local = explore.localLevel(level, doc.meta.locale)
  if (active.view === 'tour')
    return (
      <Tour
        key={`${active.step}`}
        level={level}
        tour={local.tour}
        active={active}
        tab={tab}
        workspace={workspace}
        projectId={projectId}
        explore={explore}
      />
    )
  return (
    <Challenges
      level={level}
      challenges={local.challenges}
      active={active}
      tab={tab}
      workspace={workspace}
      projectId={projectId}
      explore={explore}
    />
  )
}

/** The workspace a block is in, when it is one of the project's. */
function workspaceOf(doc: ProjectDoc, id: string): string | null {
  return findBlock(doc, id)?.workspace ?? null
}

/** Blocks lit by slow motion since the component mounted. */
function useStepped(): string[] {
  const step = useEditor((s) => s.slow.step)
  const [stepped, setStepped] = useState<string[]>([])
  useEffect(() => {
    const id = step?.blockId
    if (id) setStepped((list) => (list.includes(id) ? list : [...list.slice(-199), id]))
  }, [step])
  return stepped
}

function useLearnState(tab: LearnState['tab'], workspace: string, stepped: string[]): LearnState {
  const doc = useDoc()
  const events = useLearn((s) => s.events)
  const previewScreen = useLearn((s) => s.previewScreen)
  const slowMotion = useEditor((s) => s.slow.enabled)
  return useMemo(
    () => ({
      doc,
      tab,
      workspace,
      selectedType: null,
      events,
      previewScreen,
      slowMotion,
      stepped,
    }),
    [doc, tab, workspace, events, previewScreen, slowMotion, stepped],
  )
}

/** Goes to the Blocks tab and the screen of a block, and scrolls it into view. */
function useShowBlock(projectId: string, tab: string, workspace: string) {
  const doc = useDoc()
  const go = useEditorNavigate(projectId)
  return (id: string) => {
    const where = workspaceOf(doc, id)
    if (!where) return false
    if (tab !== 'blocks' || where !== workspace) void go({ tab: 'blocks', screen: where })
    // Once the workspace shows it (the reveal waits for its block).
    setTimeout(
      () => useEditor.getState().set({ reveal: id }),
      tab === 'blocks' && where === workspace ? 0 : 400,
    )
    return true
  }
}

function Tour({
  level,
  tour,
  active,
  tab,
  workspace,
  projectId,
  explore,
}: {
  level: ExploreLevel
  tour: TourStep[]
  active: ActiveExplore
  tab: 'design' | 'blocks' | 'data'
  workspace: string
  projectId: string
  explore: Explore
}) {
  const { t } = useTranslation()
  const doc = useDoc()
  const mode = usePrefs((s) => s.mode)
  const stepped = useStepped()
  const state = useLearnState(tab, workspace, stepped)
  const showBlock = useShowBlock(projectId, tab, workspace)
  const [hint, setHint] = useState(false)
  const step = tour[active.step]
  const texts = level.texts[doc.meta.locale]
  const done = Boolean(step?.check && step.check.kind !== 'manual' && evaluate(step.check, state))
  const blockId = step?.target?.startsWith('block:') ? step.target.slice(6) : null

  // Entering a step that points at blocks: show them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per step (the component is keyed by it)
  useEffect(() => {
    if (blockId) showBlock(blockId)
    useLearn.setState({ events: [] })
  }, [])

  const advancing = useRef(false)
  const advance = async () => {
    if (advancing.current) return
    advancing.current = true
    const next = active.step + 1
    const finished = next >= tour.length
    play(finished ? 'finish' : 'step')
    const key = explore.levelKey(level.app, level.level)
    const previous = useLearn.getState().progress.explore[key]
    const challenges = previous?.challenges ?? []
    const tourDone = finished || Boolean(previous?.tourDone)
    await saveExplore({
      id: key,
      app: level.app,
      level: level.level,
      projectId,
      step: finished ? tour.length : next,
      tourDone,
      challenges,
      done: tourDone && challenges.length >= level.challenges.length,
      updatedAt: new Date().toISOString(),
    })
    if (finished) toast.success(t('explore.tour.finished'), { description: texts.done })
    useLearn.setState((s) => ({
      explore:
        s.explore &&
        (finished
          ? { ...s.explore, view: 'challenges', step: 0, collapsed: false }
          : { ...s.explore, step: next }),
    }))
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: `advance` reads the latest state
  useEffect(() => {
    if (!done || active.paused) return
    const timer = setTimeout(() => void advance(), STEP_DONE_MS)
    return () => clearTimeout(timer)
  }, [done, active.paused])

  const set = (patch: Partial<ActiveExplore>) =>
    useLearn.setState((s) => ({ explore: s.explore && { ...s.explore, ...patch } }))

  if (active.paused) {
    return (
      <div className="rx-pop fixed bottom-4 left-4 z-[61] flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pr-1.5 pl-4 shadow-2">
        <Compass size={16} className="text-primary-text" />
        <span className="text-ui-sm font-strong">{t('explore.tour.paused')}</span>
        <Button
          size="sm"
          variant="primary"
          icon={<Play size={14} />}
          onClick={() => set({ paused: false })}
        >
          {t('explore.tour.resume')}
        </Button>
      </div>
    )
  }
  if (!step) return null
  const stepTexts = texts.steps[step.id]
  const manual = !step.check || step.check.kind === 'manual'
  const total = tour.length
  // The block may be on another tab or screen: the bubble waits in a corner meanwhile.
  const here = blockId ? tab === 'blocks' && workspaceOf(doc, blockId) === workspace : true
  return (
    <Bubble
      target={here ? step.target : undefined}
      doc={doc}
      label={t('explore.tour.label', { title: texts.title })}
      fallback={active.step === 0 ? 'center' : 'corner'}
      testId="explore-bubble"
    >
      <header className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ui-sm font-strong text-primary-text">
          <Compass size={15} className="shrink-0" />
          <span className="truncate">{t('explore.tour.title', { level: level.level })}</span>
        </span>
        <IconButton size="sm" label={t('explore.tour.pause')} onClick={() => set({ paused: true })}>
          <Pause size={14} />
        </IconButton>
        <IconButton
          size="sm"
          label={t('explore.tour.quit')}
          onClick={() => set({ view: 'challenges', collapsed: false })}
          data-testid="explore-quit"
        >
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
              {t('explore.tour.stepDone')}
            </p>
          ) : (
            <p className="leading-relaxed" data-testid="explore-text">
              <RichText text={stepTexts?.text ?? ''} />
            </p>
          )}
          {!done && stepTexts?.hint ? (
            hint ? (
              <p className="mt-2 flex gap-1.5 rounded-ui bg-yellow-soft px-2.5 py-1.5 text-ui-sm">
                <Lightbulb size={15} className="mt-0.5 shrink-0 text-yellow" />
                <span>{stepTexts.hint}</span>
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
          {!done && blockId && !here ? (
            <Button
              size="sm"
              className="mt-2"
              icon={<Crosshair size={14} />}
              onClick={() => showBlock(blockId)}
            >
              {t('explore.tour.showBlocks')}
            </Button>
          ) : null}
        </div>
      </div>
      <footer className="flex items-center gap-3">
        <Dots step={active.step} total={total} />
        <span className="text-ui-sm text-muted tabular-nums">
          {t('explore.tour.step', { step: active.step + 1, total })}
        </span>
        <div className="flex-1" />
        {step.check?.kind === 'slowMotion' && !done ? (
          <Button
            size="sm"
            variant="primary"
            icon={<Turtle size={14} />}
            onClick={toggleSlowMotion}
          >
            {t('explore.tour.slowMotion')}
          </Button>
        ) : null}
        {manual ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => void advance()}
            autoFocus
            data-testid="explore-next"
          >
            {active.step === 0 ? t('explore.tour.start') : t('explore.tour.next')}
          </Button>
        ) : null}
      </footer>
    </Bubble>
  )
}

function Dots({ step, total }: { step: number; total: number }) {
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

function Challenges({
  level,
  challenges,
  active,
  tab,
  workspace,
  projectId,
  explore,
}: {
  level: ExploreLevel
  challenges: LevelChallenge[]
  active: ActiveExplore
  tab: 'design' | 'blocks' | 'data'
  workspace: string
  projectId: string
  explore: Explore
}) {
  const { t } = useTranslation()
  const doc = useDoc()
  const navigate = useNavigate()
  const state = useLearnState(tab, workspace, [])
  const showBlock = useShowBlock(projectId, tab, workspace)
  const key = explore.levelKey(level.app, level.level)
  const entry = useLearn((s) => s.progress.explore[key])
  const [hints, setHints] = useState<string[]>([])
  const [party, setParty] = useState(false)
  const [busy, setBusy] = useState(false)
  const texts = level.texts[doc.meta.locale]
  const now = challenges.map((challenge) => evaluate(challenge.check, state))
  const saved = entry?.challenges ?? []
  const succeeded = challenges.map((challenge, index) => now[index] || saved.includes(challenge.id))
  const count = succeeded.filter(Boolean).length
  const all = count === challenges.length

  // A challenge succeeded for the first time: saved and celebrated.
  const known = useRef(saved.length)
  useEffect(() => {
    const fresh = challenges.filter(
      (challenge, index) => now[index] && !saved.includes(challenge.id),
    )
    if (!fresh.length) return
    const ids = [...saved, ...fresh.map((challenge) => challenge.id)]
    const finished = ids.length >= challenges.length
    const tourDone = Boolean(entry?.tourDone)
    void saveExplore({
      id: key,
      app: level.app,
      level: level.level,
      projectId,
      step: entry?.step ?? 0,
      tourDone,
      challenges: ids,
      done: tourDone && finished,
      updatedAt: new Date().toISOString(),
    })
    if (ids.length > known.current) {
      known.current = ids.length
      if (finished) {
        play('finish')
        setParty(true)
        toast.success(t('explore.challenges.allDone', { level: level.level }))
      } else {
        play('star')
        toast.success(t('explore.challenges.oneDone'))
      }
    }
  })

  const set = (patch: Partial<ActiveExplore>) =>
    useLearn.setState((s) => ({ explore: s.explore && { ...s.explore, ...patch } }))
  const next = explore.getLevel(level.app, level.level + 1)
  const appTitle = explore.getExploreApp(level.app)?.texts[doc.meta.locale].title ?? ''

  if (active.collapsed) {
    return (
      <button
        type="button"
        onClick={() => set({ collapsed: false })}
        className="rx-pop fixed bottom-14 left-4 z-[75] flex items-center gap-2 rounded-full border border-border bg-surface py-2 pr-4 pl-3 shadow-2 font-strong junior:bottom-16"
        data-testid="explore-challenges-pill"
      >
        <Trophy size={16} className="text-yellow" />
        {t('explore.challenges.reopen')}
        <span className="rounded-full bg-surface-2 px-2 text-ui-sm tabular-nums">
          {count}/{challenges.length}
        </span>
      </button>
    )
  }

  return (
    <>
      {party ? <Confetti /> : null}
      <section
        aria-label={t('explore.challenges.label', { level: level.level, title: texts.title })}
        className="rx-pop fixed bottom-14 left-4 z-[75] flex max-h-[min(70vh,560px)] w-[340px] flex-col rounded-ui-lg border border-border bg-surface shadow-2 junior:bottom-16 junior:w-[370px]"
        data-testid="explore-challenges"
      >
        <header className="flex items-center gap-2 px-3 py-2">
          <Trophy size={16} className="shrink-0 text-yellow" />
          <h2 className="min-w-0 flex-1 truncate font-strong">
            {t('explore.challenges.title', { level: level.level })}
          </h2>
          <span className="rounded-full bg-surface-2 px-2 text-ui-sm tabular-nums">
            {count}/{challenges.length}
          </span>
          <IconButton
            size="sm"
            label={t('explore.challenges.collapse')}
            onClick={() => set({ collapsed: true })}
          >
            <ChevronDown size={15} />
          </IconButton>
        </header>
        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto border-t border-border px-3 pt-2.5 pb-3">
          {all ? (
            <div className="flex items-center gap-3 rounded-ui bg-mint-soft p-2.5" role="status">
              <Mascot size={48} mood="cheer" className="shrink-0 text-text" />
              <p className="font-strong">
                {t('explore.challenges.allDone', { level: level.level })}
              </p>
            </div>
          ) : (
            <p className="text-ui-sm leading-relaxed">{t('explore.challenges.lead')}</p>
          )}
          <ol className="flex flex-col gap-1.5">
            {challenges.map((challenge, index) => {
              const ok = succeeded[index]
              const words = texts.challenges[challenge.id]
              return (
                <li
                  key={challenge.id}
                  className={cn(
                    'flex flex-col gap-1 rounded-ui px-2.5 py-2 text-ui-sm transition-colors',
                    ok ? 'bg-mint-soft' : 'bg-surface-2',
                  )}
                  data-testid={`explore-challenge-${challenge.id}`}
                  data-done={ok ? 'true' : 'false'}
                >
                  <div className="flex items-start gap-2">
                    {ok ? (
                      <Check
                        size={16}
                        strokeWidth={3}
                        className="mt-0.5 shrink-0 text-mint-text"
                        aria-label={t('explore.challenges.done')}
                      />
                    ) : (
                      <Circle
                        size={16}
                        className="mt-0.5 shrink-0 text-muted"
                        aria-label={t('explore.challenges.todo')}
                      />
                    )}
                    <span className="flex-1">
                      <RichText text={words?.text ?? ''} />
                    </span>
                  </div>
                  {!ok ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
                      {challenge.block ? (
                        <button
                          type="button"
                          onClick={() => challenge.block && showBlock(challenge.block)}
                          className="inline-flex items-center gap-1 rounded font-strong text-primary-text hover:underline"
                        >
                          <Crosshair size={13} />
                          {t('explore.challenges.showBlock')}
                        </button>
                      ) : null}
                      {hints.includes(challenge.id) ? null : (
                        <button
                          type="button"
                          onClick={() => setHints((list) => [...list, challenge.id])}
                          className="inline-flex items-center gap-1 rounded font-strong text-primary-text hover:underline"
                        >
                          <Lightbulb size={13} />
                          {t('explore.challenges.hint')}
                        </button>
                      )}
                    </div>
                  ) : null}
                  {!ok && hints.includes(challenge.id) ? (
                    <p className="ml-6 flex gap-1.5 rounded-ui bg-yellow-soft px-2 py-1">
                      <Lightbulb size={13} className="mt-0.5 shrink-0 text-yellow" />
                      <span>
                        <RichText text={words?.hint ?? ''} />
                      </span>
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw size={14} />}
              onClick={() => set({ view: 'tour', step: 0, paused: false })}
              data-testid="explore-tour-again"
            >
              {t('explore.tour.restart')}
            </Button>
            <div className="flex-1" />
            {all ? (
              next ? (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const id = await openLevelCopy(
                        next,
                        t('explore.copyName', { title: appTitle, level: next.level }),
                      )
                      await navigate({
                        to: '/p/$projectId',
                        params: { projectId: id },
                        search: { tab: 'blocks' },
                      })
                    } finally {
                      setBusy(false)
                    }
                  }}
                  data-testid="explore-next-level"
                >
                  {t('explore.challenges.next', { level: next.level })}
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={() => void navigate({ to: '/learn' })}>
                  {t('explore.challenges.backToLearn')}
                </Button>
              )
            ) : null}
          </div>
        </div>
      </section>
    </>
  )
}
