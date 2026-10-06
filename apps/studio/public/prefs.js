// Applies the saved mode, theme and language before the first paint (no flash).
// A separate file because the CSP forbids inline scripts.
;(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('rublox:prefs') || '{}').state || {}
    const root = document.documentElement
    const dark =
      saved.theme === 'dark' ||
      (saved.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
    root.dataset.mode = saved.mode === 'studio' ? 'studio' : 'junior'
    root.dataset.theme = dark ? 'dark' : 'light'
    if (saved.locale === 'en' || saved.locale === 'fr') root.lang = saved.locale
  } catch {}
})()
