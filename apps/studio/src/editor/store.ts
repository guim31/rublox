import type { LogEntry, StepInfo } from '@rublox/runtime'
import type { ComponentId } from '@rublox/schema'
import { create } from 'zustand'

export type Device = 'phone' | 'iphone' | 'tablet'

/** Canvas presets (SPEC § 4.1). */
export const DEVICES: Record<Device, { width: number; height: number }> = {
  phone: { width: 360, height: 780 },
  iphone: { width: 393, height: 852 },
  tablet: { width: 820, height: 1180 },
}

/** `source`: the phone a message comes from (live test), none for the preview. */
export type ConsoleEntry = LogEntry & { id: number; source?: string }

export type PreviewControls = { restart(): void; stop(): void; resume(step: boolean): void }

/** Slow motion (SPEC § 4.3): on or off, the block running now, the breakpoints (block ids). */
export type SlowState = { enabled: boolean; step: StepInfo | null; breakpoints: string[] }

/** What the Data tab shows: a table, an API connection, the secrets or the shared variables. */
export type DataItem =
  | { kind: 'table'; id: string }
  | { kind: 'api'; id: string }
  | { kind: 'secrets' }
  | { kind: 'variables' }

type EditorState = {
  selected: ComponentId | null
  hovered: ComponentId | null
  device: Device
  landscape: boolean
  /** Canvas zoom in percent, or `fit`. */
  zoom: number | 'fit'
  appScheme: 'light' | 'dark'
  logs: ConsoleEntry[]
  running: boolean
  preview: PreviewControls | null
  /** A block to select once the Blocks view is shown (clicked console error). */
  focusBlock: string | null
  /** Live region message for screen readers (drag and drop, additions). */
  announcement: string
  slow: SlowState
  /** With the screen selected: its properties, or the app's theme and navigation. */
  inspectorTab: 'screen' | 'app'
  /** Every selected component (Studio's multiple selection); `selected` is the last one. */
  selection: ComponentId[]
  /** The Data tab's selection (J5). */
  dataItem: DataItem | null
  /** Blocks lit in the workspace (J9): what a level adds or changes. */
  marks: Record<string, 'added' | 'changed'>
  /** A block to scroll into view, without selecting it (J9: the tour, "what's new"). */
  reveal: string | null
  select(id: ComponentId | null): void
  /** Adds a component to the selection, or takes it out (Shift or Ctrl + click, Studio). */
  toggle(id: ComponentId): void
  hover(id: ComponentId | null): void
  set(
    patch: Partial<
      Omit<EditorState, 'select' | 'toggle' | 'hover' | 'set' | 'log' | 'clearLogs' | 'announce'>
    >,
  ): void
  log(entry: LogEntry & { source?: string }): void
  clearLogs(): void
  announce(message: string): void
}

let nextLog = 1
const MAX_LOGS = 500

export const useEditor = create<EditorState>()((set) => ({
  selected: null,
  hovered: null,
  device: 'phone',
  landscape: false,
  zoom: 'fit',
  appScheme: 'light',
  logs: [],
  running: false,
  preview: null,
  focusBlock: null,
  announcement: '',
  slow: { enabled: false, step: null, breakpoints: [] },
  inspectorTab: 'screen',
  selection: [],
  dataItem: null,
  marks: {},
  reveal: null,
  select: (selected) => set({ selected, selection: selected ? [selected] : [] }),
  toggle: (id) =>
    set((state) => {
      const current = state.selection.length
        ? state.selection
        : state.selected
          ? [state.selected]
          : []
      const selection = current.includes(id)
        ? current.filter((other) => other !== id)
        : [...current, id]
      return { selection, selected: selection.at(-1) ?? null }
    }),
  hover: (hovered) => set({ hovered }),
  set: (patch) => set(patch),
  log: (entry) =>
    set((state) => ({ logs: [...state.logs.slice(-(MAX_LOGS - 1)), { ...entry, id: nextLog++ }] })),
  clearLogs: () => set({ logs: [] }),
  announce: (announcement) => set({ announcement }),
}))

export function resetEditor(): void {
  useEditor.setState({
    selected: null,
    selection: [],
    hovered: null,
    logs: [],
    running: false,
    preview: null,
    focusBlock: null,
    slow: { enabled: false, step: null, breakpoints: [] },
    dataItem: null,
    marks: {},
    reveal: null,
  })
}

export function setSlow(patch: Partial<SlowState>): void {
  useEditor.setState((state) => ({ slow: { ...state.slow, ...patch } }))
}
