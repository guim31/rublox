import { customAlphabet } from 'nanoid'

/** Short ids for the content of a project (screens, components, assets, variables). */
export const newId: () => string = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  10,
)

const JS_RESERVED = new Set(
  (
    'await break case catch class const continue debugger default delete do else enum export ' +
    'extends false finally for function if implements import in instanceof interface let new ' +
    'null package private protected public return static super switch this throw true try ' +
    'typeof var void while with yield arguments eval undefined NaN Infinity'
  ).split(' '),
)

/**
 * Names the generated code relies on: the module parameters and the globals a block may use.
 * A screen, component or variable cannot take them.
 */
export const GENERATED_CODE_NAMES = new Set([
  'components',
  'app',
  'stored',
  'shared',
  'screens',
  'ui',
  'device',
  'rx',
  'functions',
  'data',
  'Math',
  'Number',
  'String',
  'Array',
  'Object',
  'JSON',
  'Date',
  'console',
  'globalThis',
  'window',
  'document',
  'Promise',
])

const IDENTIFIER = /^[\p{L}_$][\p{L}\p{N}_$]*$/u

/** A valid JavaScript identifier that the generated code can use as a name. */
export function isValidName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 64 &&
    IDENTIFIER.test(name) &&
    !JS_RESERVED.has(name) &&
    !GENERATED_CODE_NAMES.has(name)
  )
}

/**
 * Turns free text into a valid name: `"mon bouton!"` → `"mon_bouton"`. Falls back to
 * `fallback` when nothing usable is left.
 */
export function toValidName(text: string, fallback = 'item'): string {
  let name = text
    .normalize('NFC')
    .trim()
    .replace(/[^\p{L}\p{N}_$]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  if (!name) name = fallback
  if (/^\p{N}/u.test(name)) name = `_${name}`
  if (!isValidName(name)) name = `${name}_`
  return name.slice(0, 64)
}

/**
 * First free name of the form `base1`, `base2`… (or `base` itself when `bare` is set and it
 * is free). A trailing number on `base` is ignored: `Bouton3` gives the first free `BoutonN`.
 */
export function uniqueName(base: string, taken: Iterable<string>, bare = false): string {
  const used = new Set(taken)
  const stem = toValidName(base).replace(/\d+$/, '') || 'item'
  if (bare && !used.has(stem) && isValidName(stem)) return stem
  for (let index = 1; ; index++) {
    const candidate = `${stem}${index}`
    if (!used.has(candidate) && isValidName(candidate)) return candidate
  }
}
