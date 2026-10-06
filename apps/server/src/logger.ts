import { pino } from 'pino'
import type { LogLevel } from './config.ts'

/** JSON logs on stdout, with the level written as a label (`"level":"info"`). */
export function createLogger(level: LogLevel) {
  return pino({
    level,
    base: undefined,
    formatters: { level: (label) => ({ level: label }) },
  })
}

export type { Logger } from 'pino'
