import { detectLocale, type Locale } from '@rublox/i18n/locale'
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
  /** The console, per mode: folded by default in Junior, where it is often empty. */
  consoleOpen: Record<UiMode, boolean>
  /** Junior: success sounds (SPEC § 5.2). */
  sounds: boolean
  /** Badges, which Studio can hide (SPEC § 4.10). */
  showBadges: boolean
  /** The guided tour of each mode was seen (or skipped). */
  toursSeen: Record<UiMode, boolean>
  /** "Try without an account" was chosen: the welcome page is not shown again. */
  welcomed: boolean
  /** Slow motion: time spent on each block, in milliseconds. */
  slowDelay: number
  setMode(mode: UiMode): void
  setTheme(theme: ThemePref): void
  setLocale(locale: Locale): void
  set(
    patch: Partial<
      Pick<
        Prefs,
        | 'juniorCode'
        | 'moreBlocks'
        | 'consoleOpen'
        | 'sounds'
        | 'showBadges'
        | 'toursSeen'
        | 'welcomed'
        | 'slowDelay'
      >
    >,
  ): void
  toggleConsole(): void
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
      consoleOpen: { junior: false, studio: true },
      sounds: true,
      showBadges: true,
      toursSeen: { junior: false, studio: false },
      welcomed: false,
      slowDelay: 600,
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      set: (patch) => set(patch),
      toggleConsole: () =>
        set((state) => ({
          consoleOpen: { ...state.consoleOpen, [state.mode]: !state.consoleOpen[state.mode] },
        })),
    }),
    {
      name: 'rublox:prefs',
      version: 2,
      // Version 1 had one console state for both modes.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>
        if (version < 2 && typeof state.consoleOpen === 'boolean')
          state.consoleOpen = { junior: false, studio: state.consoleOpen }
        return state as unknown as Prefs
      },
    },
  ),
)

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function isDark(theme: ThemePref): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark())
}
