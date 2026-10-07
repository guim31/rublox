import { queryClient } from './query.ts'
import { ME_KEY, useMe } from './session.ts'

/**
 * What this instance and this account offer (J6), read from `/api/me`: the gallery, and the
 * AI assistant. `ai` is null without `ANTHROPIC_API_KEY` on the server: then nothing about
 * the assistant appears anywhere (SPEC § 8). Guests have neither.
 */
export function useFeatures() {
  const me = useMe()
  const features = me.data?.user ? (me.data as { features?: Features }).features : undefined
  return {
    gallery: features?.gallery ?? false,
    galleryShare: features?.galleryShare ?? false,
    /** The assistant exists on this server (administration, space rights). */
    aiConfigured: Boolean(features?.ai),
    /** This account may ask it something now. */
    ai: features?.ai?.allowed ? features.ai : null,
  }
}

type Features = {
  gallery: boolean
  galleryShare: boolean
  ai: { allowed: boolean; reason: string | null; quota: number; used: number } | null
}

/** Whether the signed-in account may ask the assistant now, outside React (block menu). */
export function aiAllowed(): boolean {
  const me = queryClient.getQueryData<{ user?: unknown; features?: Features }>(ME_KEY)
  return Boolean(me?.user && me.features?.ai?.allowed)
}

/** Component types that need the assistant: hidden without it (SPEC § 8). */
export const AI_TYPES: readonly string[] = ['AI']

/** Whether a component type can be offered (palette, commands, help) to this account. */
export function useOfferedType(): (type: string) => boolean {
  const { ai } = useFeatures()
  return (type) => Boolean(ai) || !AI_TYPES.includes(type)
}
