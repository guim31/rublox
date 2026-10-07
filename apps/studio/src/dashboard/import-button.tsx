import { useNavigate } from '@tanstack/react-router'
import { Upload } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../components/ui/button.tsx'
import { errorMessage } from '../lib/errors.ts'
import { useProjectMutation } from './queries.ts'

/** Imports a `.rublox` file as a new project (SPEC § 4.6), then opens it. */
export function ImportButton({ target }: { target: 'guest' | 'server' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  // The archive reader (zip) is loaded when a file is chosen.
  const archive = () => import('../storage/archive.ts')
  const run = useProjectMutation(async (file: File) =>
    (await archive()).importArchive(file, target),
  )

  const onFile = async (file: File) => {
    const id = toast.loading(t('transfer.importing', { file: file.name }))
    try {
      const projectId = (await run.mutateAsync(file)) as string
      toast.success(t('transfer.imported', { name: file.name.replace(/\.rublox$/i, '') }), { id })
      await navigate({ to: '/p/$projectId', params: { projectId }, search: { tab: 'design' } })
    } catch (error) {
      const { ArchiveReadError } = await archive()
      toast.error(
        error instanceof ArchiveReadError
          ? error.code === 'too-new'
            ? t('transfer.importTooNew')
            : t('transfer.importInvalid')
          : target === 'server'
            ? errorMessage(t, error)
            : t('transfer.importError'),
        { id },
      )
    }
  }

  return (
    <>
      <Button
        size="lg"
        icon={<Upload size={18} />}
        title={t('transfer.importTitle')}
        onClick={() => input.current?.click()}
        disabled={run.isPending}
        data-testid="import-project"
      >
        {t('transfer.import')}
      </Button>
      <input
        ref={input}
        type="file"
        // `ARCHIVE_EXTENSION` of @rublox/schema, written out: importing it would bring its
        // module's Zod schemas into the dashboard's first download.
        accept=".rublox,application/zip"
        className="hidden"
        aria-label={t('transfer.importTitle')}
        data-testid="import-file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onFile(file)
        }}
      />
    </>
  )
}
