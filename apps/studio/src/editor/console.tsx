import { APP_WORKSPACE } from '@rublox/schema'
import {
  ChevronDown,
  CircleAlert,
  Info,
  MessageSquareText,
  Terminal,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../components/ui/button.tsx'
import { cn } from '../lib/cn.ts'
import { usePrefs } from '../lib/prefs.ts'
import { useEditorNavigate } from './nav.ts'
import { useEditor } from './store.ts'

const ICONS = { log: Info, warn: TriangleAlert, error: CircleAlert }

/** Messages, warnings and errors of the running app (SPEC § 4.3). */
export function ConsolePanel({ open, projectId }: { open: boolean; projectId: string }) {
  const { t, i18n } = useTranslation()
  const { logs, clearLogs } = useEditor()
  const set = usePrefs((s) => s.set)
  const go = useEditorNavigate(projectId)
  const list = useRef<HTMLOListElement>(null)
  const errors = logs.filter((l) => l.level === 'error').length

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll down when a message arrives
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [logs.length])

  return (
    <section
      aria-label={t('editor.console.title')}
      className="shrink-0 border-t border-border bg-surface"
    >
      <header className="flex h-9 items-center gap-2 px-2 junior:h-11">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => set({ consoleOpen: !open })}
          className="flex h-control-sm items-center gap-2 rounded-ui px-2 font-strong text-ui-sm hover:bg-surface-2"
          aria-label={open ? t('editor.console.hide') : t('editor.console.show')}
        >
          <Terminal size={15} className="text-muted" />
          {t('editor.console.title')}
          {logs.length ? (
            <span
              className={cn(
                'rounded-full px-1.5 text-[11px]',
                errors ? 'bg-coral-soft text-danger' : 'bg-surface-2 text-muted',
              )}
            >
              {logs.length}
            </span>
          ) : null}
          <ChevronDown
            size={14}
            className={cn('text-muted transition-transform', !open && 'rotate-180')}
          />
        </button>
        <div className="flex-1" />
        {open && logs.length ? (
          <IconButton size="sm" label={t('editor.console.clear')} onClick={clearLogs}>
            <Trash2 size={14} />
          </IconButton>
        ) : null}
      </header>
      {open ? (
        <ol
          ref={list}
          className="h-36 overflow-y-auto border-t border-border font-mono text-[12px] junior:h-40 junior:font-ui junior:text-ui-sm"
          aria-live="polite"
          data-testid="console"
        >
          {logs.length === 0 ? (
            <li className="flex h-full items-center justify-center gap-2 font-ui text-ui-sm text-muted">
              <MessageSquareText size={15} />
              {t('editor.console.empty')}
            </li>
          ) : null}
          {logs.map((entry) => {
            const Icon = ICONS[entry.level]
            return (
              <li
                key={entry.id}
                className={cn(
                  'flex items-start gap-2 border-b border-border/60 px-3 py-1.5',
                  entry.level === 'error' && 'bg-coral-soft/60 text-danger',
                  entry.level === 'warn' && 'bg-yellow-soft/60',
                )}
              >
                <Icon size={14} className="mt-0.5 shrink-0" aria-label={entry.level} />
                <time className="shrink-0 text-muted tabular-nums">
                  {new Date(entry.time).toLocaleTimeString(i18n.language, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                  {entry.message}
                </span>
                {entry.blockId ? (
                  <button
                    type="button"
                    className="shrink-0 rounded px-1.5 font-ui text-[11px] font-strong text-primary-text underline-offset-2 hover:underline"
                    onClick={() => {
                      useEditor.getState().set({ focusBlock: entry.blockId ?? null })
                      void go({ tab: 'blocks', screen: entry.workspace ?? APP_WORKSPACE })
                    }}
                  >
                    {t('editor.console.goToBlock')}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}
