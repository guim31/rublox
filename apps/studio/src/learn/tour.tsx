import type { UiMode } from '@rublox/schema'
import { Compass, X } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { Mascot, type MascotMood } from '../components/brand.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { usePrefs } from '../lib/prefs.ts'
import { Bubble } from './bubble.tsx'
import { useLearn } from './store.ts'

type TourStep = { id: string; target?: string; mood?: MascotMood }

/** The guided tour of each mode (SPEC § 5.1): a few places, shown at the first opening. */
const TOURS: Record<UiMode, TourStep[]> = {
  junior: [
    { id: 'welcome', mood: 'wave' },
    { id: 'palette', target: 'palette' },
    { id: 'canvas', target: 'canvas' },
    { id: 'inspector', target: 'inspector' },
    { id: 'blocks', target: 'tab:blocks' },
    { id: 'help', target: 'help', mood: 'cheer' },
  ],
  studio: [
    { id: 'welcome' },
    { id: 'palette', target: 'palette' },
    { id: 'inspector', target: 'inspector' },
    { id: 'blocks', target: 'tab:blocks' },
    { id: 'commands', target: 'commands' },
    { id: 'help', target: 'help' },
  ],
}

const useTour = create<{ active: boolean; step: number }>()(() => ({ active: false, step: 0 }))

export function startTour(): void {
  useTour.setState({ active: true, step: 0 })
}

function endTour(): void {
  const { mode, toursSeen, set } = usePrefs.getState()
  useTour.setState({ active: false, step: 0 })
  set({ toursSeen: { ...toursSeen, [mode]: true } })
}

/** Shown in Design: the tour of the current mode, by itself the first time. */
export function TourRunner({ tab }: { tab: 'design' | 'blocks' | 'data' }) {
  const { t } = useTranslation()
  const mode = usePrefs((s) => s.mode)
  const seen = usePrefs((s) => s.toursSeen[mode])
  const tutorial = useLearn((s) => s.tutorial)
  const { active, step } = useTour()

  // First opening of the editor in this mode, unless a tutorial is already guiding.
  useEffect(() => {
    if (!seen && !tutorial && tab === 'design' && !useTour.getState().active) startTour()
  }, [seen, tutorial, tab])

  if (!active || tab !== 'design') return null
  const steps = TOURS[mode]
  const current = steps[step]
  if (!current) return null
  const texts = t(`tour.${mode}.${current.id}` as 'tour.junior.welcome', {
    returnObjects: true,
  }) as unknown as { title: string; text: string }
  const last = step === steps.length - 1
  return (
    <Bubble
      target={current.target}
      doc={null}
      label={t('tour.label')}
      fallback="center"
      testId="tour-bubble"
    >
      <header className="flex items-center gap-2">
        <span className="flex flex-1 items-center gap-1.5 text-ui-sm font-strong text-primary-text">
          <Compass size={15} />
          {t('tour.label')}
        </span>
        <span className="text-ui-sm text-muted tabular-nums">
          {t('tour.count', { step: step + 1, total: steps.length })}
        </span>
        <IconButton size="sm" label={t('tour.skip')} onClick={endTour}>
          <X size={15} />
        </IconButton>
      </header>
      <div className="flex gap-3">
        {mode === 'junior' ? (
          <Mascot
            size={56}
            mood={current.mood ?? 'happy'}
            animated
            className="shrink-0 text-text"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="font-strong text-ui-lg">{texts.title}</h2>
          <p className="mt-1 leading-relaxed text-muted">{texts.text}</p>
        </div>
      </div>
      <footer className="flex items-center gap-2">
        {step === 0 ? (
          <Button size="sm" variant="ghost" onClick={endTour}>
            {t('tour.skip')}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => useTour.setState({ step: step - 1 })}>
            {t('tour.back')}
          </Button>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="primary"
          autoFocus
          onClick={() => (last ? endTour() : useTour.setState({ step: step + 1 }))}
          data-testid="tour-next"
        >
          {last ? t('tour.finish') : t('tour.next')}
        </Button>
      </footer>
    </Bubble>
  )
}
