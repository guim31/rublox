import type { StepInfo } from '@rublox/runtime'
import { Pause, Play, StepForward, Turtle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '../../components/ui/button.tsx'
import { Tooltip } from '../../components/ui/tooltip.tsx'
import { awardBadge } from '../../learn/store.ts'
import { cn } from '../../lib/cn.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { setSlow, useEditor } from '../store.ts'

/** Slowest and fastest time per block, in milliseconds. */
const SLOWEST = 1500
const FASTEST = 100

/** A step reported by the preview: light the block, and earn the slow motion badges. */
export function onStep(step: StepInfo): void {
  setSlow({ step: step.blockId ? step : null })
  if (step.blockId) void awardBadge('slow-motion')
  if (step.paused) void awardBadge('bug-hunter')
}

export function toggleSlowMotion(): void {
  const { slow } = useEditor.getState()
  setSlow({ enabled: !slow.enabled, step: null })
}

/** The slow motion switch (SPEC § 4.3): a labelled button in Junior, where it is put forward. */
export function SlowMotionToggle() {
  const { t } = useTranslation()
  const mode = usePrefs((s) => s.mode)
  const enabled = useEditor((s) => s.slow.enabled)
  const label = enabled ? t('slow.off') : t('slow.on')
  if (mode === 'junior') {
    return (
      <Tooltip content={t('slow.hint')}>
        <Button
          size="sm"
          variant={enabled ? 'primary' : 'soft'}
          icon={<Turtle size={16} />}
          aria-pressed={enabled}
          aria-label={label}
          onClick={toggleSlowMotion}
          data-tour="slow-motion"
          data-testid="slow-motion"
        >
          {t('slow.label')}
        </Button>
      </Tooltip>
    )
  }
  return (
    <IconButton
      size="sm"
      label={label}
      active={enabled}
      onClick={toggleSlowMotion}
      data-tour="slow-motion"
      data-testid="slow-motion"
    >
      <Turtle size={15} />
    </IconButton>
  )
}

/** Under the preview's header while slow motion is on: speed, and the pause controls. */
export function SlowMotionBar() {
  const { t } = useTranslation()
  const { enabled, step, breakpoints } = useEditor((s) => s.slow)
  const preview = useEditor((s) => s.preview)
  const delay = usePrefs((s) => s.slowDelay)
  const set = usePrefs((s) => s.set)
  if (!enabled) return null
  const paused = step?.paused ?? false
  // The slider reads as a speed: right is faster.
  const speed = SLOWEST + FASTEST - delay
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-2',
        paused ? 'bg-yellow-soft' : 'bg-mint-soft/60',
      )}
      data-testid="slow-motion-bar"
    >
      {paused ? (
        <>
          <span className="flex items-center gap-1.5 text-ui-sm font-strong" role="status">
            <Pause size={14} />
            {t('slow.paused')}
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            icon={<StepForward size={14} />}
            onClick={() => preview?.resume(true)}
            data-testid="slow-step"
          >
            {t('slow.step')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Play size={14} />}
            onClick={() => preview?.resume(false)}
            data-testid="slow-continue"
          >
            {t('slow.continue')}
          </Button>
        </>
      ) : (
        <>
          <label className="flex min-w-0 flex-1 items-center gap-2 text-ui-sm">
            <span className="sr-only">{t('slow.speed')}</span>
            <Turtle size={15} aria-hidden="true" className="shrink-0 text-mint-text" />
            <input
              type="range"
              min={FASTEST}
              max={SLOWEST}
              step={100}
              value={speed}
              aria-valuetext={`${delay} ms`}
              onChange={(event) =>
                set({ slowDelay: SLOWEST + FASTEST - Number(event.target.value) })
              }
              className="min-w-16 flex-1 accent-[var(--c-primary)]"
            />
            <span aria-hidden="true" className="text-[15px]">
              🐇
            </span>
          </label>
          {breakpoints.length ? (
            <button
              type="button"
              className="rounded text-ui-sm text-muted underline-offset-2 hover:underline"
              onClick={() => setSlow({ breakpoints: [] })}
            >
              {t('slow.breakpoints', { count: breakpoints.length })} · {t('slow.clearBreakpoints')}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}
