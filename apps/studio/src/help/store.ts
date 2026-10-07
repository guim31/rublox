import { create } from 'zustand'

export type HelpTab = 'blocks' | 'components' | 'glossary'

/** A sheet of the help: a block type, a component type or a glossary entry. */
export type HelpTopic = { kind: 'block' | 'component' | 'term'; id: string }

type HelpState = { open: boolean; tab: HelpTab; topic: HelpTopic | null; query: string }

/** The help panel (SPEC § 4.10): open from the top bar, or on a block ("Help on this block"). */
export const useHelp = create<HelpState>()(() => ({
  open: false,
  tab: 'blocks',
  topic: null,
  query: '',
}))

export function openHelp(topic?: HelpTopic): void {
  if (!topic) {
    useHelp.setState({ open: true })
    return
  }
  const tab: HelpTab =
    topic.kind === 'block' ? 'blocks' : topic.kind === 'component' ? 'components' : 'glossary'
  useHelp.setState({ open: true, tab, topic, query: '' })
}
