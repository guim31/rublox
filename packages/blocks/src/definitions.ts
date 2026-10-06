import {
  type ArgDef,
  COMPONENTS,
  type ComponentDef,
  componentStrings,
  type EventFilter,
  type PropKind,
} from '@rublox/catalog'
import { messages } from '@rublox/i18n'
import * as Blockly from 'blockly/core'
import { getBlocksLocale } from './context.ts'
import { ANY, ComponentField, ComponentFilterField, PropertyField } from './fields.ts'

/**
 * Block types are saved in projects: never rename one. Component blocks are named
 * `rx_<Type>_on_<event>`, `rx_<Type>_get`, `rx_<Type>_set` and `rx_<Type>_call_<method>`;
 * general blocks `rx_<name>`.
 */
export const BLOCK_TYPES = {
  appStart: 'rx_app_start',
  forever: 'rx_forever',
  wait: 'rx_wait',
  log: 'rx_log',
  screenOpen: 'rx_screen_open',
  screenBack: 'rx_screen_back',
  alert: 'rx_ui_alert',
  toast: 'rx_ui_toast',
  confirm: 'rx_ui_confirm',
  prompt: 'rx_ui_prompt',
  eventArg: 'rx_event_arg',
} as const

export const eventBlockType = (type: string, event: string) => `rx_${type}_on_${event}`
export const getterBlockType = (type: string) => `rx_${type}_get`
export const setterBlockType = (type: string) => `rx_${type}_set`
export const methodBlockType = (type: string, method: string) => `rx_${type}_call_${method}`

/** Blockly types dropdowns as `Field<string>`, which `appendField` does not accept as is. */
function asField(field: Blockly.FieldDropdown): Blockly.Field {
  return field as unknown as Blockly.Field
}

/** The texts of the blocks, in the language blocks are being created in. */
function t() {
  return messages[getBlocksLocale()].blocks
}

/** Splits `"quand %1 est cliqué"` around its placeholders, for blocks built in code. */
function parts(template: string): (string | number)[] {
  return template
    .split(/(%\d+)/)
    .filter((part) => part !== '')
    .map((part) => (/^%\d+$/.test(part) ? Number(part.slice(1)) : part.trim()))
    .filter((part) => part !== '')
}

type Builder = (block: Blockly.Block, input: Blockly.Input, index: number) => Blockly.Input

/** Appends a message whose `%n` are filled by `fill(n)`: inputs, or fields on a dummy input. */
function appendMessage(block: Blockly.Block, template: string, fill: Record<number, Builder>) {
  let input = block.appendDummyInput()
  for (const part of parts(template)) {
    if (typeof part === 'string') input.appendField(part)
    else {
      const builder = fill[part]
      if (builder) input = builder(block, input, part)
    }
  }
  return input
}

/** A block defined by a JSON message, built each time so that it follows the language. */
function jsonBlock(type: string, json: () => Record<string, unknown>) {
  Blockly.Blocks[type] = {
    init(this: Blockly.Block) {
      this.jsonInit(json())
    },
  }
}

const SHADOW_BY_KIND: Partial<Record<PropKind, { type: string; fields: Record<string, unknown> }>> =
  {
    string: { type: 'text', fields: { TEXT: '' } },
    asset: { type: 'text', fields: { TEXT: '' } },
    icon: { type: 'text', fields: { TEXT: '' } },
    enum: { type: 'text', fields: { TEXT: '' } },
    number: { type: 'math_number', fields: { NUM: 0 } },
    size: { type: 'math_number', fields: { NUM: 100 } },
    boolean: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } },
    color: { type: 'colour_picker', fields: { COLOUR: '#5b4bff' } },
  }

/** The shadow block that fits a value kind, for toolbox entries and property changes. */
export function shadowFor(kind: PropKind, value?: unknown) {
  const shadow = SHADOW_BY_KIND[kind]
  if (!shadow) return undefined
  const fields = { ...shadow.fields }
  if (value !== undefined && value !== '') {
    if (shadow.type === 'text' && typeof value === 'string') fields.TEXT = value
    if (shadow.type === 'math_number' && typeof value === 'number') fields.NUM = value
    if (
      shadow.type === 'colour_picker' &&
      typeof value === 'string' &&
      /^#[0-9a-f]{6}$/i.test(value)
    ) {
      fields.COLOUR = value
    }
    if (shadow.type === 'logic_boolean' && typeof value === 'boolean') {
      fields.BOOL = value ? 'TRUE' : 'FALSE'
    }
  }
  return { type: shadow.type, fields }
}

function propertyKeys(def: ComponentDef, access: 'get' | 'set') {
  return Object.entries(def.props)
    .filter(([, prop]) => prop.blocks === 'get-set' || prop.blocks === access)
    .map(([key, prop]) => ({ key, junior: prop.junior }))
}

