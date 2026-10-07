import type { BlocklyJson, WorkspaceKey } from '@rublox/schema'
import { create } from 'zustand'
import type { ExplainTarget } from './types.ts'

/** What the assistant panel of the editor was asked (J6, SPEC § 4.12). */
export type AiQuestion =
  | { kind: 'explain'; target: ExplainTarget; workspace: WorkspaceKey; block?: BlocklyJson }
  | { kind: 'debug'; workspace: WorkspaceKey }

export const useAiPanel = create<{
  question: AiQuestion | null
  /** Bumped to ask the same question again. */
  asked: number
  open(question: AiQuestion): void
  close(): void
}>((set) => ({
  question: null,
  asked: 0,
  open: (question) => set((state) => ({ question, asked: state.asked + 1 })),
  close: () => set({ question: null }),
}))
