import { type AppSettings, type AppSettingsInput, isValidSlug } from '@rublox/schema'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  ExternalLink,
  HelpCircle,
  ImageIcon,
  Lock,
  Printer,
  Rocket,
  RotateCcw,
  Smile,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { QrCode } from '../../components/qr-code.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Dialog } from '../../components/ui/dialog.tsx'
import { Badge, describedBy, Field } from '../../components/ui/field.tsx'
import { fieldClass, Input } from '../../components/ui/input.tsx'
import { Segmented } from '../../components/ui/segmented.tsx'
import { awardBadge } from '../../learn/store.ts'
import { api, call } from '../../lib/api.ts'
import { toBase64 } from '../../lib/base64.ts'
import { cn } from '../../lib/cn.ts'
import { config } from '../../lib/config.ts'
import { errorMessage } from '../../lib/errors.ts'
import { useDoc, useSession } from '../context.tsx'
import { buildBundle } from './bundle.ts'
import { drawIcons, ICON_COLORS, ICON_EMOJIS } from './icons.ts'
import { appAddress, defaultAppSettings } from './settings.ts'

const publication = api.projects[':projectId'].publication
type Tab = 'settings' | 'share' | 'versions'
async function blobToBase64(blob: Blob): Promise<string> {
  return toBase64(new Uint8Array(await blob.arrayBuffer()))
}

/**
 * "Publish" (SPEC § 4.6): name, address, icon, colours and description; each publication is
 * a frozen version at the same address. Then the address, its QR code (printable) and the
 * versions, which can be put back online, or the app unpublished.
 */
