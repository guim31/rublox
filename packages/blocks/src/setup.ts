import { installAllBlocks } from '@blockly/field-colour'
import * as En from 'blockly/msg/en'
import * as Fr from 'blockly/msg/fr'
import 'blockly/blocks'
import type { Locale } from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { javascriptGenerator } from 'blockly/javascript'
import { setBlocksLocaleValue } from './context.ts'
import { defineBlocks } from './definitions.ts'
import { registerFields } from './fields.ts'

let colours = false

/** The colour field and blocks (`@blockly/field-colour`), with their JavaScript generators. */
export function registerColourBlocks(): void {
  if (colours) return
  colours = true
  installAllBlocks({ javascript: javascriptGenerator })
}

const BLOCKLY_MESSAGES = { fr: Fr, en: En } as const

/**
 * Registers fields and blocks, and sets the language of the blocks created from now on.
 * Existing workspaces keep their labels: recreate them after a language change.
 */
export function setupBlocks(locale: Locale): void {
  registerFields()
  registerColourBlocks()
  defineBlocks()
  Blockly.setLocale(BLOCKLY_MESSAGES[locale] as unknown as Record<string, string>)
  setBlocksLocaleValue(locale)
}
