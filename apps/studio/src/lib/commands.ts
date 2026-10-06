import type { ReactNode } from 'react'
import { create } from 'zustand'

export type Command = {
  id: string
  group: 'project' | 'editor' | 'add' | 'interface'
  label: string
  icon?: ReactNode
  shortcut?: string
  keywords?: string[]
  run: () => void
}

type CommandsState = {
  open: boolean
  /** Commands of the current page (the editor registers its own). */
  page: Command[]
  setOpen(open: boolean): void
  setPage(commands: Command[]): void
}

export const useCommands = create<CommandsState>()((set) => ({
  open: false,
  page: [],
  setOpen: (open) => set({ open }),
  setPage: (page) => set({ page }),
}))
