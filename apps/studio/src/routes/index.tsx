import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '../dashboard/dashboard.tsx'

type Search = { new?: boolean }

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): Search => (search.new ? { new: true } : {}),
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  return <Dashboard openNew={search.new === true} />
}
