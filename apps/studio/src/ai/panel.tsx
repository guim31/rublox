import { APP_WORKSPACE } from '@rublox/schema'
import { useQueryClient } from '@tanstack/react-query'
import { MousePointerClick, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mascot } from '../components/brand.tsx'
import { Button, IconButton } from '../components/ui/button.tsx'
import { useDoc, useSession } from '../editor/context.tsx'
import { useEditorNavigate } from '../editor/nav.ts'
import { useEditor } from '../editor/store.ts'
import { api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { useFeatures } from '../lib/features.ts'
import { usePrefs } from '../lib/prefs.ts'
import { ME_KEY } from '../lib/session.ts'
import { describeScreen, truncate, withNames } from './context.ts'
import { type AiQuestion, useAiPanel } from './store.ts'

type Answer =
  | { state: 'idle' }
  | { state: 'thinking' }
  | { state: 'done'; text: string; blockIds: string[] }
  | { state: 'refused' }
  | { state: 'error'; message: string }

/**
 * The assistant in the editor (SPEC § 4.12): "Explain" a block, a stack or a screen, and
 * "Why doesn't it work?", which reads the console and the blocks of the screen. A side panel
 * that leaves the blocks and the preview visible.
 */
export function AiPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { question, asked, close } = useAiPanel()
  const features = useFeatures()
  const doc = useDoc()
  const session = useSession()
  const { locale, mode } = usePrefs()
  const client = useQueryClient()
  const go = useEditorNavigate(projectId)
  const [answer, setAnswer] = useState<Answer>({ state: 'idle' })
  const [expected, setExpected] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const serverProject = session.source.kind === 'server' ? session.id : null

  const run = async (current: AiQuestion) => {
    setAnswer({ state: 'thinking' })
    try {
      if (current.kind === 'explain') {
        const context =
          current.target === 'screen' || !current.block
            ? describeScreen(doc, current.workspace)
            : truncate(
                `${current.target === 'block' ? 'Block' : 'Stack'} (JSON):\n${JSON.stringify(withNames(current.block, doc, current.workspace))}\n\n${current.workspace === APP_WORKSPACE ? '' : describeScreen(doc, current.workspace)}`,
              )
        const result = await call(
          api.ai.explain.$post({
            json: { projectId: serverProject, target: current.target, locale, mode, context },
          }),
        )
        setAnswer(
          result.refused
            ? { state: 'refused' }
            : { state: 'done', text: result.answer, blockIds: [] },
        )
      } else {
        const logs = useEditor
          .getState()
          .logs.slice(-40)
          .map(
            (entry) =>
              `${entry.level}${entry.blockId ? ` (block ${entry.blockId})` : ''}: ${entry.message}`,
          )
          .join('\n')
        const result = await call(
          api.ai.debug.$post({
            json: {
              projectId: serverProject,
              locale,
              mode,
              question: expected.trim(),
              context: describeScreen(doc, current.workspace) || 'No screen.',
              console: logs.slice(-18_000),
            },
          }),
        )
        setAnswer(
          result.refused
            ? { state: 'refused' }
            : { state: 'done', text: result.answer, blockIds: result.blockIds },
        )
      }
    } catch (error) {
      setAnswer({ state: 'error', message: errorMessage(t, error) })
    } finally {
      void client.invalidateQueries({ queryKey: ME_KEY })
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new question, not a new render
  useEffect(() => {
    if (!question) return
    setExpected('')
    heading.current?.focus()
    if (question.kind === 'explain') void run(question)
    else setAnswer({ state: 'idle' })
  }, [question, asked])

  if (!question || !features.ai) return null
  const title = question.kind === 'debug' ? t('ai.debug.title') : t('ai.explain.title')
  const remaining = Math.max(0, features.ai.quota - features.ai.used)

  return (
    <aside
      aria-labelledby="ai-panel-title"
      data-testid="ai-panel"
      className="fixed top-16 right-3 bottom-3 z-30 flex w-[min(92vw,400px)] flex-col overflow-hidden rounded-ui-lg border border-border bg-surface shadow-3 rx-anim-in"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles size={18} className="text-primary" aria-hidden="true" />
        <h2
          id="ai-panel-title"
          ref={heading}
          tabIndex={-1}
          className="flex-1 text-ui-lg font-strong outline-none"
        >
          {title}
        </h2>
        <IconButton label={t('ai.panel.close')} onClick={close}>
          <X size={18} />
        </IconButton>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {question.kind === 'debug' && answer.state === 'idle' ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void run(question)
            }}
          >
            <p className="text-muted">{t('ai.debug.intro')}</p>
            <label htmlFor="ai-expected" className="flex flex-col gap-1.5">
              <span className="text-ui-sm font-strong">{t('ai.debug.question')}</span>
              <textarea
                id="ai-expected"
                rows={3}
                maxLength={500}
                value={expected}
                placeholder={t('ai.debug.questionPlaceholder')}
                onChange={(event) => setExpected(event.target.value)}
                className="w-full resize-y rounded-ui border border-border-strong bg-surface px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
            <Button type="submit" variant="primary" icon={<Sparkles size={16} />}>
              {t('ai.debug.submit')}
            </Button>
          </form>
        ) : null}
        {answer.state === 'thinking' ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
            <Mascot
              size={88}
              mood="think"
              className="animate-pulse text-text motion-reduce:animate-none"
            />
            <p className="font-strong">
              {question.kind === 'debug' ? t('ai.debug.thinking') : t('ai.explain.thinking')}
            </p>
          </div>
        ) : null}
        {answer.state === 'refused' ? (
          <p role="alert" className="flex items-center gap-3 rounded-ui bg-yellow-soft p-3">
            <Mascot size={44} mood="oops" className="shrink-0 text-text" />
            {t('ai.panel.refused')}
          </p>
        ) : null}
        {answer.state === 'error' ? (
          <p role="alert" className="rounded-ui bg-coral-soft p-3">
            {answer.message}
          </p>
        ) : null}
        {answer.state === 'done' ? (
          <div className="flex flex-col gap-3" data-testid="ai-answer">
            <div className="flex items-start gap-3">
              <Mascot size={48} mood="happy" className="shrink-0 text-text" />
              <div className="min-w-0 flex-1 rounded-ui-lg rounded-tl-sm bg-primary-soft p-3 junior:text-ui-lg">
                <AnswerText text={answer.text} />
              </div>
            </div>
            {answer.blockIds.length ? (
              <div className="flex flex-wrap gap-2">
                {answer.blockIds.map((blockId, index) => (
                  <Button
                    key={blockId}
                    size="sm"
                    icon={<MousePointerClick size={15} />}
                    onClick={() => {
                      useEditor.getState().set({ focusBlock: blockId })
                      void go({ tab: 'blocks', screen: question.workspace })
                    }}
                  >
                    {t('ai.debug.showBlock')}
                    {answer.blockIds.length > 1 ? ` ${index + 1}` : ''}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <footer className="flex flex-col gap-2 border-t border-border px-4 py-3">
        <p className="text-ui-sm text-muted">{t('ai.panel.note')}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-ui-sm text-muted">
            {t('ai.panel.remaining', { count: remaining })}
          </span>
          {answer.state === 'done' || answer.state === 'error' || answer.state === 'refused' ? (
            <Button
              size="sm"
              icon={<RotateCcw size={15} />}
              onClick={() =>
                question.kind === 'debug' ? setAnswer({ state: 'idle' }) : void run(question)
              }
            >
              {t('ai.panel.again')}
            </Button>
          ) : null}
        </div>
      </footer>
    </aside>
  )
}

/** The answer: paragraphs and short lists, without Markdown marks. */
function AnswerText({ text }: { text: string }) {
  const blocks = text
    .replace(/\*\*|__|`/g, '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, index) => {
        const lines = block.split('\n')
        const key = `${index}-${block.slice(0, 12)}`
        if (lines.every((line) => /^\s*([-•*]|\d+[.)])\s/.test(line))) {
          return (
            <ul key={key} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((line) => (
                <li key={line}>{line.replace(/^\s*([-•*]|\d+[.)])\s/, '')}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={key} className="whitespace-pre-wrap">
            {block}
          </p>
        )
      })}
    </div>
  )
}
