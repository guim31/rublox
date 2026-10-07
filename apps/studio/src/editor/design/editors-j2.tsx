import { ICON_NAMES, type PropDef } from '@rublox/catalog'
import { AppIcon } from '@rublox/runtime'
import { type AssetKind, addAsset } from '@rublox/schema'
import {
  ArrowDown,
  ArrowUp,
  FileAudio,
  FileVideo,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Popover } from 'radix-ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input, Select } from '../../components/ui/input.tsx'
import { cn } from '../../lib/cn.ts'
import { errorMessage } from '../../lib/errors.ts'
import { ASSET_ACCEPT, ASSET_MAX_BYTES, assetKindOf } from '../../storage/asset-kinds.ts'
import { useDoc, useSession } from '../context.tsx'
import type { EditorProps } from './editors.tsx'

const TEXTAREA =
  'min-h-control w-full resize-y rounded-ui border border-border bg-surface px-2.5 py-1.5 text-ui outline-none hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/20'

/** A list of texts (one per line), or of objects edited field by field (data lists). */
export function ListEditor({ id, def, value, onChange }: EditorProps<unknown[]>) {
  const items = Array.isArray(value) ? value : []
  if (def.itemFields) return <ItemsEditor id={id} def={def} items={items} onChange={onChange} />
  return <LinesEditor id={id} items={items.map(String)} onChange={onChange} />
}

function LinesEditor({
  id,
  items,
  onChange,
}: {
  id: string
  items: string[]
  onChange: (value: unknown[]) => void
}) {
  const { t } = useTranslation('catalog')
  const [draft, setDraft] = useState(items.join('\n'))
  const [focused, setFocused] = useState(false)
  const text = focused ? draft : items.join('\n')
  return (
    <div className="flex flex-col gap-1">
      <textarea
        id={id}
        value={text}
        rows={Math.min(8, Math.max(3, items.length + 1))}
        onFocus={() => {
          setDraft(items.join('\n'))
          setFocused(true)
        }}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          setDraft(event.target.value)
          onChange(
            event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line !== ''),
          )
        }}
        className={TEXTAREA}
      />
      <p className="text-[11px] text-muted">{t('studio.list.linesHint')}</p>
    </div>
  )
}

function ItemsEditor({
  id,
  def,
  items,
  onChange,
}: {
  id: string
  def: PropDef
  items: unknown[]
  onChange: (value: unknown[]) => void
}) {
  const { t } = useTranslation('catalog')
  const fields = Object.entries(def.itemFields ?? {})
  const rows = items.map((item) =>
    item && typeof item === 'object' ? (item as Record<string, string>) : {},
  )
  const update = (index: number, key: string, text: string) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: text } : row)))
  const move = (index: number, delta: number) => {
    const next = [...rows]
    const [row] = next.splice(index, 1)
    if (row) next.splice(index + delta, 0, row)
    onChange(next)
  }
  return (
    <div id={id} className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <fieldset
          // biome-ignore lint/suspicious/noArrayIndexKey: items have no identity of their own
          key={index}
          className="flex flex-col gap-1.5 rounded-ui border border-border bg-surface-2/50 p-2"
        >
          <legend className="sr-only">{t('studio.list.item', { n: index + 1 })}</legend>
          <div className="flex items-center gap-1">
            <span className="flex-1 text-ui-sm font-strong text-muted">
              {t('studio.list.item', { n: index + 1 })}
            </span>
            <SmallButton
              label={t('studio.list.up')}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={13} />
            </SmallButton>
            <SmallButton
              label={t('studio.list.down')}
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={13} />
            </SmallButton>
            <SmallButton
              label={t('studio.list.remove')}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              <Trash2 size={13} />
            </SmallButton>
          </div>
          {fields.map(([key, kind]) => (
            <div key={key} className="flex items-center gap-2 text-ui-sm">
              <span className="w-20 shrink-0 text-muted" aria-hidden="true">
                {fieldLabel(t, key)}
              </span>
              {kind === 'asset' ? (
                <AssetSelect
                  label={`${fieldLabel(t, key)} (${index + 1})`}
                  value={row[key] ?? ''}
                  kind="image"
                  onChange={(next) => update(index, key, next)}
                />
              ) : (
                <Input
                  aria-label={`${fieldLabel(t, key)} (${index + 1})`}
                  value={row[key] ?? ''}
                  className="h-control-sm"
                  onChange={(event) => update(index, key, event.target.value)}
                />
              )}
            </div>
          ))}
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, Object.fromEntries(fields.map(([key]) => [key, '']))])}
        className="flex h-control-sm items-center justify-center gap-1.5 rounded-ui border border-dashed border-border-strong text-ui-sm font-strong text-muted hover:border-primary hover:text-primary-text"
      >
        <Plus size={14} />
        {t('studio.list.add')}
      </button>
    </div>
  )
}

function fieldLabel(t: (key: never) => string, key: string): string {
  const known = ['title', 'subtitle', 'image', 'button'] as const
  return (known as readonly string[]).includes(key) ? t(`studio.list.fields.${key}` as never) : key
}

function SmallButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-6 place-items-center rounded text-muted hover:bg-surface-3 hover:text-text disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/** An image of the project for a list item, or none. */
function AssetSelect({
  label,
  value,
  kind,
  onChange,
}: {
  label: string
  value: string
  kind: AssetKind
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('catalog')
  const doc = useDoc()
  const assets = Object.entries(doc.assets).filter(([, asset]) => asset.kind === kind)
  return (
    <Select
      aria-label={label}
      value={doc.assets[value] ? value : ''}
      onChange={(event) => onChange(event.target.value)}
      className="h-control-sm text-ui-sm"
    >
      <option value="">{t('studio.list.noImage')}</option>
      {assets.map(([id, asset]) => (
        <option key={id} value={id}>
          {asset.name}
        </option>
      ))}
    </Select>
  )
}

export function DateEditor({ id, value, onChange }: EditorProps<string>) {
  return (
    <Input
      id={id}
      type="date"
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function TimeEditor({ id, value, onChange }: EditorProps<string>) {
  return (
    <Input
      id={id}
      type="time"
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

/** An icon from `ICON_NAMES`, chosen in a searchable grid (SPEC § 4.1). */
export function IconEditor({ id, value, onChange }: EditorProps<string>) {
  const { t } = useTranslation('catalog')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const current = String(value ?? '')
  const needle = query.trim().toLowerCase()
  const names = ICON_NAMES.filter((name) => !needle || name.includes(needle))
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-control w-full items-center gap-2 rounded-ui border border-border bg-surface px-2 text-left hover:border-border-strong"
        >
          {current ? (
            <AppIcon name={current} size={18} />
          ) : (
            <Sparkles size={16} className="text-muted" />
          )}
          <span className={cn('truncate', !current && 'text-muted')}>
            {current || t('studio.icon.none')}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 flex w-72 flex-col gap-2 rounded-ui-lg border border-border bg-surface p-3 shadow-2 rx-anim-in"
        >
          <Input
            type="search"
            autoFocus
            value={query}
            placeholder={t('studio.icon.search')}
            aria-label={t('studio.icon.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div
            role="listbox"
            aria-label={t('studio.icon.choose')}
            className="grid max-h-60 grid-cols-7 gap-1 overflow-y-auto"
          >
            <button
              type="button"
              role="option"
              aria-selected={!current}
              title={t('studio.icon.none')}
              aria-label={t('studio.icon.none')}
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className="grid aspect-square place-items-center rounded-md text-muted hover:bg-surface-2"
            >
              <X size={16} />
            </button>
            {names.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={name === current}
                title={name}
                aria-label={name}
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                }}
                className={cn(
                  'grid aspect-square place-items-center rounded-md hover:bg-surface-2',
                  name === current && 'bg-primary-soft text-primary-text',
                )}
              >
                <AppIcon name={name} size={18} />
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** A sound, a video or a Lottie animation of the project, or an https: address. */
export function MediaAssetEditor({ id, value, onChange, def }: EditorProps<string>) {
  const { t } = useTranslation('catalog')
  const { t: tStudio } = useTranslation()
  const session = useSession()
  const doc = useDoc()
  const inputId = useId()
  const kind = (def.assetKind ?? 'sound') as Exclude<AssetKind, 'font' | 'file'>
  const current = String(value ?? '')
  const assets = Object.entries(doc.assets).filter(([, asset]) => asset.kind === kind)
  const [url, setUrl] = useState(current.startsWith('https://') ? current : '')

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (assetKindOf(file) !== kind) return void toast.error(t(`studio.asset.wrongKind.${kind}`))
    if (file.size > ASSET_MAX_BYTES[kind as keyof typeof ASSET_MAX_BYTES])
      return void toast.error(t('studio.asset.tooBig'))
    let stored: Awaited<ReturnType<typeof session.storeAsset>>
    try {
      // Through the session: this browser in guest mode, the server once signed in (J1).
      stored = await session.storeAsset(file, kind)
    } catch (error) {
      return void toast.error(errorMessage(tStudio, error))
    }
    const existing = Object.entries(doc.assets).find(([, a]) => a.sha256 === stored.sha256)
    onChange(existing ? existing[0] : addAsset(session.ydoc, stored))
  }

  const icon = kind === 'video' ? <FileVideo size={15} /> : <FileAudio size={15} />
  return (
    <div className="flex flex-col gap-2">
      <Select
        id={id}
        value={doc.assets[current] ? current : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{t('studio.asset.none')}</option>
        {assets.map(([assetId, asset]) => (
          <option key={assetId} value={assetId}>
            {asset.name}
          </option>
        ))}
      </Select>
      {doc.assets[current] && kind === 'sound' ? (
        // biome-ignore lint/a11y/useMediaCaption: a sound chosen by the user, heard to check it
        <audio src={session.assetUrl(current)} controls className="h-9 w-full" />
      ) : null}
      <label
        htmlFor={inputId}
        className="flex h-control cursor-pointer items-center justify-center gap-2 rounded-ui border border-dashed border-border-strong text-ui-sm font-strong text-muted hover:border-primary hover:text-primary-text"
      >
        {assets.length ? <Upload size={15} /> : icon}
        {t(`studio.asset.upload.${kind}`)}
      </label>
      <input
        id={inputId}
        type="file"
        accept={ASSET_ACCEPT[kind as keyof typeof ASSET_ACCEPT]}
        className="sr-only"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      {kind !== 'lottie' ? (
        <Input
          type="url"
          placeholder={t('studio.asset.url')}
          aria-label={t('studio.asset.url')}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value)
            if (/^https:\/\/\S+$/i.test(event.target.value)) onChange(event.target.value)
          }}
        />
      ) : null}
    </div>
  )
}
