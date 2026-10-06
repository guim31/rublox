import { addAsset, removeAsset } from '@rublox/schema'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { errorMessage } from '../../lib/errors.ts'
import { MAX_IMAGE_BYTES } from '../../storage/assets.ts'
import { useAssetsVersion, useDoc, useSession } from '../context.tsx'

/** The project's images: in this browser in guest mode, on the server with an account. */
export function AssetsPanel() {
  const { t } = useTranslation()
  const session = useSession()
  const doc = useDoc()
  useAssetsVersion()
  const inputId = useId()
  const assets = Object.entries(doc.assets)
  const used = new Set(
    Object.values(doc.screens).flatMap((screen) =>
      Object.values(screen.components).map((c) => String(c.props.src ?? '')),
    ),
  )

  const upload = async (files: FileList | null) => {
    for (const file of files ?? []) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('editor.inspector.image.notImage'))
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(t('editor.inspector.image.tooBig'))
        continue
      }
      let stored: Awaited<ReturnType<typeof session.storeAsset>>
      try {
        stored = await session.storeAsset(file, 'image')
      } catch (error) {
        toast.error(errorMessage(t, error))
        continue
      }
      if (!assets.some(([, a]) => a.sha256 === stored.sha256)) addAsset(session.ydoc, stored)
    }
  }

  return (
    <section
      aria-label={t('editor.design.assets')}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
    >
      <label
        htmlFor={inputId}
        className="flex h-control cursor-pointer items-center justify-center gap-2 rounded-ui border border-dashed border-border-strong text-ui-sm font-strong text-muted hover:border-primary hover:text-primary-text"
      >
        <ImagePlus size={15} />
        {t('editor.inspector.image.upload')}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => void upload(event.target.files)}
      />
      <ul className="grid grid-cols-3 gap-2">
        {assets.map(([id, asset]) => (
          <li
            key={id}
            className="group relative aspect-square overflow-hidden rounded-ui border border-border bg-surface-2"
          >
            <img
              src={session.assetUrl(id)}
              alt={asset.name}
              title={asset.name}
              className="size-full object-cover"
            />
            {!used.has(id) ? (
              <button
                type="button"
                aria-label={`${t('common.delete')} ${asset.name}`}
                onClick={() => removeAsset(session.ydoc, id)}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded bg-surface/90 text-muted opacity-0 shadow-1 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
