import { javascript } from '@codemirror/lang-javascript'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { Copy } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { IconButton } from '../../components/ui/button.tsx'

const highlight = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--c-muted)', fontStyle: 'italic' },
  {
    tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword],
    color: 'var(--c-primary-text)',
    fontWeight: '600',
  },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--c-mint)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--c-coral)' },
  { tag: [tags.propertyName], color: 'var(--c-text)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--c-yellow)',
  },
])

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', background: 'transparent', color: 'var(--c-text)' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
    fontVariantLigatures: 'none',
  },
  '.cm-gutters': { background: 'transparent', border: 'none', color: 'var(--c-muted)' },
  '.cm-content': { caretColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
})

/** The generated JavaScript, read-only (SPEC § 4.2). */
export function CodeView({ code }: { code: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!host.current) return
    view.current = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: '',
        extensions: [
          lineNumbers(),
          javascript(),
          syntaxHighlighting(highlight),
          theme,
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.contentAttributes.of({ 'aria-label': t('editor.blocks.codeTitle') }),
        ],
      }),
    })
    // The code scrolls: keyboard users must be able to reach it (WCAG 2.1.1).
    view.current.scrollDOM.tabIndex = 0
    view.current.scrollDOM.setAttribute('aria-label', t('editor.blocks.codeTitle'))
    return () => view.current?.destroy()
  }, [t])

  useEffect(() => {
    const current = view.current
    if (!current || current.state.doc.toString() === code) return
    current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: code } })
  }, [code])

  return (
    <section aria-label={t('editor.blocks.codeTitle')} className="flex h-full min-h-0 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-ui-sm font-strong text-muted">{t('editor.blocks.code')}</h2>
        <IconButton
          size="sm"
          label={t('editor.blocks.copyCode')}
          onClick={async () => {
            await navigator.clipboard.writeText(code)
            toast.success(t('editor.blocks.copied'))
          }}
        >
          <Copy size={14} />
        </IconButton>
      </header>
      <div ref={host} className="min-h-0 flex-1 overflow-hidden" data-testid="code-view" />
    </section>
  )
}
