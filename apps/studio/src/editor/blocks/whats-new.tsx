import type { ChangedBlock } from '@rublox/learn'
import { APP_WORKSPACE, type WorkspaceKey } from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '../../components/ui/button.tsx'
import { useExploreModule } from '../../learn/explore-runner.tsx'
import { cn } from '../../lib/cn.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { useDoc, useSession } from '../context.tsx'
import { useEditorNavigate } from '../nav.ts'
import { useEditor } from '../store.ts'

/** A stack holding changed blocks, and how many it adds and changes. */
type Stack = { id: string; workspace: WorkspaceKey; added: number; changed: number }

function stacksOf(blocks: ChangedBlock[]): Stack[] {
  const stacks = new Map<string, Stack>()
  for (const block of blocks) {
    const stack = stacks.get(block.stack) ?? {
      id: block.stack,
      workspace: block.workspace,
      added: 0,
      changed: 0,
    }
    stack[block.status] += 1
    stacks.set(block.stack, stack)
  }
  return [...stacks.values()]
}

/** What a stack says, as Blockly writes it ("when Star touches Basket…"). */
function labelOf(id: string): string | null {
  const block = Blockly.getMainWorkspace()?.getBlockById(id)
  return block ? block.toString(56) : null
}

/**
 * "Show me what's new" (J9), in a project copied from a level of an app to take apart: lights
 * the blocks the level adds (mint) or changes (yellow) compared with the level before, and
 * lists them in a small panel.
 */
export function WhatsNew({ workspace }: { workspace: WorkspaceKey }) {
  const { t } = useTranslation()
  const doc = useDoc()
  const session = useSession()
  const mode = usePrefs((s) => s.mode)
  const explore = useExploreModule(doc)
  const level = explore?.levelOf(doc)
  const [open, setOpen] = useState(false)
  const changes = useMemo(
    () => (explore && level ? explore.newInLevel(level, doc.meta.locale) : null),
    [explore, level, doc.meta.locale],
  )
  const go = useEditorNavigate(session.id)

  // Lit while the panel is open.
  useEffect(() => {
    if (!open || !changes) return
    useEditor
      .getState()
      .set({ marks: Object.fromEntries(changes.blocks.map((block) => [block.id, block.status])) })
    return () => useEditor.getState().set({ marks: {} })
  }, [open, changes])

  if (!level || !changes) return null
  const stacks = stacksOf(changes.blocks)
  const here = stacks.filter((stack) => stack.workspace === workspace)
  const elsewhere = [...new Set(stacks.map((stack) => stack.workspace))].filter(
    (key) => key !== workspace,
  )
  const nameOf = (key: WorkspaceKey) =>
    key === APP_WORKSPACE ? t('explore.whatsNew.app') : (doc.screens[key]?.name ?? key)
  const exists = (id: string) => Boolean(Blockly.getMainWorkspace()?.getBlockById(id))
  return (
    <>
      <Button
        size="sm"
        variant={open ? 'primary' : 'soft'}
        icon={<Sparkles size={15} />}
        aria-pressed={open}
        aria-label={t('explore.whatsNew.button')}
        title={t('explore.whatsNew.button')}
        onClick={() => setOpen(!open)}
        data-testid="whats-new"
      >
        {mode === 'junior' ? t('explore.whatsNew.short') : t('explore.whatsNew.button')}
      </Button>
      {open ? (
        <section
          aria-label={t('explore.whatsNew.title', { level: level.level })}
          className="rx-pop absolute top-14 right-3 z-20 flex max-h-[min(65vh,560px)] w-[300px] flex-col rounded-ui-lg border border-border bg-surface shadow-2 junior:w-[330px]"
          data-testid="whats-new-panel"
        >
          <header className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Sparkles size={16} className="shrink-0 text-mint-text" />
            <h2 className="min-w-0 flex-1 truncate font-strong">
              {t('explore.whatsNew.title', { level: level.level })}
            </h2>
            <IconButton
              size="sm"
              label={t('explore.whatsNew.close')}
              onClick={() => setOpen(false)}
            >
              <X size={15} />
            </IconButton>
          </header>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-3 text-ui-sm">
            <p className="text-muted">
              {t('explore.whatsNew.lead', { previous: level.level - 1 })}
            </p>
            <p className="flex flex-wrap gap-3" aria-hidden="true">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-mint" />
                {t('explore.whatsNew.added')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-yellow" />
                {t('explore.whatsNew.changed')}
              </span>
            </p>
            {changes.components.length ? (
              <div>
                <h3 className="mb-1 font-strong">{t('explore.whatsNew.components')}</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {changes.components.map((component) => (
                    <li
                      key={component.id}
                      className="rounded-full bg-mint-soft px-2 py-0.5 font-strong text-mint-text"
                    >
                      {doc.screens[component.screen]?.components[component.id]?.name ??
                        component.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <h3 className="mb-1 font-strong">
                {t('explore.whatsNew.blocks')} — {nameOf(workspace)}
              </h3>
              {here.length ? (
                <ul className="flex flex-col gap-1">
                  {here.map((stack) => {
                    const label = labelOf(stack.id)
                    return (
                      <li key={stack.id}>
                        <button
                          type="button"
                          disabled={!exists(stack.id)}
                          onClick={() => useEditor.getState().set({ reveal: stack.id })}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-ui border border-border px-2 py-1.5 text-left hover:border-border-strong disabled:opacity-60',
                          )}
                          data-testid="whats-new-item"
                        >
                          <span
                            className={cn(
                              'mt-1 size-2.5 shrink-0 rounded-full',
                              stack.added ? 'bg-mint' : 'bg-yellow',
                            )}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 font-strong">
                              {label ?? t('explore.whatsNew.gone')}
                            </span>
                            <span className="text-muted">
                              {[
                                stack.added
                                  ? t('explore.whatsNew.addedCount', { count: stack.added })
                                  : null,
                                stack.changed
                                  ? t('explore.whatsNew.changedCount', { count: stack.changed })
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-muted">{t('explore.whatsNew.none')}</p>
              )}
            </div>
            {elsewhere.length ? (
              <ul className="flex flex-col gap-1">
                {elsewhere.map((key) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {t('explore.whatsNew.elsewhere', { name: nameOf(key) })}
                    </span>
                    <Button
                      size="sm"
                      icon={<ArrowRight size={14} />}
                      onClick={() => void go({ tab: 'blocks', screen: key })}
                    >
                      {t('explore.whatsNew.go')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )
}
