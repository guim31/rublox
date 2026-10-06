import { useEffect, useRef } from 'react'

/** True when the key event comes from a text field, where shortcuts must not fire. */
export function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function isMod(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

/** Listens to keydown on the window; the handler always sees the latest props. */
export function useKeydown(handler: (event: KeyboardEvent) => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const listener = (event: KeyboardEvent) => ref.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