export function PublishDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const session = useSession()
  const doc = useDoc()
  const client = useQueryClient()
  const projectId = session.id
  const key = ['publication', projectId]
  const info = useQuery({
    queryKey: key,
    queryFn: () => call(publication.$get({ param: { projectId } })),
    enabled: open,
  })
  const [tab, setTab] = useState<Tab>('settings')
  const [form, setForm] = useState<AppSettings | null>(null)
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unpublishing, setUnpublishing] = useState(false)
  const [printing, setPrinting] = useState(false)

  const data = info.data
  // Fill the form once, from the last version or from the project.
  useEffect(() => {
    if (!data || form) return
    setForm(data.settings ?? defaultAppSettings(doc))
    setSlug(data.slug ?? data.suggestedSlug)
    if (data.published) setTab('share')
  }, [data, form, doc])

  const fixed = Boolean(data?.slug)
  const slugCheck = useQuery({
    queryKey: ['slug', projectId, slug],
    queryFn: () => call(publication.slug[':slug'].$get({ param: { projectId, slug } })),
    enabled: open && !fixed && isValidSlug(slug),
    staleTime: 10_000,
  })
  const slugState = !isValidSlug(slug)
    ? 'invalid'
    : fixed || slugCheck.data?.available
      ? 'free'
      : slugCheck.data && !slugCheck.data.available
        ? 'taken'
        : 'checking'

  const refresh = () => client.invalidateQueries({ queryKey: key })

  const publish = async () => {
    if (!form || slugState === 'invalid' || slugState === 'taken') return
    setBusy(true)
    setError('')
    try {
      const current = session.getDoc()
      const settings: AppSettingsInput = { ...form, name: form.name.trim() || current.meta.name }
      const asset = form.icon.kind === 'asset' ? current.assets[form.icon.assetId] : undefined
      const image = asset ? await session.source.loadAsset(asset.sha256) : undefined
      const [bundle, icons] = await Promise.all([
        buildBundle(current),
        drawIcons({ icon: form.icon, backgroundColor: form.backgroundColor }, image),
      ])
      const result = await call(
        publication.$put({
          param: { projectId },
          json: {
            slug,
            settings,
            bundle,
            icons: {
              '192': await blobToBase64(icons['192']),
              '512': await blobToBase64(icons['512']),
              maskable: await blobToBase64(icons.maskable),
              apple: await blobToBase64(icons.apple),
            },
          },
        }),
      )
      toast.success(t('publish.done', { version: result.version }))
      void awardBadge('first-publish')
      await refresh()
      setTab('share')
    } catch (caught) {
      setError(errorMessage(t, caught))
    } finally {
      setBusy(false)
    }
  }

  const url = data?.url ?? appAddress(slug)
  const title = t('publish.title', { name: doc.meta.name })

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => !value && onClose()}
        title={title}
        description={t('publish.intro')}
        className="max-h-[calc(100dvh-24px)] w-[min(95vw,780px)] overflow-y-auto"
      >
        {!data || !form ? (
          <div className="grid h-60 place-items-center" role="status">
            <div className="size-7 animate-spin rounded-full border-3 border-border border-t-primary" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                label={title}
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'settings', label: t('publish.tabs.settings') },
                  { value: 'share', label: t('publish.tabs.share') },
                  { value: 'versions', label: t('publish.tabs.versions') },
                ]}
              />
              <div className="flex-1" />
              <Badge tone={data.published ? 'success' : 'neutral'}>
                <span data-testid="publish-state">
                  {data.published
                    ? `${t('publish.online')} · ${t('publish.version', { number: data.current?.number ?? 0 })}`
                    : t('publish.offline')}
                </span>
              </Badge>
            </div>
            {!data.canPublish ? (
              <p className="rounded-ui bg-yellow-soft px-3 py-2 text-ui-sm" role="note">
                {session.readOnly ? t('publish.readOnly') : t('publish.forbidden')}
              </p>
            ) : null}
            {tab === 'settings' ? (
              <SettingsForm
                form={form}
                setForm={setForm}
                slug={slug}
                setSlug={setSlug}
                fixed={fixed}
                slugState={slugState}
                disabled={!data.canPublish || busy}
              />
            ) : tab === 'share' ? (
              <SharePanel
                url={data.published ? url : null}
                name={form.name}
                onPrint={() => {
                  setPrinting(true)
                  // Let the sheet render, then print it alone (see `.print-sheet`).
                  setTimeout(() => {
                    window.print()
                    setPrinting(false)
                  }, 300)
                }}
              />
            ) : (
              <VersionsPanel
                data={data}
                canPublish={data.canPublish}
                onCurrent={async (versionId, number) => {
                  try {
                    await call(
                      publication.versions[':versionId'].current.$post({
                        param: { projectId, versionId },
                      }),
                    )
                    toast.success(t('publish.madeCurrent', { number }))
                    await refresh()
                  } catch (caught) {
                    toast.error(errorMessage(t, caught))
                  }
                }}
                onUnpublish={() => setUnpublishing(true)}
              />
            )}
            {error ? (
              <p role="alert" className="text-ui-sm text-danger">
                {error}
              </p>
            ) : null}
            {tab === 'settings' && data.canPublish ? (
              <div className="sticky -bottom-5 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-surface px-5 py-4 junior:-bottom-7 junior:-mx-7 junior:-mb-7 junior:px-7">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Rocket size={18} />}
                  disabled={busy || slugState === 'invalid' || slugState === 'taken'}
                  onClick={() => void publish()}
                  data-testid="publish-submit"
                >
                  {busy
                    ? t('publish.publishing')
                    : data.versions.length
                      ? t('publish.submitAgain')
                      : t('publish.submit')}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Dialog>
      <Dialog
        open={unpublishing}
        onOpenChange={setUnpublishing}
        title={t('publish.unpublishTitle', { name: form?.name ?? '' })}
        description={t('publish.unpublishText', { url })}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setUnpublishing(false)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await call(publication.$delete({ param: { projectId } }))
                toast(t('publish.unpublished'))
                setUnpublishing(false)
                await refresh()
              } catch (caught) {
                toast.error(errorMessage(t, caught))
              }
            }}
          >
            {t('publish.unpublish')}
          </Button>
        </div>
      </Dialog>
      {printing && data?.published
        ? createPortal(
            <div className="print-sheet">
              <h1 style={{ fontSize: 34, margin: 0 }}>{form?.name}</h1>
              <QrCode value={url} label={t('publish.qr')} className="w-[11cm]" />
              <p style={{ fontSize: 20, margin: 0 }}>{t('publish.printHint')}</p>
              <p style={{ fontSize: 14, margin: 0, fontFamily: 'monospace' }}>{url}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

type SlugState = 'invalid' | 'free' | 'taken' | 'checking'

function SettingsForm({
  form,
  setForm,
  slug,
  setSlug,
  fixed,
  slugState,
  disabled,
}: {
  form: AppSettings
  setForm: (form: AppSettings) => void
  slug: string
  setSlug: (slug: string) => void
  fixed: boolean
  slugState: SlugState
  disabled: boolean
}) {
  const { t } = useTranslation()
  const session = useSession()
  const doc = useDoc()
  const images = Object.entries(doc.assets).filter(([, asset]) => asset.kind === 'image')
  const set = (patch: Partial<AppSettings>) => setForm({ ...form, ...patch })
  const prefix = `${new URL(config.appsUrl).host}/a/`
  const [iconKind, setIconKind] = useState<'emoji' | 'asset'>(form.icon.kind)
  const emoji = form.icon.kind === 'emoji' ? form.icon : null
  const slugHint =
    slugState === 'invalid'
      ? t('publish.addressInvalid')
      : slugState === 'taken'
        ? t('publish.addressTaken')
        : fixed
          ? t('publish.addressFixed')
          : slugState === 'free'
            ? t('publish.addressFree')
            : t('publish.addressHint')

  return (
    <fieldset disabled={disabled} className="grid gap-5 md:grid-cols-[1fr_210px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Field id="publish-name" label={t('publish.name')} hint={t('publish.nameHint')}>
          <Input
            id="publish-name"
            value={form.name}
            maxLength={40}
            onChange={(event) => set({ name: event.target.value })}
            aria-describedby={describedBy('publish-name', true)}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="publish-slug" className="text-ui-sm font-strong">
            {t('publish.address')}
          </label>
          <div
            className={cn(
              fieldClass,
              'flex items-center gap-0 p-0 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20',
              (slugState === 'invalid' || slugState === 'taken') && 'border-danger',
            )}
          >
            <span className="shrink-0 pl-2.5 font-mono text-ui-sm text-muted">{prefix}</span>
            <input
              id="publish-slug"
              value={slug}
              readOnly={fixed}
              maxLength={40}
              spellCheck={false}
              autoCapitalize="none"
              onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s/g, '-'))}
              aria-describedby="publish-slug-hint"
              aria-invalid={slugState === 'invalid' || slugState === 'taken'}
              className="h-full min-w-0 flex-1 bg-transparent pr-2 font-mono text-ui-sm outline-none read-only:text-muted"
              data-testid="publish-slug"
            />
            {fixed ? <Lock size={14} className="mr-2.5 shrink-0 text-muted" /> : null}
            {!fixed && slugState === 'free' ? (
              <Check size={15} className="mr-2.5 shrink-0 text-mint" />
            ) : null}
            {!fixed && (slugState === 'invalid' || slugState === 'taken') ? (
              <X size={15} className="mr-2.5 shrink-0 text-danger" />
            ) : null}
          </div>
          <p
            id="publish-slug-hint"
            className={cn(
              'text-ui-sm text-muted',
              (slugState === 'invalid' || slugState === 'taken') && 'text-danger',
            )}
            aria-live="polite"
          >
            {slugHint}
          </p>
        </div>
        <Field
          id="publish-description"
          label={t('publish.description')}
          hint={t('publish.descriptionHint')}
        >
          <textarea
            id="publish-description"
            value={form.description}
            maxLength={300}
            rows={2}
            onChange={(event) => set({ description: event.target.value })}
            className={cn(fieldClass, 'h-auto resize-none py-1.5')}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui-sm font-strong" id="publish-icon">
              {t('publish.icon')}
            </span>
            <Segmented
              size="sm"
              label={t('publish.icon')}
              value={iconKind}
              onChange={(kind) => {
                setIconKind(kind)
                if (kind === 'emoji') {
                  set({ icon: { kind: 'emoji', emoji: '🚀', background: form.themeColor } })
                } else if (images[0]) {
                  set({ icon: { kind: 'asset', assetId: images[0][0] } })
                }
              }}
              options={[
                { value: 'emoji', label: t('publish.iconEmoji'), icon: <Smile size={14} /> },
                { value: 'asset', label: t('publish.iconImage'), icon: <ImageIcon size={14} /> },
              ]}
            />
          </div>
          {iconKind === 'emoji' && emoji ? (
            <>
              <fieldset className="grid grid-cols-8 gap-1" aria-labelledby="publish-icon">
                {ICON_EMOJIS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={t('publish.emojiLabel', { emoji: value })}
                    aria-pressed={emoji.emoji === value}
                    onClick={() => set({ icon: { ...emoji, emoji: value } })}
                    className={cn(
                      'grid aspect-square place-items-center rounded-ui text-[22px] hover:bg-surface-2 junior:text-[26px]',
                      emoji.emoji === value && 'bg-primary-soft ring-2 ring-primary',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </fieldset>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="publish-emoji"
                  className="flex items-center gap-2 text-ui-sm text-muted"
                >
                  {t('publish.customEmoji')}
                  <Input
                    id="publish-emoji"
                    value={emoji.emoji}
                    maxLength={16}
                    className="w-16 text-center text-[18px]"
                    onChange={(event) =>
                      event.target.value && set({ icon: { ...emoji, emoji: event.target.value } })
                    }
                  />
                </label>
                <div className="flex-1" />
                <ColorPicker
                  label={t('publish.iconBackground')}
                  value={emoji.background}
                  onChange={(background) => set({ icon: { ...emoji, background } })}
                  swatches
                />
              </div>
            </>
          ) : iconKind === 'asset' ? (
            images.length ? (
              <div className="grid grid-cols-6 gap-1.5">
                {images.map(([id, asset]) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={t('publish.pickImage', { name: asset.name })}
                    aria-pressed={form.icon.kind === 'asset' && form.icon.assetId === id}
                    onClick={() => set({ icon: { kind: 'asset', assetId: id } })}
                    className={cn(
                      'aspect-square overflow-hidden rounded-ui border border-border bg-surface-2',
                      form.icon.kind === 'asset' &&
                        form.icon.assetId === id &&
                        'ring-2 ring-primary ring-offset-2 ring-offset-surface',
                    )}
                  >
                    <img src={session.assetUrl(id)} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-ui bg-surface-2 px-3 py-2 text-ui-sm text-muted">
                {t('publish.noImages')}
              </p>
            )
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorPicker
            label={t('publish.themeColor')}
            hint={t('publish.themeColorHint')}
            value={form.themeColor}
            onChange={(themeColor) => set({ themeColor })}
          />
          <ColorPicker
            label={t('publish.backgroundColor')}
            hint={t('publish.backgroundColorHint')}
            value={form.backgroundColor}
            onChange={(backgroundColor) => set({ backgroundColor })}
          />
        </div>
      </div>
      <IconPreview form={form} />
    </fieldset>
  )
}

function ColorPicker({
  label,
  hint,
  value,
  onChange,
  swatches,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  swatches?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {swatches
          ? ICON_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${label} ${color}`}
                aria-pressed={value === color}
                onClick={() => onChange(color)}
                className={cn(
                  'size-6 rounded-full border border-border-strong',
                  value === color && 'ring-2 ring-primary ring-offset-2 ring-offset-surface',
                )}
                style={{ background: color }}
              />
            ))
          : null}
        <label className="flex cursor-pointer items-center gap-2 text-ui-sm font-strong">
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="size-8 cursor-pointer rounded-ui border border-border bg-surface p-0.5"
            aria-label={label}
          />
          {swatches ? null : label}
        </label>
      </div>
      {hint ? <p className="text-ui-sm text-muted">{hint}</p> : null}
    </div>
  )
}

/** The icon and name as a phone's home screen shows them. */
function IconPreview({ form }: { form: AppSettings }) {
  const { t } = useTranslation()
  const session = useSession()
  return (
    <div className="flex flex-col gap-2" aria-label={t('publish.iconPreview')} role="img">
      <span className="text-ui-sm font-strong">{t('publish.iconPreview')}</span>
      <div
        className="flex flex-col items-center gap-6 rounded-[28px] border-6 border-[#1c1a2b] px-4 pt-8 pb-10 shadow-2"
        style={{
          background: `linear-gradient(160deg, ${form.themeColor}, ${form.backgroundColor})`,
        }}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="grid size-[68px] place-items-center overflow-hidden rounded-[18px] shadow-2"
            style={{
              background: form.icon.kind === 'emoji' ? form.icon.background : form.backgroundColor,
            }}
            data-testid="publish-icon-preview"
          >
            {form.icon.kind === 'emoji' ? (
              <span className="text-[40px] leading-none">{form.icon.emoji}</span>
            ) : (
              <img
                src={session.assetUrl(form.icon.assetId)}
                alt=""
                className="size-full object-cover"
              />
            )}
          </div>
          <span className="max-w-[110px] truncate text-[12px] font-strong text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.5)]">
            {form.name || '…'}
          </span>
        </div>
        <div className="grid w-full grid-cols-4 gap-2.5 opacity-40" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholders
            <div key={i} className="aspect-square rounded-[10px] bg-white/70" />
          ))}
        </div>
      </div>
    </div>
  )
}

function SharePanel({
  url,
  name,
  onPrint,
}: {
  url: string | null
  name: string
  onPrint: () => void
}) {
  const { t } = useTranslation()
  if (!url) {
    return (
      <p className="grid h-40 place-items-center rounded-ui-lg border border-dashed border-border-strong bg-surface-2 px-6 text-center text-muted">
        {t('publish.notYet')}
      </p>
    )
  }
  return (
    <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
      <QrCode value={url} label={t('publish.qr')} className="w-full shadow-1" />
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-ui-lg font-strong">{name}</p>
        <div className="flex items-center gap-1.5 rounded-ui border border-border bg-surface-2 py-1 pr-1 pl-2.5">
          <input
            readOnly
            value={url}
            aria-label={t('publish.address')}
            data-testid="publish-url"
            className="min-w-0 flex-1 truncate bg-transparent font-mono text-ui-sm outline-none"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            size="sm"
            icon={<Copy size={14} />}
            onClick={async () => {
              await navigator.clipboard?.writeText(url).catch(() => {})
              toast.success(t('publish.copied'))
            }}
          >
            {t('publish.copy')}
          </Button>
        </div>
        <p className="text-ui-sm text-muted">{t('publish.shareHint')}</p>
        <div className="flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" data-testid="publish-open">
            <Button variant="primary" icon={<ExternalLink size={15} />} tabIndex={-1}>
              {t('publish.open')}
            </Button>
          </a>
          <Button icon={<Printer size={15} />} onClick={onPrint}>
            {t('publish.print')}
          </Button>
          <a href={`${url}install`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" icon={<HelpCircle size={15} />} tabIndex={-1}>
              {t('publish.installHelp')}
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}

type PublicationInfo = {
  published: boolean
  versions: {
    id: string
    number: number
    name: string
    createdAt: string
    author: string | null
    current: boolean
  }[]
}

function VersionsPanel({
  data,
  canPublish,
  onCurrent,
  onUnpublish,
}: {
  data: PublicationInfo
  canPublish: boolean
  onCurrent: (versionId: string, number: number) => void
  onUnpublish: () => void
}) {
  const { t, i18n } = useTranslation()
  const date = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  if (data.versions.length === 0) {
    return <p className="py-8 text-center text-muted">{t('publish.versionsEmpty')}</p>
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-ui border border-border">
        {data.versions.map((version) => (
          <li
            key={version.id}
            className="flex items-center gap-3 px-3 py-2.5"
            data-testid="publish-version"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-strong">
                {t('publish.version', { number: version.number })}
                <span className="truncate font-normal text-muted">· {version.name}</span>
                {version.current && data.published ? (
                  <Badge tone="success">{t('publish.current')}</Badge>
                ) : null}
              </p>
              <p className="text-ui-sm text-muted">
                {t('publish.versionBy', {
                  date: date(version.createdAt),
                  name: version.author ?? '—',
                })}
              </p>
            </div>
            {canPublish && !(version.current && data.published) ? (
              <Button
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={() => onCurrent(version.id, version.number)}
              >
                {t('publish.makeCurrent')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canPublish && data.published ? (
        <div className="flex justify-end">
          <Button variant="ghost" className="text-danger" onClick={onUnpublish}>
            {t('publish.unpublish')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
