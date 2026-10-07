import { resolveProps } from '@rublox/catalog'
import type { ProjectDoc, ScreenId } from '@rublox/schema'
import { allBlocks, countBlocks, findBlock, isInside } from './blocks.ts'

/** Something that happened in the running app (a click in the preview…). */
export type PreviewEvent = {
  componentType: string
  componentName: string
  event: string
  screenId: ScreenId
}

/** What a step or a star is checked against: the project, the editor and the preview. */
export type LearnState = {
  doc: ProjectDoc
  tab: 'design' | 'blocks' | 'data'
  /** The screen (or `app`) being edited. */
  workspace: string
  /** Type of the selected component in Design. */
  selectedType: string | null
  /** Events received from the preview since the step (or the challenge) started. */
  events: readonly PreviewEvent[]
  /** Screen shown in the preview. */
  previewScreen: ScreenId | null
  /** Slow motion is on. */
  slowMotion: boolean
  /** Blocks lit by slow motion since the step started (J9). */
  stepped?: readonly string[]
}

/**
 * A check, written as data in `content/` (SPEC § 4.10): tutorial steps are validated when it
 * becomes true, challenge stars are earned with it.
 */
export type Condition =
  /** At least `min` (1) components of `type`, on any screen. */
  | { kind: 'component'; type: string; min?: number }
  /** A component of `type` whose property differs from its default, or equals / contains. */
  | {
      kind: 'prop'
      type: string
      prop: string
      equals?: string | number | boolean
      contains?: string
      /** At least this many components match (1). */
      min?: number
    }
  /** The project has at least `min` screens. */
  | { kind: 'screens'; min: number }
  /**
   * At least `min` (1) enabled blocks of `type`, optionally inside `inside` (a path of
   * enclosing block types, nearest first), with non-empty fields or exact field values.
   */
  | {
      kind: 'block'
      type: string | string[]
      min?: number
      inside?: string[]
      filled?: string[]
      fields?: Record<string, string | number>
      /** `start`: in the start screen's workspace; `other`: in any other screen's. */
      workspace?: 'start' | 'other' | 'app'
      /** Only in the block with this id, or below it in its stack (J9). */
      within?: string
    }
  /**
   * The block with this id (J9: the blocks of an app to take apart keep their ids) has a
   * field that equals `equals`, differs from `not`, or is a number between `min` and `max`.
   */
  | {
      kind: 'blockField'
      id: string
      field: string
      equals?: string | number
      not?: string | number
      min?: number
      max?: number
    }
  /** Slow motion lit this block (or any block) since the step started (J9). */
  | { kind: 'stepped'; id?: string }
  /** At most `max` blocks in the whole project. */
  | { kind: 'blockCount'; max: number }
  /** The editor shows this tab. */
  | { kind: 'tab'; tab: 'design' | 'blocks' | 'data' }
  /** The editor is on the start screen, another screen, or the `app` workspace. */
  | { kind: 'workspace'; screen: 'start' | 'other' | 'app' }
  /** The selected component is of this type. */
  | { kind: 'selected'; type: string }
  /** The preview reported this event (at least `min` times), on a component of `type`. */
  | { kind: 'preview'; event: string; type?: string; min?: number }
  /** The preview shows the start screen, or another one. */
  | { kind: 'previewScreen'; screen: 'start' | 'other' }
  | { kind: 'slowMotion' }
  /** At least `min` variables of the app (or of `scope`: stored, shared). */
  | { kind: 'variables'; min: number; scope?: 'app' | 'stored' | 'shared' }
  /**
   * A table of the Data tab (J5): at least `min` (1) tables in `mode`, with `minColumns`
   * columns and `minRows` rows (a shared table's rows live on the server: not counted).
   */
  | {
      kind: 'table'
      min?: number
      mode?: 'local' | 'shared'
      minColumns?: number
      minRows?: number
    }
  /** An API connection whose address contains `urlContains`, with these `params` (J5). */
  | { kind: 'api'; urlContains?: string; params?: string[] }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition }
  /** Validated by the "Next" button only. */
  | { kind: 'manual' }

function components(doc: ProjectDoc, type: string) {
  return Object.values(doc.screens).flatMap((screen) =>
    Object.values(screen.components).filter((node) => node.type === type),
  )
}

