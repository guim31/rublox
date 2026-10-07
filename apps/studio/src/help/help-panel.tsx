import { messages } from '@rublox/i18n'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpen,
  CircleHelp,
  Compass,
  GraduationCap,
  Search,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '../components/ui/button.tsx'
import { Segmented } from '../components/ui/segmented.tsx'
import { ComponentIcon } from '../editor/component-icon.tsx'
import { startTour } from '../learn/tour.tsx'
import { cn } from '../lib/cn.ts'
import { useOfferedType } from '../lib/features.ts'
import { usePrefs } from '../lib/prefs.ts'
import { allBlockSheets, blockSheet, categoryColor, componentSheets, type Sheet } from './sheets.ts'
import { type HelpTab, openHelp, useHelp } from './store.ts'

/** The "Help" button of the editor's top bar. */
export function HelpButton() {
  const { t } = useTranslation()
  const open = useHelp((s) => s.open)
  return (
    <IconButton
      label={t('help.open')}
      active={open}
      onClick={() => (open ? useHelp.setState({ open: false }) : openHelp())}
      data-tour="help"
      data-testid="help-button"
    >
      <CircleHelp size={18} />
    </IconButton>
  )
}

/** A block drawn as a coloured pill, the way it looks in the toolbox. */
function BlockPill({ sheet, large }: { sheet: Sheet; large?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block max-w-full truncate rounded-[7px] font-strong text-white',
        large ? 'px-2.5 py-1.5 text-ui' : 'px-2 py-0.5 text-ui-sm',
      )}
      // Darkened a little: small white text needs a 4.5:1 contrast.
      style={{ background: `color-mix(in srgb, ${categoryColor(sheet.category)} 78%, #000)` }}
    >
      {sheet.title}
    </span>
  )
}

/**
 * The help panel (SPEC § 4.10): a sheet for every block and component, with an example, and a
 * glossary. It slides over the right side of the editor without hiding the top bar.
 */
