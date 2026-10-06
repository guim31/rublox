import { useEffect, useRef } from 'react'
import { api, call, type Me } from './api.ts'
import { usePrefs } from './prefs.ts'
import { queryClient } from './query.ts'
import { ME_KEY, useMe } from './session.ts'

let applying = false

/**
 * With an account, the interface preferences (mode, theme, language) live in the profile
 * (SPEC § 4.7): they are applied at sign-in and saved when they change. They stay in
 * localStorage too, so that `public/prefs.js` paints the right theme before the first frame.
 */
export function useProfileSync() {
  const me = useMe()
  const user = me.data?.user ?? null
  const applied = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      applied.current = null
      return
    }
    if (applied.current === user.id) return
    applied.current = user.id
    const prefs = usePrefs.getState()
    applying = true
    if (user.uiMode) prefs.setMode(user.uiMode)
    if (user.theme) prefs.setTheme(user.theme)
    if (user.locale) prefs.setLocale(user.locale)
    applying = false
    // A new account takes the preferences of this browser.
    const missing = {
      ...(user.uiMode ? {} : { uiMode: prefs.mode }),
      ...(user.theme ? {} : { theme: prefs.theme }),
      ...(user.locale ? {} : { locale: prefs.locale }),
    }
    if (Object.keys(missing).length > 0) void save(missing)
  }, [user])

  useEffect(
    () =>
      usePrefs.subscribe((state, previous) => {
        if (applying || !applied.current) return
        const patch = {
          ...(state.mode !== previous.mode ? { uiMode: state.mode } : {}),
          ...(state.theme !== previous.theme ? { theme: state.theme } : {}),
          ...(state.locale !== previous.locale ? { locale: state.locale } : {}),
        }
        if (Object.keys(patch).length > 0) void save(patch)
      }),
    [],
  )
}

type Patch = {
  uiMode?: 'junior' | 'studio'
  theme?: 'light' | 'dark' | 'system'
  locale?: 'fr' | 'en'
}

async function save(patch: Patch) {
  try {
    const { user } = await call(api.me.$patch({ json: patch }))
    queryClient.setQueryData<Me>(ME_KEY, (old) => (old?.user ? { ...old, user } : old))
  } catch {
    // Kept locally; saved with the next change.
  }
}