/** The dropdown of an event's filter: a component of a type, or one of a few values. */
function filterField(def: ComponentDef, event: string, filter: EventFilter): Blockly.Field {
  const label = (value: string) =>
    componentStrings(def.type, getBlocksLocale())?.filters?.[event]?.[value] ?? value
  if (filter.kind === 'component') {
    return asField(new ComponentFilterField(filter.componentType, () => label('any')))
  }
  const field = new Blockly.FieldDropdown(() => [
    [label('any'), ANY],
    ...filter.values.map((value): [string, string] => [label(value), value]),
  ])
  return asField(field)
}

/** Is a method or event argument chosen in a dropdown (a component) rather than plugged in? */
export function isFieldArg(arg: ArgDef | undefined): boolean {
  return arg?.kind === 'component'
}

function defineComponentBlocks(def: ComponentDef): void {
  for (const [event, info] of Object.entries(def.events)) {
    Blockly.Blocks[eventBlockType(def.type, event)] = {
      init(this: Blockly.Block) {
        const strings = def.strings[getBlocksLocale()]
        const filter = info.filter
        const fill: Record<number, Builder> = {
          1: (_, input) => input.appendField(asField(new ComponentField(def.type)), 'COMPONENT'),
        }
        if (filter)
          fill[2] = (_, input) => input.appendField(filterField(def, event, filter), 'FILTER')
        appendMessage(this, strings.events[event] ?? event, fill)
        this.appendStatementInput('DO')
        this.setStyle('rx_event_blocks')
        this.setTooltip(() => t().tooltips.event)
      },
    }
  }

  const getters = propertyKeys(def, 'get')
  if (getters.length) {
    Blockly.Blocks[getterBlockType(def.type)] = {
      init(this: Blockly.Block) {
        appendMessage(this, t().get, {
          1: (_, input) =>
            input.appendField(asField(new PropertyField(def.type, 'get', getters)), 'PROP'),
          2: (_, input) => input.appendField(asField(new ComponentField(def.type)), 'COMPONENT'),
        })
        this.setOutput(true, null)
        this.setStyle('rx_component_blocks')
        this.setTooltip(() => t().tooltips.get)
      },
    }
  }

  const setters = propertyKeys(def, 'set')
  if (setters.length) {
    Blockly.Blocks[setterBlockType(def.type)] = {
      init(this: Blockly.Block) {
        const field = new PropertyField(def.type, 'set', setters)
        const [before, after] = t().set.split('%3')
        const value = this.appendValueInput('VALUE')
        for (const part of parts(before ?? '')) {
          if (part === 1) value.appendField(asField(field), 'PROP')
          else if (part === 2) value.appendField(asField(new ComponentField(def.type)), 'COMPONENT')
          else if (typeof part === 'string') value.appendField(part)
        }
        if (after?.trim()) this.appendDummyInput().appendField(after.trim())
        this.setInputsInline(true)
        this.setPreviousStatement(true)
        this.setNextStatement(true)
        this.setStyle('rx_component_blocks')
        this.setTooltip(() => t().tooltips.set)
        // When the property changes, swap the default value for one of the right kind.
        field.setValidator((key) => {
          const kind = def.props[key]?.kind
          const connection = this.getInput('VALUE')?.connection
          const rendered = (this as Blockly.Block & { rendered?: boolean }).rendered
          if (kind && connection && rendered && !this.isInFlyout) {
            const target = connection.targetBlock()
            const shadow = shadowFor(kind)
            if (shadow && (!target || target.isShadow()) && target?.type !== shadow.type) {
              connection.setShadowState(shadow)
            }
          }
          return key
        })
      },
    }
  }

  for (const [name, method] of Object.entries(def.methods)) {
    Blockly.Blocks[methodBlockType(def.type, name)] = {
      init(this: Blockly.Block) {
        const strings = def.strings[getBlocksLocale()]
        const template = strings.methods[name] ?? name
        const pieces = parts(template)
        const args = Object.values(method.args)
        let input: Blockly.Input = this.appendDummyInput()
        for (const part of pieces) {
          if (part === 1) input.appendField(asField(new ComponentField(def.type)), 'COMPONENT')
          else if (typeof part === 'number') {
            const arg = args[part - 2]
            if (isFieldArg(arg)) {
              input.appendField(
                asField(new ComponentField(arg?.componentType ?? def.type)),
                `ARG${part - 2}`,
              )
            } else input = this.appendValueInput(`ARG${part - 2}`)
          } else input.appendField(part)
        }
        this.setInputsInline(true)
        if (method.returns) this.setOutput(true, null)
        else {
          this.setPreviousStatement(true)
          this.setNextStatement(true)
        }
        this.setStyle('rx_component_blocks')
      },
    }
  }
}

