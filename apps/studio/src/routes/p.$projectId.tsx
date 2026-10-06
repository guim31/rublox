import { createFileRoute } from '@tanstack/react-router'
import { EditorPage } from '../editor/editor-page.tsx'

export type EditorTab = 'design' | 'blocks'
type Search = { tab: EditorTab; screen?: string }

export const Route = createFileRoute('/p/$projectId')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    tab: search.tab === 'blocks' ? 'blocks' : 'design',
    ...(typeof search.screen === 'string' ? { screen: search.screen } : {}),
  }),
  component: Editor,
})

function Editor() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch()
  return <EditorPage projectId={projectId} tab={search.tab} screen={search.screen} />
}
