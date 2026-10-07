import {
  COLOR_TOKENS,
  enumLabel,
  type PropDef,
  type SizeValue,
  type SpacingValue,
} from '@rublox/catalog'
import { type AssetKind, addAsset } from '@rublox/schema'
import { ImagePlus, Link2, Trash2, Upload } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input, Select } from '../../components/ui/input.tsx'
import { Segmented } from '../../components/ui/segmented.tsx'
import { Switch } from '../../components/ui/switch.tsx'
import { cn } from '../../lib/cn.ts'
import { errorMessage } from '../../lib/errors.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { MAX_IMAGE_BYTES } from '../../storage/assets.ts'
import { useAssetUrl, useDoc, useSession } from '../context.tsx'
import { BindingEditor } from '../data/binding-editor.tsx'
import { CostumesEditor } from './costumes-editor.tsx'
import { DateEditor, IconEditor, ListEditor, MediaAssetEditor, TimeEditor } from './editors-j2.tsx'

export type EditorProps<T = unknown> = {
  id: string
  type: string
  prop: string
  def: PropDef
  value: T
  onChange: (value: T | undefined) => void
}

/** A text field that commits as you type but keeps its own state while focused. */
function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])
  return {
    draft,
    setDraft,
    bind: {
      onFocus: () => {
        focused.current = true
      },
      onBlur: () => {
        focused.current = false
        setDraft(value)
      },
    },
  }
}

export function StringEditor({ id, def, value, onChange }: EditorProps<string>) {
  const { draft, setDraft, bind } = useDraft(String(value ?? ''))
  const change = (next: string) => {
    setDraft(next)
    onChange(next)
  }
  if (def.multiline) {
    return (
      <textarea
        id={id}
        value={draft}
        rows={2}
        {...bind}
        onChange={(event) => change(event.target.value)}
        className="min-h-control w-full resize-y rounded-ui border border-border bg-surface px-2.5 py-1.5 text-ui outline-none hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/20"
      />
    )
  }
  return <Input id={id} value={draft} {...bind} onChange={(event) => change(event.target.value)} />
}

export function NumberEditor({ id, def, value, onChange }: EditorProps<number>) {
  const { draft, setDraft, bind } = useDraft(String(value ?? ''))
  return (
    <div className="flex items-center gap-2">
      {def.min !== undefined && def.max !== undefined && def.max <= 100 ? (
        <input
          type="range"
          aria-hidden="true"
          tabIndex={-1}
          min={def.min}
          max={def.max}
          step={def.step ?? 1}
          value={Number(value) || 0}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 accent-primary"
        />
      ) : null}
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={def.min}
        max={def.max}
        step={def.step ?? 1}
        value={draft}
        {...bind}
        onChange={(event) => {
          setDraft(event.target.value)
          const n = def.coerce(event.target.value)
          if (n !== undefined && event.target.value !== '') onChange(n as number)
        }}
        className={cn(def.max !== undefined && def.max <= 100 ? 'w-20' : '')}
      />
    </div>
  )
}

export function BooleanEditor({ id, value, onChange }: EditorProps<boolean>) {
  return <Switch id={id} checked={value === true} onChange={(checked) => onChange(checked)} />
}

export function EnumEditor({ id, type, prop, def, value, onChange }: EditorProps<string>) {
  const locale = usePrefs((s) => s.locale)
  const values = def.values ?? []
  const options = values.map((v) => ({ value: v, label: enumLabel(type, prop, v, locale) }))
  if (values.length <= 3 && options.every((o) => o.label.length <= 12)) {
    return (
      <Segmented
        label={prop}
        value={String(value)}
        onChange={(next) => onChange(next)}
        options={options}
        size="sm"
        className="w-full [&>*]:flex-1"
      />
    )
  }
  return (
    <Select id={id} value={String(value)} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  )
}

