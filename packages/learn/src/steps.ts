import { evaluate, type LearnState } from './conditions.ts'
import type { Tutorial } from './model.ts'

/** Where a learner is in a tutorial: the current step, and whether its check has held. */
export type StepProgress = { step: number; done: boolean }

function holds(tutorial: Tutorial, step: number, state: LearnState): boolean {
  const check = tutorial.steps[step]?.check
  return Boolean(check && check.kind !== 'manual' && evaluate(check, state))
}

/**
 * A change of state (project, tab, preview…). The current step is done as soon as its check
 * holds; it then shows "Nice one!" for a moment before `nextStep`. A learner who is quicker
 * than that moment and already does what the **following** step asks moves on at once, that
 * step done too: otherwise a passing state (a tab visited on the way) would be missed, and
 * the tutorial would ask again for something already done.
 */
export function stepProgress(
  tutorial: Tutorial,
  progress: StepProgress,
  state: LearnState,
): StepProgress {
  if (!progress.done)
    return holds(tutorial, progress.step, state) ? { ...progress, done: true } : progress
  const next = progress.step + 1
  return next < tutorial.steps.length && holds(tutorial, next, state)
    ? { step: next, done: true }
    : progress
}

/** The moment of "Nice one!" is over: the following step starts. */
export function nextStep(progress: StepProgress): StepProgress {
  return { step: progress.step + 1, done: false }
}
