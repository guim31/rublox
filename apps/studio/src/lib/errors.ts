import type { TFunction } from 'i18next'
import { ApiError } from './api.ts'

const KNOWN = new Set([
  'network',
  'invalid',
  'signed_out',
  'forbidden',
  'not_found',
  'bad_origin',
  'too_many_attempts',
  'invalid_invite',
  'username_taken',
  'email_taken',
  'last_manager',
  'space_has_accounts',
  'managed_account',
  'self',
  'too_large',
  'unsupported_type',
  'quota_exceeded',
  'invalid_project',
  'slug_taken',
  'missing_asset',
  'publish_forbidden',
  'in_trash',
  'wrong_password',
  'last_admin',
] as const)

type Code = typeof KNOWN extends Set<infer C> ? C : never

const GALLERY_CODES = new Set(['gallery_disabled', 'gallery_forbidden', 'gallery_removed'] as const)
type GalleryCode = typeof GALLERY_CODES extends Set<infer C> ? C : never
const AI_CODES = new Set(['ai_forbidden', 'ai_quota', 'ai_failed'] as const)
type AiCode = typeof AI_CODES extends Set<infer C> ? C : never

/** A sentence for the person, for any error of the API (SPEC § 5.4: what happened). */
export function errorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown'
  // J6: the gallery and the AI assistant keep their own messages.
  if ((GALLERY_CODES as Set<string>).has(code)) return t(`gallery.errors.${code as GalleryCode}`)
  if ((AI_CODES as Set<string>).has(code)) return t(`ai.errors.${code as AiCode}`)
  return (KNOWN as Set<string>).has(code) ? t(`errors.${code as Code}`) : t('errors.unknown')
}
