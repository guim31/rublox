import type { ProjectDoc } from '@rublox/schema'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Check, Pencil, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Mascot } from '../components/brand.tsx'
import { Button } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { PROJECTS_KEY } from '../dashboard/queries.ts'
import { ProjectThumbnail } from '../dashboard/thumbnail.tsx'
import { api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { isDark, usePrefs } from '../lib/prefs.ts'
import { ME_KEY } from '../lib/session.ts'
import { serverBackend } from '../storage/backend.ts'
import { countProject, loadsInBlockly } from './context.ts'

type State =
  | { step: 'ask' }
  | { step: 'thinking' }
  | { step: 'proposal'; doc: ProjectDoc; summary: string }
  | { step: 'refused' }

/**
 * "Create with AI" (SPEC § 4.12): a request becomes screens, components and blocks, shown as
 * a proposal to keep or decline. Keeping it creates a project, which a toast can undo.
 */
export function CreateWithAiDialog(props: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const { locale, mode, theme } = usePrefs()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [request, setRequest] = useState('')
  const [state, setState] = useState<State>({ step: 'ask' })
  const [busy, setBusy] = useState(false)
  const examples = t('ai.create.examples', { returnObjects: true }) as string[]

  const close = () => {
    props.onClose()
    setState({ step: 'ask' })
  }

  const ask = async () => {
    if (request.trim().length < 3) return
    setState({ step: 'thinking' })
    try {
      const answer = await call(
        api.ai.create.$post({ json: { request: request.trim(), locale, mode } }),
      )
      void client.invalidateQueries({ queryKey: ME_KEY })
      if (answer.refused) {
        setState({ step: 'refused' })
        return
      }
      const doc = answer.doc as unknown as ProjectDoc
      // The server checked the recipe; Blockly checks that every block loads.
      if (!(await loadsInBlockly(doc))) {
        toast.error(t('ai.create.broken'))
        setState({ step: 'ask' })
        return
      }
      setState({ step: 'proposal', doc, summary: answer.summary })
    } catch (error) {
      toast.error(errorMessage(t, error))
      setState({ step: 'ask' })
    }
  }

  const accept = async (doc: ProjectDoc) => {
    setBusy(true)
    try {
      const id = await serverBackend.create({ name: doc.meta.name, locale, mode, doc })
      await client.invalidateQueries({ queryKey: PROJECTS_KEY })
      setRequest('')
      setState({ step: 'ask' })
      props.onCreated(id)
      toast.success(t('ai.create.created'), {
        duration: 10_000,
        action: {
          label: t('ai.create.undo'),
          onClick: async () => {
            await serverBackend.deleteForever(id)
            await client.invalidateQueries({ queryKey: PROJECTS_KEY })
            toast(t('ai.create.undone'))
            await navigate({ to: '/' })
          },
        },
      })
    } catch (error) {
      toast.error(errorMessage(t, error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(value) => !value && close()}
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={20} className="text-primary" />
          {state.step === 'proposal' ? t('ai.create.proposal') : t('ai.create.title')}
        </span>
      }
      description={state.step === 'ask' ? t('ai.create.intro') : undefined}
      className="w-[min(94vw,760px)]"
    >
      {state.step === 'ask' || state.step === 'refused' ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void ask()
          }}
        >
          {state.step === 'refused' ? (
            <p role="alert" className="flex items-center gap-3 rounded-ui bg-yellow-soft p-3">
              <Mascot size={44} mood="oops" className="shrink-0 text-text" />
              {t('ai.panel.refused')}
            </p>
          ) : null}
          <label htmlFor="ai-request" className="flex flex-col gap-1.5">
            <span className="text-ui-sm font-strong">{t('ai.create.label')}</span>
            <textarea
              id="ai-request"
              autoFocus
              rows={3}
              maxLength={1000}
              value={request}
              placeholder={t('ai.create.placeholder')}
              onChange={(event) => setRequest(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void ask()
              }}
              className="w-full resize-y rounded-ui border border-border-strong bg-surface px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-ui-sm">
            <span className="text-muted">{t('ai.create.examplesLabel')}</span>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setRequest(example)}
                className="rounded-full border border-border bg-surface-2 px-3 py-1 hover:border-border-strong"
              >
                {example}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={close}>{t('common.cancel')}</Button>
            <Button
              type="submit"
              variant="primary"
              icon={<Sparkles size={16} />}
              disabled={request.trim().length < 3}
            >
              {t('ai.create.submit')}
            </Button>
          </div>
        </form>
      ) : state.step === 'thinking' ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
          <Mascot
            size={110}
            mood="think"
            className="animate-pulse text-text motion-reduce:animate-none"
          />
          <p className="font-strong">{t('ai.create.thinking')}</p>
          <p className="text-ui-sm text-muted">{t('ai.create.thinkingHint')}</p>
        </div>
      ) : (
        <Proposal
          doc={state.doc}
          summary={state.summary}
          dark={isDark(theme)}
          busy={busy}
          onAccept={() => void accept(state.doc)}
          onReject={close}
          onRetry={() => setState({ step: 'ask' })}
        />
      )}
    </Dialog>
  )
}

function Proposal(props: {
  doc: ProjectDoc
  summary: string
  dark: boolean
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const { doc } = props
  const counts = countProject(doc)
  return (
    <div className="flex flex-col gap-4" data-testid="ai-proposal">
      <div>
        <h3 className="text-ui-lg font-strong">{doc.meta.name}</h3>
        <p className="mt-1">{props.summary}</p>
        <p className="mt-1 text-ui-sm text-muted">{t('ai.create.stats', counts)}</p>
      </div>
      <ul className="flex gap-4 overflow-x-auto rounded-ui-lg bg-canvas p-4">
        {doc.screenOrder.map((screenId) => {
          const screen = doc.screens[screenId]
          if (!screen) return null
          return (
            <li key={screenId} className="flex shrink-0 flex-col items-center gap-2">
              <div className="h-[300px] w-[172px] overflow-hidden rounded-[22px] border-[5px] border-text/85 bg-surface shadow-2 [--thumb-scale:0.45]">
                <ProjectThumbnail
                  preview={{ screen, theme: doc.settings.theme, locale: doc.meta.locale }}
                  dark={props.dark}
                />
              </div>
              <span className="text-ui-sm text-muted">
                {t('ai.create.screenLabel', { name: screen.name })}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="text-ui-sm text-muted">{t('ai.panel.note')}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button icon={<Pencil size={16} />} onClick={props.onRetry}>
          {t('ai.create.retry')}
        </Button>
        <Button icon={<X size={16} />} onClick={props.onReject}>
          {t('ai.create.reject')}
        </Button>
        <Button
          variant="primary"
          icon={<Check size={16} />}
          onClick={props.onAccept}
          disabled={props.busy}
        >
          {t('ai.create.accept')}
        </Button>
      </div>
    </div>
  )
}