/** Colors: none, the app theme's colors, or a custom one (SPEC § 4.1). */
export function ColorEditor({ id, value, onChange }: EditorProps<string>) {
  const { t } = useTranslation()
  const theme = useDoc().settings.theme
  const current = String(value ?? '')
  const swatch = (color: string) => {
    if (!color) return 'transparent'
    if (color.startsWith('@')) {
      const token = color.slice(1)
      const fixed: Record<string, string> = {
        primary: theme.primary,
        secondary: theme.secondary,
        background: theme.background,
        surface: '#f4f3f9',
        text: '#1b1a24',
        muted: '#615e74',
        border: '#d4d1e2',
        danger: '#d23c2c',
        success: '#1c8a4f',
      }
      return fixed[token] ?? '#888'
    }
    return color
  }
  const label = !current
    ? t('editor.inspector.color.none')
    : current.startsWith('@')
      ? t(`editor.inspector.tokens.${current.slice(1) as (typeof COLOR_TOKENS)[number]}`)
      : current
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-control w-full items-center gap-2 rounded-ui border border-border bg-surface px-2 text-left hover:border-border-strong"
        >
          <Swatch color={swatch(current)} />
          <span className="truncate">{label}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 w-64 rounded-ui-lg border border-border bg-surface p-3 shadow-2 rx-anim-in"
        >
          <p className="mb-2 text-ui-sm text-muted">{t('editor.inspector.color.theme')}</p>
          <div className="grid grid-cols-5 gap-1.5">
            <SwatchButton
              label={t('editor.inspector.color.none')}
              color="transparent"
              active={!current}
              onClick={() => onChange('')}
            />
            {COLOR_TOKENS.map((token) => (
              <SwatchButton
                key={token}
                label={t(`editor.inspector.tokens.${token}`)}
                color={swatch(`@${token}`)}
                active={current === `@${token}`}
                onClick={() => onChange(`@${token}`)}
              />
            ))}
          </div>
          <p className="mt-3 mb-2 text-ui-sm text-muted">{t('editor.inspector.color.custom')}</p>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={t('editor.inspector.color.custom')}
              value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#5b4bff'}
              onChange={(event) => onChange(event.target.value)}
              className="h-control w-12 cursor-pointer rounded-ui border border-border bg-surface p-1"
            />
            <Input
              aria-label={t('editor.inspector.color.hex')}
              value={current.startsWith('#') ? current : ''}
              placeholder="#5b4bff"
              onChange={(event) => {
                if (/^#[0-9a-f]{6}$/i.test(event.target.value))
                  onChange(event.target.value.toLowerCase())
              }}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="size-5 shrink-0 rounded-md border border-black/10"
      style={{
        background:
          color === 'transparent'
            ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px'
            : color,
      }}
    />
  )
}

function SwatchButton({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid aspect-square place-items-center rounded-lg border-2 p-0.5',
        active ? 'border-primary' : 'border-transparent hover:border-border-strong',
      )}
    >
      <span
        className="size-full rounded-md border border-black/10"
        style={{
          background:
            color === 'transparent'
              ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px'
              : color,
        }}
      />
    </button>
  )
}

/** Dimensions: auto, fill, pixels or percent (SPEC § 4.1). */
export function SizeEditor({ id, value, onChange }: EditorProps<SizeValue>) {
  const { t } = useTranslation()
  const kind =
    value === 'auto' || value === 'fill' ? value : typeof value === 'string' ? 'percent' : 'px'
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.endsWith('%')
        ? Number.parseFloat(value)
        : ''
  const { draft, setDraft, bind } = useDraft(String(amount))
  return (
    <div className="flex flex-col gap-1.5">
      <Segmented
        label={id}
        size="sm"
        value={kind}
        className="w-full [&>*]:flex-1"
        onChange={(next) => {
          if (next === 'auto' || next === 'fill') onChange(next)
          else if (next === 'px') onChange(typeof value === 'number' ? value : 120)
          else onChange('50%')
        }}
        options={[
          { value: 'auto', label: t('editor.inspector.size.auto') },
          { value: 'fill', label: t('editor.inspector.size.fill') },
          { value: 'px', label: t('editor.inspector.size.px') },
          { value: 'percent', label: t('editor.inspector.size.percent') },
        ]}
      />
      {kind === 'px' || kind === 'percent' ? (
        <Input
          id={id}
          type="number"
          min={0}
          value={draft}
          {...bind}
          onChange={(event) => {
            setDraft(event.target.value)
            const n = Number(event.target.value)
            if (event.target.value !== '' && Number.isFinite(n) && n >= 0)
              onChange(kind === 'px' ? n : (`${n}%` as SizeValue))
          }}
        />
      ) : null}
    </div>
  )
}

/** Margins and paddings: one value, or one per side in a small box (SPEC § 4.1). */
export function SpacingEditor({ id, value, onChange }: EditorProps<SpacingValue>) {
  const { t } = useTranslation()
  const sides = Array.isArray(value) ? value : [value ?? 0, value ?? 0, value ?? 0, value ?? 0]
  const perSide = Array.isArray(value)
  const set = (index: number, n: number) => {
    const next = [...sides] as [number, number, number, number]
    next[index] = n
    onChange(next)
  }
  const labels = [
    t('editor.inspector.spacing.top'),
    t('editor.inspector.spacing.right'),
    t('editor.inspector.spacing.bottom'),
    t('editor.inspector.spacing.left'),
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <Segmented
        label={id}
        size="sm"
        className="w-full [&>*]:flex-1"
        value={perSide ? 'sides' : 'all'}
        onChange={(mode) =>
          onChange(
            mode === 'all' ? (sides[0] ?? 0) : ([...sides] as [number, number, number, number]),
          )
        }
        options={[
          { value: 'all', label: t('editor.inspector.spacing.all') },
          { value: 'sides', label: t('editor.inspector.spacing.sides') },
        ]}
      />
      {perSide ? (
        <div className="grid grid-cols-3 grid-rows-3 items-center gap-1 rounded-ui border border-dashed border-border-strong p-1.5">
          {[
            { index: 0, area: 'col-start-2 row-start-1' },
            { index: 3, area: 'col-start-1 row-start-2' },
            { index: 1, area: 'col-start-3 row-start-2' },
            { index: 2, area: 'col-start-2 row-start-3' },
          ].map(({ index, area }) => (
            <input
              key={index}
              type="number"
              min={0}
              aria-label={labels[index]}
              title={labels[index]}
              value={sides[index] ?? 0}
              onChange={(event) => set(index, Math.max(0, Number(event.target.value) || 0))}
              className={cn(
                'h-7 w-full rounded border border-border bg-surface text-center text-ui-sm outline-none focus:border-primary',
                area,
              )}
            />
          ))}
          <span className="col-start-2 row-start-2 h-6 rounded bg-surface-2" aria-hidden="true" />
        </div>
      ) : (
        <Input
          id={id}
          type="number"
          min={0}
          value={sides[0] ?? 0}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        />
      )}
    </div>
  )
}

