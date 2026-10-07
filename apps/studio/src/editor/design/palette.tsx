import { CATEGORY_LABELS, paletteFor } from '@rublox/catalog'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '../../components/ui/tooltip.tsx'
import { cn } from '../../lib/cn.ts'
import { useOfferedType } from '../../lib/features.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { addComponentOfType } from '../actions.ts'
import { ComponentIcon } from '../component-icon.tsx'
import { useSession } from '../context.tsx'
import { endDrag, startDrag } from './dnd.ts'
import { touchDrag } from './touch-drag.ts'

/**
 * Components by category, with search (SPEC § 4.1). Drag one onto the canvas or the layers;
 * Enter or a double-click adds it after the selection.
 */
export function Palette({ screenId }: { screenId: string }) {
  const { t } = useTranslation()
  const session = useSession()
  const { mode, locale } = usePrefs()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase(locale)
  const offered = useOfferedType()
  const categories = paletteFor(mode)
    .map((entry) => ({
      ...entry,
      components: entry.components.filter((def) => {
        if (!offered(def.type)) return false
        if (!needle) return true
        const strings = def.strings[locale]
        return `${strings.label} ${strings.description} ${def.type}`
          .toLocaleLowerCase(locale)
          .includes(needle)
      }),
    }))
    .filter((entry) => entry.components.length > 0)

  return (
    <section aria-label={t('editor.design.palette')} className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-2 p-3">
        <h2 className="text-ui-sm font-strong text-muted uppercase tracking-wide junior:normal-case junior:tracking-normal junior:text-ui junior:text-text">
          {t('editor.design.palette')}
        </h2>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('editor.design.paletteSearch')}
            aria-label={t('editor.design.paletteSearch')}
            className="h-control-sm w-full rounded-ui border border-border bg-surface pr-2 pl-8 text-ui-sm outline-none focus:border-primary junior:h-control junior:text-ui"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {categories.length === 0 ? (
          <p className="py-4 text-center text-ui-sm text-muted">{t('editor.design.noComponent')}</p>
        ) : null}
        {categories.map(({ category, components }) => (
          <div key={category} className="mb-3">
            <h3 className="mb-1.5 text-ui-sm text-muted">{CATEGORY_LABELS[locale][category]}</h3>
            <ul className={cn('grid gap-1.5', mode === 'junior' ? 'grid-cols-2' : 'grid-cols-1')}>
              {components.map((def) => {
                const strings = def.strings[locale]
                return (
                  <li key={def.type}>
                    <Tooltip content={strings.description} side="right">
                      <button
                        type="button"
                        draggable
                        data-testid={`palette-${def.type}`}
                        aria-label={strings.label}
                        aria-description={t('editor.design.paletteHint')}
                        onDragStart={(event) => startDrag(event, { kind: 'new', type: def.type })}
                        onDragEnd={endDrag}
                        onPointerDown={touchDrag(
                          () => ({ kind: 'new', type: def.type }),
                          strings.label,
                        )}
                        onDoubleClick={() =>
                          addComponentOfType(session, screenId, def.type, locale)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            addComponentOfType(session, screenId, def.type, locale)
                          }
                        }}
                        className={cn(
                          'group flex w-full cursor-grab items-center [-webkit-touch-callout:none] select-none gap-2 rounded-ui border border-border bg-surface text-left transition-[border,box-shadow,transform] hover:border-primary/60 hover:shadow-1 active:cursor-grabbing',
                          mode === 'junior'
                            ? 'flex-col justify-center gap-1.5 px-2 py-3 text-center'
                            : 'h-control-sm px-2',
                        )}
                      >
                        <span
                          className={cn(
                            'grid shrink-0 place-items-center rounded-[calc(var(--radius)-3px)] bg-mint-soft text-mint',
                            mode === 'junior' ? 'size-10' : 'size-5',
                          )}
                        >
                          <ComponentIcon type={def.type} size={mode === 'junior' ? 22 : 13} />
                        </span>
                        <span className="truncate font-strong text-ui-sm junior:text-ui">
                          {strings.label}
                        </span>
                      </button>
                    </Tooltip>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
