import { getComponentDef, PROP_GROUPS, propLabel, resolveDefault } from '@rublox/catalog'
import { type ComponentId, type ScreenId, setProp } from '@rublox/schema'
import { Copy, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../components/ui/button.tsx'
import { usePrefs } from '../../lib/prefs.ts'
import { deleteComponent, duplicate } from '../actions.ts'
import { ComponentIcon } from '../component-icon.tsx'
import { useDoc, useSession } from '../context.tsx'
import { useEditor } from '../store.ts'
import { EDITORS } from './editors.tsx'

/**
 * Several components selected (Studio): the properties they share, edited for all of them at
 * once, in one undo step.
 */
export function MultiInspector({ screenId, ids }: { screenId: ScreenId; ids: ComponentId[] }) {
  const { t } = useTranslation()
  const { t: tc } = useTranslation('catalog')
  const session = useSession()
  const doc = useDoc()
  const locale = usePrefs((s) => s.locale)
  const screen = doc.screens[screenId]
  const nodes = ids.flatMap((id) => {
    const node = screen?.components[id]
    return node && id !== screen?.rootId ? [{ id, node }] : []
  })
  const first = nodes[0]
  const firstDef = first ? getComponentDef(first.node.type) : undefined
  if (!first || !firstDef) return null
  const shared = Object.entries(firstDef.props).filter(
    ([key, prop]) =>
      !prop.state &&
      nodes.every(({ node }) => getComponentDef(node.type)?.props[key]?.kind === prop.kind),
  )
  const propValue = (key: string, id: ComponentId) => {
    const node = screen?.components[id]
    const prop = node ? getComponentDef(node.type)?.props[key] : undefined
    if (!node || !prop) return undefined
    return key in node.props ? node.props[key] : resolveDefault(prop, doc.meta.locale)
  }

  return (
    <section
      aria-label={t('editor.inspector.title')}
      className="flex h-full min-h-0 flex-col"
      data-testid="multi-inspector"
    >
      <header className="flex items-center gap-2 border-b border-border p-3">
        <div className="flex -space-x-1.5">
          {nodes.slice(0, 4).map(({ id, node }) => (
            <span
              key={id}
              className="grid size-7 place-items-center rounded-full border-2 border-surface bg-mint-soft text-mint"
            >
              <ComponentIcon type={node.type} size={14} />
            </span>
          ))}
        </div>
        <p className="min-w-0 flex-1 truncate font-strong">
          {tc('studio.selection.count', { count: nodes.length })}
        </p>
        <IconButton
          size="sm"
          label={t('editor.inspector.duplicate')}
          shortcut="Mod+D"
          onClick={() =>
            session.ydoc.transact(() => {
              for (const { id } of nodes) duplicate(session, screenId, id)
            })
          }
        >
          <Copy size={15} />
        </IconButton>
        <IconButton
          size="sm"
          label={t('editor.inspector.delete')}
          shortcut="⌦"
          onClick={() => {
            session.ydoc.transact(() => {
              for (const { id } of nodes) deleteComponent(session, screenId, id)
            })
            useEditor.getState().select(null)
          }}
        >
          <Trash2 size={15} />
        </IconButton>
      </header>
      <p className="border-b border-border px-3 py-2 text-ui-sm text-muted">
        {tc('studio.selection.hint')}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shared.length === 0 ? (
          <p className="p-3 text-ui-sm text-muted">{tc('studio.selection.none')}</p>
        ) : null}
        {PROP_GROUPS.map((group) => {
          const props = shared.filter(([, prop]) => prop.group === group)
          if (!props.length) return null
          return (
            <div key={group} className="flex flex-col gap-3 border-b border-border p-3">
              <h3 className="text-ui-sm font-strong text-muted uppercase tracking-wide">
                {t(`editor.inspector.groups.${group}`)}
              </h3>
              {props.map(([key, prop]) => {
                const Editor = EDITORS[prop.kind]
                const values = nodes.map(({ id }) => JSON.stringify(propValue(key, id)))
                const mixed = new Set(values).size > 1
                const fieldId = `multi-${key}`
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <label
                      htmlFor={fieldId}
                      className="text-ui-sm text-muted first-letter:uppercase"
                    >
                      {propLabel(first.node.type, key, locale)}
                      {mixed ? (
                        <span className="ml-1 text-[11px] italic">
                          ({tc('studio.selection.mixed')})
                        </span>
                      ) : null}
                    </label>
                    <Editor
                      id={fieldId}
                      type={first.node.type}
                      prop={key}
                      def={prop}
                      value={propValue(key, first.id) as never}
                      onChange={(next: unknown) =>
                        session.ydoc.transact(() => {
                          for (const { id } of nodes) setProp(session.ydoc, screenId, id, key, next)
                        })
                      }
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
