import { COMPONENTS, componentLabel, getComponentDef, propLabel } from '@rublox/catalog'
import { messages } from '@rublox/i18n'
import * as Blockly from 'blockly/core'
import { contextOf, getBlocksLocale } from './context.ts'

type Option = [string, string]

/**
 * A dropdown whose value is an id (a component, a screen) and whose label is the current
 * name. It keeps an id that no longer exists, shown with a warning sign, so that deleting a
 * component never deletes or silently changes the blocks that use it.
 */
export abstract class ReferenceField extends Blockly.FieldDropdown {
  constructor(value?: string) {
    // Blockly calls the generator as a method of the field. It also calls it from the parent
    // constructor, before subclass fields exist: `available()` must cope with that.
    super(function (this: ReferenceField) {
      return this.buildOptions()
    } as unknown as Blockly.MenuGeneratorFunction)
    if (value) this.setValue(value)
  }

  /** The options that exist now, as `[label, id]`. */
  protected abstract available(): Option[]

  /** Label of an id that is not available (a deleted component). */
  protected missingLabel(id: string): string {
    return `⚠ ${id ? '?' : '…'}`
  }

  isMissing(): boolean {
    const value = this.getValue()
    return !this.available().some(([, id]) => id === value)
  }

  protected buildOptions(): Option[] {
    const options = this.available()
    const value = (this as unknown as { value_: string | null }).value_
    if (value && !options.some(([, id]) => id === value)) {
      options.push([this.missingLabel(value), value])
    }
    return options.length ? options : [[this.missingLabel(''), '']]
  }

  protected override doClassValidation_(value?: unknown): string | null {
    return typeof value === 'string' ? value : null
  }

  protected override doValueUpdate_(value: string): void {
    super.doValueUpdate_(value)
    const options = this.getOptions(false)
    const match = options.find((option) => Array.isArray(option) && option[1] === value)
    if (match) (this as unknown as { selectedOption: unknown }).selectedOption = match
  }

  /** Re-reads names (after a rename) and redraws. */
  refresh(): void {
    this.doValueUpdate_(this.getValue() ?? '')
    this.forceRerender()
  }
}

/** Components of one type in the workspace's screen. */
export class ComponentField extends ReferenceField {
  constructor(
    readonly componentType: string,
    value?: string,
  ) {
    super(value)
  }

  protected available(): Option[] {
    const block = this.getSourceBlock()
    return contextOf(block?.workspace)
      .components.filter((component) => component.type === this.componentType)
      .map((component) => [component.name, component.id])
  }

  protected override missingLabel(id: string): string {
    if (id || !this.componentType) return id ? '⚠ ?' : '…'
    return componentLabel(this.componentType, getBlocksLocale())
  }

  static override fromJson(
    options: Blockly.FieldDropdownFromJsonConfig & { componentType: string },
  ) {
    return new ComponentField(options.componentType)
  }
}

/** Screens of the project. */
export class ScreenField extends ReferenceField {
  protected available(): Option[] {
    const block = this.getSourceBlock()
    return contextOf(block?.workspace).screens.map((screen) => [screen.name, screen.id])
  }

  static override fromJson() {
    return new ScreenField()
  }
}

/**
 * The properties of a component type that have blocks. Junior lists the essential ones
 * unless "More blocks" is on; a property already chosen always stays listed.
 */
export class PropertyField extends Blockly.FieldDropdown {
  constructor(
    readonly componentType: string,
    readonly access: 'get' | 'set',
    readonly keys: { key: string; junior: boolean }[],
  ) {
    super(function (this: PropertyField) {
      return this.buildOptions()
    } as unknown as Blockly.MenuGeneratorFunction)
    // The parent constructor ran before `keys` existed: pick the first property now.
    const first = keys[0]?.key
    if (first) this.setValue(first)
  }

