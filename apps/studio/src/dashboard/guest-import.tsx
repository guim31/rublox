import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDriveUpload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../components/ui/button.tsx'
import { getAll, STORES } from '../storage/db.ts'
import type { ProjectSummary } from '../storage/summaries.ts'
import { PROJECTS_KEY } from './queries.ts'

const DISMISSED = 'rublox:import-later'

function dismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}

/** Offers to move the projects made in guest mode into the account (SPEC § 4.8). */
export function GuestImport() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [hidden, setHidden] = useState(dismissed)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // The summaries only: moving the projects (Yjs, the format) is loaded when asked.
  const guest = useQuery({
    queryKey: ['guest-projects'],
    queryFn: async () =>
      (await getAll<ProjectSummary>(STORES.projects)).filter((project) => !project.deletedAt),
  })
  const count = guest.data?.length ?? 0
  if (hidden || count === 0) return null

  const run = async () => {
    setProgress({ done: 0, total: count })
    const { importGuestProjects } = await import('../storage/import.ts')
    const result = await importGuestProjects((done, total) => setProgress({ done, total }))
    setProgress(null)
    if (result.imported) toast.success(t('importGuest.done', { count: result.imported }))
    for (const name of result.failed) toast.error(t('importGuest.failed', { name }))
    await client.invalidateQueries({ queryKey: ['guest-projects'] })
    await client.invalidateQueries({ queryKey: PROJECTS_KEY })
  }

  return (
    <section
      aria-labelledby="guest-import-title"
      className="mt-6 flex flex-wrap items-center gap-4 rounded-ui-lg border border-primary/30 bg-primary-soft p-4 junior:p-5"
    >
      <HardDriveUpload size={28} className="shrink-0 text-primary-text" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 id="guest-import-title" className="font-strong">
          {t('importGuest.title')}
        </h2>
        <p className="text-ui-sm text-text/80">{t('importGuest.text', { count })}</p>
      </div>
      {progress ? (
        <p role="status" className="font-strong text-primary-text">
          {t('importGuest.progress', progress)}
        </p>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              try {
                sessionStorage.setItem(DISMISSED, '1')
              } catch {}
              setHidden(true)
            }}
          >
            {t('importGuest.later')}
          </Button>
          <Button variant="primary" onClick={run}>
            {t('importGuest.action')}
          </Button>
        </div>
      )}
    </section>
  )
}