export function HelpPanel() {
  const { t } = useTranslation()
  const { open, tab, topic, query } = useHelp()
  const { locale, mode, sounds, set } = usePrefs()
  const search = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLocaleLowerCase(locale)

  useEffect(() => {
    if (open && !topic) search.current?.focus()
  }, [open, topic])

  const blocks = useMemo(() => allBlockSheets(locale), [locale])
  const offered = useOfferedType()
  const components = componentSheets(locale).filter((sheet) => offered(sheet.type))
  const glossary = Object.entries(messages[locale].studio.glossary)
  const keys = messages[locale].studio.help.keys

  if (!open) return null
  const close = () => useHelp.setState({ open: false })
  const match = (...texts: (string | undefined)[]) =>
    !needle || texts.some((text) => text?.toLocaleLowerCase(locale).includes(needle))

  const sheet = topic?.kind === 'block' ? blockSheet(topic.id, locale) : undefined

  return (
    <aside
      aria-label={t('help.title')}
      className="rx-anim-in fixed top-14 right-0 bottom-0 z-40 flex w-[min(100vw,380px)] flex-col border-l border-border bg-surface shadow-3 junior:top-16 junior:w-[min(100vw,420px)]"
      data-testid="help-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <BookOpen size={18} className="text-primary-text" />
        <h2 className="flex-1 font-strong text-ui-lg">{t('help.title')}</h2>
        <IconButton size="sm" label={t('help.close')} onClick={close}>
          <X size={16} />
        </IconButton>
      </header>
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
          />
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(event) => useHelp.setState({ query: event.target.value, topic: null })}
            placeholder={t('help.search')}
            aria-label={t('help.search')}
            className="h-control-sm w-full rounded-ui border border-border bg-surface pr-2 pl-8 text-ui-sm outline-none focus:border-primary junior:h-control junior:text-ui"
          />
        </div>
        <Segmented
          label={t('help.title')}
          size="sm"
          value={tab}
          onChange={(value: HelpTab) => useHelp.setState({ tab: value, topic: null })}
          className="w-full [&>*]:flex-1"
          options={[
            { value: 'blocks', label: t('help.tabs.blocks') },
            { value: 'components', label: t('help.tabs.components') },
            { value: 'glossary', label: t('help.tabs.glossary') },
            { value: 'keys', label: t('help.tabs.keys') },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {sheet ? (
          <article className="flex flex-col gap-3 rx-anim-in" data-testid="help-sheet">
            <button
              type="button"
              onClick={() => useHelp.setState({ topic: null })}
              className="inline-flex items-center gap-1 self-start rounded text-ui-sm font-strong text-primary-text hover:underline"
            >
              <ArrowLeft size={14} />
              {t('help.back')}
            </button>
            <BlockPill sheet={sheet} large />
            <p className="text-ui-sm text-muted">
              {t('help.category', { name: sheet.categoryLabel })}
            </p>
            <p className="leading-relaxed">{sheet.text}</p>
            {sheet.example ? (
              <div className="rounded-ui border border-border bg-surface-2 p-3">
                <h3 className="mb-1 text-ui-sm font-strong text-muted">{t('help.example')}</h3>
                <p className="font-mono text-[12.5px] leading-relaxed junior:font-ui junior:text-ui-sm">
                  {sheet.example}
                </p>
              </div>
            ) : null}
          </article>
        ) : tab === 'blocks' ? (
          <SheetList sheets={blocks.filter((s) => match(s.title, s.text, s.categoryLabel))} />
        ) : tab === 'components' ? (
          <ul className="flex flex-col gap-2">
            {components
              .filter((c) => match(c.label, c.text, c.type))
              .map((component) => (
                <li
                  key={component.type}
                  className="rounded-ui border border-border p-3"
                  data-testid={`help-component-${component.type}`}
                >
                  <h3 className="flex items-center gap-2 font-strong">
                    <span className="grid size-7 place-items-center rounded-[calc(var(--radius)-3px)] bg-mint-soft text-mint-text">
                      <ComponentIcon type={component.type} size={15} />
                    </span>
                    {component.label}
                  </h3>
                  <p className="mt-1.5 text-ui-sm leading-relaxed">{component.text}</p>
                  <p className="mt-2 rounded-ui bg-surface-2 px-2 py-1.5 font-mono text-[12px] junior:font-ui junior:text-ui-sm">
                    {component.example}
                  </p>
                  {component.events.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {component.events.map((type) => {
                        const own = blockSheet(type, locale)
                        return own ? (
                          <button
                            key={type}
                            type="button"
                            className="max-w-full rounded-[7px] outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => openHelp({ kind: 'block', id: type })}
                          >
                            <BlockPill sheet={own} />
                          </button>
                        ) : null
                      })}
                    </div>
                  ) : null}
                </li>
              ))}
          </ul>
        ) : tab === 'keys' ? (
          <div className="flex flex-col gap-4" data-testid="help-keys">
            <p className="text-ui-sm text-muted">{keys.intro}</p>
            {(['everywhere', 'design', 'blocks'] as const).map((group) => (
              <section key={group}>
                <h3 className="mb-1.5 font-strong">{keys.groups[group]}</h3>
                <dl className="flex flex-col gap-1.5">
                  {keys[group]
                    .filter(([combo, text]) => match(combo, text))
                    .map(([combo, text]) => (
                      <div key={combo} className="flex items-baseline gap-3 text-ui-sm">
                        <dt className="w-36 shrink-0">
                          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">
                            {combo}
                          </kbd>
                        </dt>
                        <dd className="leading-relaxed">{text}</dd>
                      </div>
                    ))}
                </dl>
              </section>
            ))}
          </div>
        ) : (
          <dl className="flex flex-col gap-3">
            {glossary
              .filter(([, entry]) => match(entry.term, entry.text))
              .map(([id, entry]) => (
                <div
                  key={id}
                  className={cn(
                    'rounded-ui border border-border p-3',
                    topic?.kind === 'term' && topic.id === id && 'border-primary',
                  )}
                >
                  <dt className="font-strong">{entry.term}</dt>
                  <dd className="mt-1 text-ui-sm leading-relaxed text-muted">{entry.text}</dd>
                </div>
              ))}
          </dl>
        )}
        {!sheet &&
        needle &&
        tab !== 'keys' &&
        noResult(tab, blocks, components, glossary, match) ? (
          <p className="py-6 text-center text-ui-sm text-muted">{t('help.noResult', { query })}</p>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border p-3">
        <Link to="/learn" onClick={close}>
          <Button size="sm" variant="soft" icon={<GraduationCap size={15} />}>
            {t('help.tutorials')}
          </Button>
        </Link>
        <Button
          size="sm"
          icon={<Compass size={15} />}
          onClick={() => {
            close()
            startTour()
          }}
        >
          {t('help.tour')}
        </Button>
        {mode === 'junior' ? (
          <IconButton
            size="sm"
            label={sounds ? t('help.soundsOff') : t('help.soundsOn')}
            active={sounds}
            onClick={() => set({ sounds: !sounds })}
            className="ml-auto"
          >
            {sounds ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </IconButton>
        ) : null}
      </footer>
    </aside>
  )
}

function noResult(
  tab: HelpTab,
  blocks: Sheet[],
  components: ReturnType<typeof componentSheets>,
  glossary: [string, { term: string; text: string }][],
  match: (...texts: (string | undefined)[]) => boolean,
): boolean {
  if (tab === 'blocks') return !blocks.some((s) => match(s.title, s.text, s.categoryLabel))
  if (tab === 'components') return !components.some((c) => match(c.label, c.text, c.type))
  return !glossary.some(([, entry]) => match(entry.term, entry.text))
}

function SheetList({ sheets }: { sheets: Sheet[] }) {
  // Grouped by toolbox category, in the order they come.
  const groups = new Map<string, Sheet[]>()
  for (const sheet of sheets)
    groups.set(sheet.categoryLabel, [...(groups.get(sheet.categoryLabel) ?? []), sheet])
  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([label, items]) => (
        <section key={label}>
          <h3 className="mb-1.5 text-ui-sm font-strong text-muted">{label}</h3>
          <ul className="flex flex-col gap-1">
            {items.map((sheet) => (
              <li key={sheet.id}>
                <button
                  type="button"
                  onClick={() => openHelp({ kind: 'block', id: sheet.id })}
                  className="flex w-full flex-col items-start gap-1 rounded-ui px-2 py-1.5 text-left hover:bg-surface-2"
                  data-testid={`help-block-${sheet.id}`}
                >
                  <BlockPill sheet={sheet} />
                  <span className="line-clamp-2 text-ui-sm text-muted">{sheet.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
