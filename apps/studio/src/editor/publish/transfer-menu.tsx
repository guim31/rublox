import type { AppSettings } from '@rublox/schema'
import { FileArchive, Globe, PackageOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { IconButton } from '../../components/ui/button.tsx'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '../../components/ui/menu.tsx'
import { api, call } from '../../lib/api.ts'
import {
  ARCHIVE_EXTENSION,
  download,
  exportProject,
  exportSite,
  fileName,
} from '../../storage/archive.ts'
import { useSession } from '../context.tsx'
import { buildBundle } from './bundle.ts'
import { drawIcons } from './icons.ts'
import { defaultAppSettings } from './settings.ts'

/** The project menu of the top bar: export as `.rublox` or as a website (SPEC § 4.6). */
export function TransferMenu() {
  const { t } = useTranslation()
  const session = useSession()
  const loadAsset = (hash: string) => session.source.loadAsset(hash)

  const run = async (make: () => Promise<{ blob: Blob; name: string }>) => {
    const id = toast.loading(t('transfer.exporting'))
    try {
      const { blob, name } = await make()
      download(blob, name)
      toast.success(t('transfer.exported', { file: name }), { id })
    } catch {
      toast.error(t('transfer.exportError'), { id })
    }
  }

  const settingsFor = async (): Promise<AppSettings> => {
    const doc = session.getDoc()
    if (session.source.kind === 'server') {
      const info = await call(
        api.projects[':projectId'].publication.$get({ param: { projectId: session.id } }),
      ).catch(() => null)
      if (info?.settings) return info.settings
    }
    return defaultAppSettings(doc)
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={t('transfer.menu')} data-testid="transfer-menu">
          <PackageOpen size={18} />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>{t('transfer.menu')}</MenuLabel>
        <MenuItem
          icon={<FileArchive size={15} />}
          onSelect={() =>
            void run(async () => {
              const doc = session.getDoc()
              return {
                blob: await exportProject(doc, loadAsset),
                name: fileName(doc.meta.name, ARCHIVE_EXTENSION),
              }
            })
          }
        >
          {t('transfer.export')}
        </MenuItem>
        <MenuItem
          icon={<Globe size={15} />}
          onSelect={() =>
            void run(async () => {
              const doc = session.getDoc()
              const settings = await settingsFor()
              const asset =
                settings.icon.kind === 'asset' ? doc.assets[settings.icon.assetId] : undefined
              const image = asset ? await loadAsset(asset.sha256) : undefined
              const [bundle, icons] = await Promise.all([
                buildBundle(doc),
                drawIcons(settings, image),
              ])
              const blob = await exportSite({
                bundle,
                settings,
                icons,
                loadAsset,
                readme: t('transfer.siteReadme', { name: settings.name }),
              })
              return { blob, name: fileName(`${doc.meta.name} (web)`, '.zip') }
            })
          }
        >
          {t('transfer.exportSite')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