/** Whether a condition holds. `manual` never does: the person clicks "Next". */
export function evaluate(condition: Condition, state: LearnState): boolean {
  const { doc } = state
  switch (condition.kind) {
    case 'component':
      return components(doc, condition.type).length >= (condition.min ?? 1)
    case 'prop':
      return (
        components(doc, condition.type).filter((node) => {
          const own = node.props[condition.prop]
          const value = resolveProps(node.type, node.props, doc.meta.locale)[condition.prop]
          if (condition.equals !== undefined) return value === condition.equals
          if (condition.contains !== undefined)
            return String(value ?? '')
              .toLocaleLowerCase()
              .includes(condition.contains.toLocaleLowerCase())
          // Localized defaults are written into the component: compare with the catalog's.
          const fresh = resolveProps(node.type, {}, doc.meta.locale)[condition.prop]
          return own !== undefined && own !== fresh && String(own).trim() !== ''
        }).length >= (condition.min ?? 1)
      )
    case 'screens':
      return doc.screenOrder.length >= condition.min
    case 'block': {
      const types = Array.isArray(condition.type) ? condition.type : [condition.type]
      const start = doc.settings.navigation.startScreen
      const matches = allBlocks(doc).filter(
        ({ workspace, block, ancestors, ancestorIds, enabled }) => {
          if (!enabled || !types.includes(block.type)) return false
          if (
            condition.within &&
            block.id !== condition.within &&
            !ancestorIds.includes(condition.within)
          )
            return false
          if (condition.workspace === 'start' && workspace !== start) return false
          if (condition.workspace === 'app' && workspace !== 'app') return false
          if (condition.workspace === 'other' && (workspace === start || workspace === 'app'))
            return false
          if (condition.inside && !isInside(ancestors, condition.inside)) return false
          const fields = (block.fields ?? {}) as Record<string, unknown>
          for (const name of condition.filled ?? []) {
            if (String(fields[name] ?? '').trim() === '') return false
          }
          for (const [name, value] of Object.entries(condition.fields ?? {})) {
            if (fields[name] !== value) return false
          }
          return true
        },
      )
      return matches.length >= (condition.min ?? 1)
    }
    case 'blockField': {
      const found = findBlock(doc, condition.id)
      if (!found?.enabled) return false
      const value = ((found.block.fields ?? {}) as Record<string, unknown>)[condition.field]
      if (value === undefined) return false
      const same = (expected: string | number) =>
        typeof expected === 'number' ? Number(value) === expected : String(value) === expected
      if (condition.equals !== undefined && !same(condition.equals)) return false
      if (condition.not !== undefined && same(condition.not)) return false
      if (condition.min !== undefined || condition.max !== undefined) {
        const number = Number(value)
        if (!Number.isFinite(number)) return false
        if (condition.min !== undefined && number < condition.min) return false
        if (condition.max !== undefined && number > condition.max) return false
      }
      return true
    }
    case 'stepped':
      return condition.id
        ? (state.stepped ?? []).includes(condition.id)
        : (state.stepped ?? []).length > 0
    case 'blockCount':
      return countBlocks(doc) > 0 && countBlocks(doc) <= condition.max
    case 'tab':
      return state.tab === condition.tab
    case 'workspace': {
      const start = doc.settings.navigation.startScreen
      if (condition.screen === 'app') return state.workspace === 'app'
      if (condition.screen === 'start') return state.workspace === start
      return state.workspace !== start && state.workspace !== 'app'
    }
    case 'selected':
      return state.selectedType === condition.type
    case 'preview':
      return (
        state.events.filter(
          (event) =>
            event.event === condition.event &&
            (!condition.type || event.componentType === condition.type),
        ).length >= (condition.min ?? 1)
      )
    case 'previewScreen': {
      if (!state.previewScreen) return false
      const isStart = state.previewScreen === doc.settings.navigation.startScreen
      return condition.screen === 'start' ? isStart : !isStart
    }
    case 'slowMotion':
      return state.slowMotion
    case 'variables':
      return doc.variables[condition.scope ?? 'app'].length >= condition.min
    case 'table':
      return (
        Object.values(doc.data.tables).filter(
          (table) =>
            (!condition.mode || table.mode === condition.mode) &&
            table.columns.length >= (condition.minColumns ?? 0) &&
            table.rows.length >= (condition.minRows ?? 0),
        ).length >= (condition.min ?? 1)
      )
    case 'api':
      return Object.values(doc.data.apis).some(
        (api) =>
          api.baseUrl.toLowerCase().includes((condition.urlContains ?? '').toLowerCase()) &&
          (condition.params ?? []).every((key) =>
            api.params.some((pair) => pair.key.trim() === key && pair.value.trim() !== ''),
          ),
      )
    case 'all':
      return condition.of.every((c) => evaluate(c, state))
    case 'any':
      return condition.of.some((c) => evaluate(c, state))
    case 'not':
      return !evaluate(condition.of, state)
    case 'manual':
      return false
  }
}

/** Whether a condition needs events from the preview (so they are recorded). */
export function usesPreview(condition: Condition | undefined): boolean {
  if (!condition) return false
  if (condition.kind === 'preview' || condition.kind === 'previewScreen') return true
  if (condition.kind === 'all' || condition.kind === 'any')
    return condition.of.some((c) => usesPreview(c))
  if (condition.kind === 'not') return usesPreview(condition.of)
  return false
}
