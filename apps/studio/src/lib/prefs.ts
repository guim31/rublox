import { detectLocale, type Locale } from '@rublox/i18n'
import type { UiMode } from '@rublox/schema'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePref = 'light' | 'dark' | 'system'

type Prefs = {
  mode: UiMode
  theme: ThemePref
  locale: Locale
  /** Junior: show the generated code next to the blocks. */
  juniorCode: boolean
  /** Junior: "More blocks" in the toolbox. */
  moreBlocks: boolean
  consoleOpen: boolean
  setMode(mode: UiMode): void
  setTheme(theme: ThemePref): void
  setLocale(locale: Locale): void
  set(patch: Partial<Pick<Prefs, 'juniorCode' | 'moreBlocks' | 'consoleOpen'>>): void
}

/**
 * Interface preferences, kept in this browser. With accounts (J1) they move to the profile;
 * changing them never changes a project (SPEC § 5.2).
 */
export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      mode: 'junior',
      theme: 'system',
      locale: detectLocale(),
      juniorCode: false,
      moreBlocks: false,
      consoleOpen: true,
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      set: (patch) => set(patch),
    }),
    { name: 'rublox:prefs', version: 1 },
  ),
)

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function isDark(theme: ThemePref): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark())
}
