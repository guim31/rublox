import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '../dashboard/dashboard.tsx'
import { Landing } from '../home/landing.tsx'
import { usePrefs } from '../lib/prefs.ts'
import { useMe } from '../lib/session.ts'

type Search = { new?: boolean }

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): Search => (search.new ? { new: true } : {}),
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  const me = useMe()
  const welcomed = usePrefs((s) => s.welcomed)
  // A visitor who is not signed in first sees what Rublox is (J3), unless they chose guest mode.
  if (!welcomed && !me.isPending && !me.data?.user) return <Landing />
  return <Dashboard openNew={search.new === true} />
}
