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
] as const)

type Code = typeof KNOWN extends Set<infer C> ? C : never

/** A sentence for the person, for any error of the API (SPEC § 5.4: what happened). */
export function errorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown'
  return (KNOWN as Set<string>).has(code) ? t(`errors.${code as Code}`) : t('errors.unknown')
}