/** What an event argument block reads: `{ type: 'GameScene', event: 'frame', arg: 'dt' }`. */
export type EventArgRef = { type: string; event: string; arg: string }

type EventArgBlock = Blockly.Block & { argRef?: EventArgRef }

export function eventArgLabel(ref: EventArgRef | undefined): string {
  if (!ref) return t().game.eventArgEmpty
  return componentStrings(ref.type, getBlocksLocale())?.eventArgs?.[ref.event]?.[ref.arg] ?? ref.arg
}

/**
 * A value received by an event handler ("elapsed time", "the other sprite"). It only makes
 * sense inside its own event block; elsewhere it is flagged and generates `undefined`.
 */
function defineEventArgBlock(): void {
  Blockly.Blocks[BLOCK_TYPES.eventArg] = {
    init(this: EventArgBlock) {
      this.appendDummyInput().appendField(new Blockly.FieldLabel(eventArgLabel(undefined)), 'LABEL')
      this.setOutput(true, null)
      this.setStyle('rx_event_blocks')
      this.setTooltip(() => t().game.eventArg)
    },
    saveExtraState(this: EventArgBlock) {
      return this.argRef ?? null
    },
    loadExtraState(this: EventArgBlock, state: EventArgRef | null) {
      if (!state || typeof state.arg !== 'string') return
      this.argRef = { type: String(state.type), event: String(state.event), arg: state.arg }
      this.setFieldValue(eventArgLabel(this.argRef), 'LABEL')
    },
  }
}

function defineGeneralBlocks(): void {
  jsonBlock(BLOCK_TYPES.appStart, () => ({
    message0: t().appStart,
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    style: 'rx_event_blocks',
    tooltip: t().tooltips.appStart,
  }))
  jsonBlock(BLOCK_TYPES.forever, () => ({
    message0: t().forever,
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    style: 'loop_blocks',
    tooltip: t().tooltips.forever,
  }))
  jsonBlock(BLOCK_TYPES.wait, () => ({
    message0: t().wait,
    args0: [{ type: 'input_value', name: 'SECONDS', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
    style: 'loop_blocks',
    tooltip: t().tooltips.wait,
  }))
  jsonBlock(BLOCK_TYPES.log, () => ({
    message0: t().log,
    args0: [{ type: 'input_value', name: 'VALUE' }],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
    style: 'rx_debug_blocks',
    tooltip: t().tooltips.log,
  }))
  jsonBlock(BLOCK_TYPES.screenOpen, () => ({
    message0: t().screenOpen,
    args0: [{ type: 'field_rx_screen', name: 'SCREEN' }],
    previousStatement: null,
    nextStatement: null,
    style: 'rx_screen_blocks',
    tooltip: t().tooltips.screenOpen,
  }))
  jsonBlock(BLOCK_TYPES.screenBack, () => ({
    message0: t().screenBack,
    previousStatement: null,
    nextStatement: null,
    style: 'rx_screen_blocks',
    tooltip: t().tooltips.screenBack,
  }))
  for (const [type, key] of [
    [BLOCK_TYPES.alert, 'alert'],
    [BLOCK_TYPES.toast, 'toast'],
  ] as const) {
    jsonBlock(type, () => ({
      message0: t()[key],
      args0: [{ type: 'input_value', name: 'MESSAGE' }],
      previousStatement: null,
      nextStatement: null,
      inputsInline: true,
      style: 'rx_interface_blocks',
      tooltip: t().tooltips[key],
    }))
  }
  for (const [type, key, check] of [
    [BLOCK_TYPES.confirm, 'confirm', 'Boolean'],
    [BLOCK_TYPES.prompt, 'prompt', 'String'],
  ] as const) {
    jsonBlock(type, () => ({
      message0: t()[key],
      args0: [{ type: 'input_value', name: 'MESSAGE' }],
      output: check,
      inputsInline: true,
      style: 'rx_interface_blocks',
      tooltip: t().tooltips[key],
    }))
  }
}

let defined = false

/** Registers every Rublox block type (idempotent). */
export function defineBlocks(): void {
  if (defined) return
  defined = true
  defineGeneralBlocks()
  defineEventArgBlock()
  for (const def of COMPONENTS) defineComponentBlocks(def)
}

/** Every block type derived from a component, for completeness tests and the toolbox. */
export function componentBlockTypes(def: ComponentDef): string[] {
  return [
    ...Object.keys(def.events).map((event) => eventBlockType(def.type, event)),
    ...(propertyKeys(def, 'get').length ? [getterBlockType(def.type)] : []),
    ...(propertyKeys(def, 'set').length ? [setterBlockType(def.type)] : []),
    ...Object.keys(def.methods).map((method) => methodBlockType(def.type, method)),
  ]
}

export { propertyKeys }
