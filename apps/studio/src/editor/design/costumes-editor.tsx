import { addAsset } from '@rublox/schema'
import { ChevronLeft, ImagePlus, Plus, X } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { cn } from '../../lib/cn.ts'
import { errorMessage } from '../../lib/errors.ts'
import { MAX_IMAGE_BYTES } from '../../storage/assets.ts'
import { useAssetUrl, useDoc, useSession } from '../context.tsx'
import type { EditorProps } from './editors.tsx'

/** Emoji that make good costumes, offered as one-click ideas. */
const IDEAS = [
  '🐱',
  '🐶',
  '🐸',
  '🐵',
  '🦊',
  '🐰',
  '🐧',
  '🦄',
  '🐝',
  '🐟',
  '🦖',
  '👾',
  '🤖',
  '👻',
  '🚀',
  '🛸',
  '🚗',
  '⚽',
  '🏀',
  '🍎',
  '🍓',
  '🍊',
  '🍌',
  '🍉',
  '⭐',
  '❤️',
  '💎',
  '🪙',
  '🧺',
  '🔥',
  '💣',
  '🧱',
  '☁️',
  '☀️',
  '🌳',
  '🎈',
]

/**
 * The costumes of a sprite (an `images` property): an ordered list of emoji, letters or
 * pictures of the project. The first one is shown at the start; blocks switch between them.
 */
export function CostumesEditor({ id, value, onChange }: EditorProps<string[]>) {
  const { t } = useTranslation()
  const session = useSession()
  const assetUrl = useAssetUrl()
  const doc = useDoc()
  const list = Array.isArray(value) ? value : []
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputId = useId()
  const emojiId = useId()
  const images = Object.entries(doc.assets).filter(([, asset]) => asset.kind === 'image')

  const add = (costume: string) => {
    const trimmed = costume.trim()
    if (!trimmed) return
    onChange([...list, trimmed])
    setDraft('')
    setOpen(false)
  }
  const remove = (index: number) => onChange(list.filter((_, i) => i !== index))
  const earlier = (index: number) => {
    if (index <= 0) return
    const next = [...list]
    ;[next[index - 1], next[index]] = [next[index] as string, next[index - 1] as string]
    onChange(next)
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/'))
      return void toast.error(t('editor.inspector.image.notImage'))
    if (file.size > MAX_IMAGE_BYTES) return void toast.error(t('editor.inspector.image.tooBig'))
    try {
      const stored = await session.storeAsset(file, 'image')
      const existing = Object.entries(doc.assets).find(([, a]) => a.sha256 === stored.sha256)
      add(existing ? existing[0] : addAsset(session.ydoc, stored))
    } catch (error) {
      toast.error(errorMessage(t, error))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {list.length ? (
        <ol id={id} className="flex flex-wrap gap-1.5" aria-label={t('game.costumes.title')}>
          {list.map((costume, index) => {
            const src = assetUrl(costume)
            const n = index + 1
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: costumes may repeat; the position is the identity
              <li key={`${index}-${costume}`} className="group relative">
                <span
                  className="grid size-12 place-items-center overflow-hidden rounded-ui border border-border bg-surface-2 text-[28px] leading-none junior:size-14"
                  title={t('game.costumes.costume', { n })}
                >
                  {src ? (
                    <img
                      src={src}
                      alt={doc.assets[costume]?.name ?? ''}
                      className="size-full object-contain"
                    />
                  ) : (
                    costume
                  )}
                </span>
                <span className="pointer-events-none absolute bottom-0.5 left-1 text-[10px] font-strong text-muted">
                  {n}
                </span>
                <span className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {index > 0 ? (
                    <button
                      type="button"
                      aria-label={t('game.costumes.moveEarlier', { n })}
                      title={t('game.costumes.moveEarlier', { n })}
                      onClick={() => earlier(index)}
                      className="grid size-5 place-items-center rounded-full border border-border bg-surface text-muted shadow-1 hover:text-text"
                    >
                      <ChevronLeft size={12} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={t('game.costumes.remove', { n })}
                    title={t('game.costumes.remove', { n })}
                    onClick={() => remove(index)}
                    className="grid size-5 place-items-center rounded-full border border-border bg-surface text-muted shadow-1 hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-ui-sm text-muted">{t('game.costumes.empty')}</p>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button size="sm" className="w-full">
            <Plus size={15} />
            {t('game.costumes.add')}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="start"
            className="z-50 w-72 rounded-ui-lg border border-border bg-surface p-3 shadow-2 rx-anim-in"
          >
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                add(draft)
              }}
            >
              <label
                htmlFor={emojiId}
                className="flex min-w-0 flex-1 flex-col gap-1 text-ui-sm text-muted"
              >
                {t('game.costumes.emoji')}
                <Input
                  id={emojiId}
                  value={draft}
                  maxLength={16}
                  placeholder={t('game.costumes.emojiPlaceholder')}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </label>
              <Button type="submit" variant="primary" size="sm" disabled={!draft.trim()}>
                {t('game.costumes.addEmoji')}
              </Button>
            </form>
            <p className="mt-3 mb-1.5 text-ui-sm text-muted">{t('game.costumes.suggestions')}</p>
            <div className="grid grid-cols-9 gap-0.5">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  aria-label={idea}
                  onClick={() => add(idea)}
                  className="grid aspect-square place-items-center rounded-md text-[20px] hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  {idea}
                </button>
              ))}
            </div>
            {images.length ? (
              <>
                <p className="mt-3 mb-1.5 text-ui-sm text-muted">{t('game.costumes.images')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {images.map(([assetId, asset]) => (
                    <button
                      key={assetId}
                      type="button"
                      title={asset.name}
                      aria-label={asset.name}
                      onClick={() => add(assetId)}
                      className="size-10 overflow-hidden rounded-md border-2 border-border hover:border-primary"
                    >
                      <img src={assetUrl(assetId)} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <label
              htmlFor={inputId}
              className={cn(
                'mt-3 flex h-control cursor-pointer items-center justify-center gap-2 rounded-ui border border-dashed border-border-strong text-ui-sm font-strong text-muted hover:border-primary hover:text-primary-text',
              )}
            >
              <ImagePlus size={15} />
              {t('game.costumes.upload')}
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void upload(event.target.files?.[0])}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
