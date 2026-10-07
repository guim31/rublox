import { bigQuiz } from './big-quiz.ts'
import { brickBreaker } from './brick-breaker.ts'
import { piggyBank } from './piggy-bank.ts'
import { starCatcher } from './star-catcher.ts'
import type { AppSource } from './types.ts'

/** The apps to take apart, in the order of the learning page. */
export const APPS: AppSource[] = [starCatcher, brickBreaker, bigQuiz, piggyBank]
