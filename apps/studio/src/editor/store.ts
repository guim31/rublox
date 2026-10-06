import type { LogEntry } from '@rublox/runtime'
import type { ComponentId } from '@rublox/schema'
import { create } from 'zustand'

export type Device = 'phone' | 'iphone' | 'tablet'

/** Canvas presets (SPEC § 4.1). */
export const DEVICES: Record<Device, { width: number; height: number }> = {
  phone: { width: 360, height: 780 },
  iphone: { width: 393, height: 852 },
  tablet: { width: 820, height: 1180 },
}

export type ConsoleEntry = LogEntry & { id: number }

export type PreviewControls = { restart(): void; stop(): void }

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
  select(id: ComponentId | null): void
  hover(id: ComponentId | null): void
  set(
    patch: Partial<
      Omit<EditorState, 'select' | 'hover' | 'set' | 'log' | 'clearLogs' | 'announce'>
    >,
  ): void
  log(entry: LogEntry): void
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
  select: (selected) => set({ selected }),
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
    hovered: null,
    logs: [],
    running: false,
    preview: null,
    focusBlock: null,
  })
}