  protected buildOptions(): Option[] {
    const block = this.getSourceBlock()
    const context = contextOf(block?.workspace)
    const value = (this as unknown as { value_: string | null }).value_
    const locale = getBlocksLocale()
    const all = context.mode === 'studio' || context.showAll
    const options = (this.keys ?? [])
      .filter((entry) => all || entry.junior || entry.key === value)
      .map(({ key }): Option => [propLabel(this.componentType, key, locale), key])
    return options.length ? options : [[messages[locale].blocks.categories.components, '']]
  }

  protected override doClassValidation_(value?: unknown): string | null {
    return typeof value === 'string' && (this.keys ?? []).some((entry) => entry.key === value)
      ? value
      : null
  }

  protected override doValueUpdate_(value: string): void {
    super.doValueUpdate_(value)
    const match = this.getOptions(false).find(
      (option) => Array.isArray(option) && option[1] === value,
    )
    if (match) (this as unknown as { selectedOption: unknown }).selectedOption = match
  }
}

/** Functions of the `app` workspace (see `AppFunctionRef`). */
export class AppFunctionField extends ReferenceField {
  protected available(): Option[] {
    const block = this.getSourceBlock()
    return (contextOf(block?.workspace).appFunctions ?? []).map((fn) => [fn.name, fn.name])
  }

  protected override missingLabel(id: string): string {
    return id ? `⚠ ${id}` : '…'
  }

  static override fromJson() {
    return new AppFunctionField()
  }
}

const EVENT_BLOCK = /^rx_([A-Za-z0-9]+)_on_([A-Za-z0-9]+)$/

/** The label of an event argument, from any component that declares it. */
export function argLabel(arg: string, type?: string): string {
  const locale = getBlocksLocale()
  const own = type ? getComponentDef(type)?.strings[locale].args?.[arg] : undefined
  if (own) return own
  for (const def of COMPONENTS) {
    const label = def.strings[locale].args?.[arg]
    if (label) return label
  }
  return arg
}

/**
 * The values of the event the block sits in (`item`, `index`…). Outside of an event, it keeps
 * its value, so that a block dragged out of the toolbox shows what it reads.
 */
export class EventArgField extends Blockly.FieldDropdown {
  constructor(value?: string) {
    super(function (this: EventArgField) {
      return this.buildOptions()
    } as unknown as Blockly.MenuGeneratorFunction)
    if (value) this.setValue(value)
  }

  protected buildOptions(): Option[] {
    const block = this.getSourceBlock()
    const value = (this as unknown as { value_: string | null }).value_
    const match = block ? EVENT_BLOCK.exec(block.getRootBlock().type) : null
    const type = match?.[1]
    const args = Object.keys((type && getComponentDef(type)?.events[match?.[2] ?? '']?.args) || {})
    const options: Option[] = args.map((arg) => [argLabel(arg, type), arg])
    if (value && !args.includes(value)) options.push([argLabel(value, type), value])
    return options.length ? options : [['…', '']]
  }

  protected override doClassValidation_(value?: unknown): string | null {
    return typeof value === 'string' ? value : null
  }

  protected override doValueUpdate_(value: string): void {
    super.doValueUpdate_(value)
    const match = this.getOptions(false).find(
      (option) => Array.isArray(option) && option[1] === value,
    )
    if (match) (this as unknown as { selectedOption: unknown }).selectedOption = match
  }
}

let registered = false

export function registerFields(): void {
  if (registered) return
  registered = true
  Blockly.fieldRegistry.register('field_rx_component', ComponentField)
  Blockly.fieldRegistry.register('field_rx_screen', ScreenField)
}

/** Redraws names and flags references to deleted components or screens. */
export function refreshReferences(workspace: Blockly.Workspace): void {
  const locale = getBlocksLocale()
  for (const block of workspace.getAllBlocks(false)) {
    let warning: string | null = null
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        if (field instanceof ReferenceField) {
          field.refresh()
          if (field.isMissing()) {
            warning =
              field instanceof ScreenField
                ? messages[locale].blocks.missingScreen
                : messages[locale].blocks.missingComponent
          }
        }
      }
    }
    if ('setWarningText' in block) (block as Blockly.BlockSvg).setWarningText(warning)
  }
}