/** An image of the project (stored in this browser in guest mode) or an https: address. */
export function AssetEditor(props: EditorProps<string>) {
  if ((props.def.assetKind ?? 'image') !== 'image') return <MediaAssetEditor {...props} />
  return <ImageAssetEditor {...props} />
}

function ImageAssetEditor({ id, value, onChange, def }: EditorProps<string>) {
  const { t } = useTranslation()
  const session = useSession()
  const assetUrl = useAssetUrl()
  const doc = useDoc()
  const inputId = useId()
  const current = String(value ?? '')
  const asset = doc.assets[current]
  const images = Object.entries(doc.assets).filter(([, a]) => a.kind === (def.assetKind ?? 'image'))
  const [url, setUrl] = useState(current.startsWith('https://') ? current : '')

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/'))
      return void toast.error(t('editor.inspector.image.notImage'))
    if (file.size > MAX_IMAGE_BYTES) return void toast.error(t('editor.inspector.image.tooBig'))
    let stored: Awaited<ReturnType<typeof session.storeAsset>>
    try {
      stored = await session.storeAsset(file, 'image' as AssetKind)
    } catch (error) {
      return void toast.error(errorMessage(t, error))
    }
    const existing = Object.entries(doc.assets).find(([, a]) => a.sha256 === stored.sha256)
    onChange(existing ? existing[0] : addAsset(session.ydoc, stored))
  }

  return (
    <div className="flex flex-col gap-2">
      {current && assetUrl(current) ? (
        <div className="relative overflow-hidden rounded-ui border border-border bg-surface-2">
          <img
            src={assetUrl(current)}
            alt={asset?.name ?? ''}
            className="h-24 w-full object-contain"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={t('editor.inspector.image.remove')}
            title={t('editor.inspector.image.remove')}
            className="absolute top-1 right-1 grid size-7 place-items-center rounded-md bg-surface/90 text-muted shadow-1 hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
      {images.length > 0 ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="listbox"
          aria-label={t('editor.inspector.image.choose')}
        >
          {images.map(([assetId, a]) => (
            <button
              key={assetId}
              type="button"
              role="option"
              aria-selected={assetId === current}
              title={a.name}
              onClick={() => onChange(assetId)}
              className={cn(
                'size-12 overflow-hidden rounded-md border-2',
                assetId === current ? 'border-primary' : 'border-border hover:border-border-strong',
              )}
            >
              <img src={assetUrl(assetId)} alt={a.name} className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      <label
        htmlFor={inputId}
        className="flex h-control cursor-pointer items-center justify-center gap-2 rounded-ui border border-dashed border-border-strong text-ui-sm font-strong text-muted hover:border-primary hover:text-primary-text"
      >
        {images.length ? <Upload size={15} /> : <ImagePlus size={15} />}
        {t('editor.inspector.image.upload')}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <div className="relative">
        <Link2
          size={14}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
        />
        <Input
          id={id}
          type="url"
          placeholder={t('editor.inspector.image.url')}
          value={url}
          className="pl-8"
          onChange={(event) => {
            setUrl(event.target.value)
            if (/^https:\/\/\S+$/i.test(event.target.value)) onChange(event.target.value)
          }}
        />
      </div>
    </div>
  )
}

export const EDITORS: Record<PropDef['kind'], (props: EditorProps<never>) => React.ReactNode> = {
  string: StringEditor as never,
  number: NumberEditor as never,
  boolean: BooleanEditor as never,
  enum: EnumEditor as never,
  color: ColorEditor as never,
  size: SizeEditor as never,
  spacing: SpacingEditor as never,
  asset: AssetEditor as never,
  icon: IconEditor as never,
  list: ListEditor as never,
  date: DateEditor as never,
  time: TimeEditor as never,
  any: StringEditor as never,
  images: CostumesEditor as never,
  binding: BindingEditor as never,
}
