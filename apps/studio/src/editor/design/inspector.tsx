import {
  componentStrings,
  getComponentDef,
  PROP_GROUPS,
  type PropGroup,
  resolveDefault,
} from '@rublox/catalog'
import { isValidName, renameComponent, renameScreen, type ScreenId, setProp } from '@rublox/schema'
import { ChevronDown, CircleHelp, Copy, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../components/ui/button.tsx'
import { Input } from '../../components/ui/input.tsx'
import { cn } from '../../lib/cn.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { deleteComponent, duplicate } from '../actions.ts'
import { ComponentIcon } from '../component-icon.tsx'
import { useDoc, useSession } from '../context.tsx'
import { useEditor } from '../store.ts'
import { EDITORS } from './editors.tsx'

/**
 * Properties of the selected component, generated from the catalog and grouped in sections
 * (SPEC § 4.1). Junior shows the essential ones; the others wait under "More options".
 */
export function Inspector({ screenId }: { screenId: ScreenId }) {
  const { t } = useTranslation()
  const session = useSession()
  const doc = useDoc()
  const { mode, locale } = usePrefs()
  const selected = useEditor((s) => s.selected)
  const [more, setMore] = useState(false)
  const screen = doc.screens[screenId]
  if (!screen) return null
  const id = selected && screen.components[selected] ? selected : screen.rootId
  const node = screen.components[id]
  const def = node ? getComponentDef(node.type) : undefined
  if (!node || !def) return <p className="p-4 text-muted">{t('editor.inspector.empty')}</p>
  const strings = componentStrings(node.type, locale)
  const isRoot = id === screen.rootId
  const essential = mode === 'studio' || more

  const entries = Object.entries(def.props).filter(([, prop]) => !prop.state)
  const grouped = PROP_GROUPS.map((group) => ({
    group,
    props: entries.filter(([, prop]) => prop.group === group && (essential || prop.junior)),
  })).filter((entry) => entry.props.length > 0)
  const hiddenCount = entries.filter(([, prop]) => !prop.junior).length

  return (
    <section aria-label={t('editor.inspector.title')} className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border p-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-ui bg-mint-soft text-mint junior:size-10">
          <ComponentIcon type={node.type} size={mode === 'junior' ? 20 : 16} />
        </span>
        <div className="min-w-0 flex-1">
          <NameField
            key={id}
            value={node.name}
            taken={Object.entries(screen.components)
              .filter(([other]) => other !== id)
              .map(([, c]) => c.name)
              .concat(
                isRoot
                  ? Object.entries(doc.screens)
                      .filter(([sid]) => sid !== screenId)
                      .map(([, s]) => s.name)
                  : [],
              )}
            label={isRoot ? t('editor.inspector.screenName') : t('editor.inspector.name')}
            onCommit={(name) =>
              isRoot
                ? renameScreen(session.ydoc, screenId, name)
                : renameComponent(session.ydoc, screenId, id, name)
            }
          />
          <p className="truncate px-1 text-ui-sm text-muted">{strings?.label}</p>
        </div>
        {!isRoot ? (
          <>
            <IconButton
              size="sm"
              label={t('editor.inspector.duplicate')}
              shortcut="Mod+D"
              onClick={() => duplicate(session, screenId, id)}
            >
              <Copy size={15} />
            </IconButton>
            <IconButton
              size="sm"
              label={t('editor.inspector.delete')}
              shortcut="⌦"
              onClick={() => deleteComponent(session, screenId, id)}
            >
              <Trash2 size={15} />
            </IconButton>
          </>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {grouped.map(({ group, props }) => (
          <Section key={group} group={group}>
            {props.map(([key, prop]) => {
              const Editor = EDITORS[prop.kind]
              const set = key in node.props
              const value = set ? node.props[key] : resolveDefault(prop, doc.meta.locale)
              const fieldId = `prop-${id}-${key}`
              return (
                <div key={key} className="flex flex-col gap-1" data-tour={`inspector:${key}`}>
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={fieldId}
                      className={cn(
                        'text-ui-sm first-letter:uppercase',
                        set ? 'font-strong text-text' : 'text-muted',
                      )}
                    >
                      {strings?.props[key] ?? key}
                    </label>
                    {set && typeof prop.default !== 'object' ? (
                      <button
                        type="button"
                        aria-label={`${t('editor.inspector.reset')} (${strings?.props[key] ?? key})`}
                        title={t('editor.inspector.reset')}
                        onClick={() => setProp(session.ydoc, screenId, id, key, undefined)}
                        className="grid size-5 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text"
                      >
                        <RotateCcw size={12} />
                      </button>
                    ) : null}
                  </div>
                  <Editor
                    id={fieldId}
                    type={node.type}
                    prop={key}
                    def={prop}
                    value={value as never}
                    onChange={(next: unknown) => {
                      const same =
                        next === undefined || JSON.stringify(next) === JSON.stringify(prop.default)
                      setProp(
                        session.ydoc,
                        screenId,
                        id,
                        key,
                        same && typeof prop.default !== 'object' ? undefined : next,
                      )
                    }}
                  />
                </div>
              )
            })}
          </Section>
        ))}
        {mode === 'junior' && hiddenCount > 0 ? (
          <div className="p-3">
            <button
              type="button"
              aria-expanded={more}
              onClick={() => setMore(!more)}
              className="flex h-control w-full items-center justify-center gap-2 rounded-ui border border-border font-strong text-muted hover:bg-surface-2 hover:text-text"
            >
              {more ? t('editor.inspector.fewerOptions') : t('editor.inspector.moreOptions')}
              <ChevronDown size={16} className={cn('transition-transform', more && 'rotate-180')} />
            </button>
          </div>
        ) : null}
        {strings ? (
          <details className="group border-t border-border p-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-ui-sm font-strong text-muted hover:text-text">
              <CircleHelp size={15} />
              {t('editor.inspector.help')}
              <ChevronDown
                size={14}
                className="ml-auto transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-2 text-ui-sm">{strings.help}</p>
            <p className="mt-2 rounded-ui bg-surface-2 p-2 font-mono text-[12px] text-muted">
              {strings.example}
            </p>
          </details>
        ) : null}
      </div>
    </section>
  )
}

function Section({ group, children }: { group: PropGroup; children: React.ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-ui-sm font-strong text-muted uppercase tracking-wide hover:text-text junior:text-ui junior:normal-case junior:tracking-normal"
      >
        {t(`editor.inspector.groups.${group}`)}
        <ChevronDown size={14} className={cn('transition-transform', !open && '-rotate-90')} />
      </button>
      {open ? <div className="flex flex-col gap-3 px-3 pb-3">{children}</div> : null}
    </div>
  )
}

function NameField({
  value,
  taken,
  label,
  onCommit,
}: {
  value: string
  taken: string[]
  label: string
  onCommit: (name: string) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const valid = isValidName(draft) && !taken.includes(draft)
  return (
    <>
      <Input
        aria-label={label}
        value={draft}
        aria-invalid={!valid}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => (valid && draft !== value ? onCommit(draft) : setDraft(value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(value)
            event.currentTarget.blur()
          }
        }}
        className={cn(
          'h-control-sm border-transparent bg-transparent px-1 font-strong hover:border-border junior:h-control',
          !valid && 'border-danger',
        )}
      />
      {!valid ? (
        <p className="px-1 text-[11px] text-danger">{t('editor.inspector.nameInvalid')}</p>
      ) : null}
    </>
  )
}
