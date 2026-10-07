import type { Locale, ProjectDoc } from '@rublox/schema'
import { TEMPLATES, type Template, templateProject } from '@rublox/templates'
import { FilePlus2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { Input } from '../components/ui/input.tsx'
import { cn } from '../lib/cn.ts'
import { summarize } from '../storage/projects.ts'
import { ProjectThumbnail } from './thumbnail.tsx'

const ACCENTS: Record<Template['accent'], string> = {
  indigo: 'bg-primary-soft',
  coral: 'bg-coral-soft',
  yellow: 'bg-yellow-soft',
  mint: 'bg-mint-soft',
}

/** Previews of the templates in one language (built once). */
const previews = new Map<Locale, Map<string, ProjectDoc>>()

function previewsOf(locale: Locale): Map<string, ProjectDoc> {
  let docs = previews.get(locale)
  if (!docs) {
    docs = new Map()
    for (const template of TEMPLATES) {
      try {
        docs.set(template.id, templateProject(template, { locale, mode: template.mode }))
      } catch {
        // A template that cannot be built is left out (its test fails in the CI).
      }
    }
    previews.set(locale, docs)
  }
  return docs
}

/**
 * "New project" (SPEC § 4.8): a name, and a blank project or one of the 12 templates
 * (`content/templates/`), built in the language of the app.
 */
export function NewProjectDialog(props: {
  open: boolean
  locale: Locale
  dark: boolean
  defaultName: string
  onClose: () => void
  onCreate: (input: { name: string; template: Template | null }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(props.defaultName)
  const [touched, setTouched] = useState(false)
  const [chosen, setChosen] = useState<Template | null>(null)
  const [busy, setBusy] = useState(false)
  const docs = useMemo(
    () => (props.open ? previewsOf(props.locale) : null),
    [props.open, props.locale],
  )

  useEffect(() => {
    if (props.open) {
      setName(props.defaultName)
      setTouched(false)
      setChosen(null)
    }
  }, [props.open, props.defaultName])

  const choose = (template: Template | null) => {
    setChosen(template)
    if (!touched) setName(template ? template.texts[props.locale].title : props.defaultName)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(value) => !value && props.onClose()}
      title={t('templates.title')}
      className="w-[min(94vw,900px)]"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!name.trim() || busy) return
          setBusy(true)
          try {
            await props.onCreate({ name: name.trim(), template: chosen })
          } finally {
            setBusy(false)
          }
        }}
      >
        <label htmlFor="project-name" className="flex flex-col gap-1.5">
          <span className="text-ui-sm font-strong">{t('dashboard.createName')}</span>
          <Input
            id="project-name"
            autoFocus
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value)
              setTouched(true)
            }}
            onFocus={(event) => event.target.select()}
          />
        </label>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-ui-sm font-strong">{t('templates.choose')}</legend>
          <div className="grid max-h-[min(56vh,520px)] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 overflow-y-auto p-1 junior:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            <Choice
              selected={chosen === null}
              onSelect={() => choose(null)}
              title={t('templates.blank')}
              text={t('templates.blankText')}
              testId="template-blank"
              visual={
                <div className="grid size-full place-items-center bg-surface-2 text-muted">
                  <FilePlus2 size={36} strokeWidth={1.5} />
                </div>
              }
            />
            {TEMPLATES.map((template) => {
              const doc = docs?.get(template.id)
              if (!doc) return null
              const texts = template.texts[props.locale]
              return (
                <Choice
                  key={template.id}
                  selected={chosen?.id === template.id}
                  onSelect={() => choose(template)}
                  title={`${template.icon} ${texts.title}`}
                  text={texts.description}
                  badge={t(`templates.modes.${template.mode}`)}
                  testId={`template-${template.id}`}
                  visual={
                    <div
                      className={cn(
                        'relative size-full [--thumb-scale:0.34]',
                        ACCENTS[template.accent],
                      )}
                    >
                      <div className="absolute inset-x-5 top-3 bottom-0 overflow-hidden rounded-t-[14px] border-4 border-b-0 border-text/85 bg-surface">
                        <ProjectThumbnail preview={summarize(doc).preview} dark={props.dark} />
                      </div>
                    </div>
                  }
                />
              )
            })}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button onClick={props.onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
            {chosen ? t('templates.createFrom') : t('common.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function Choice(props: {
  selected: boolean
  onSelect: () => void
  title: string
  text: string
  badge?: string
  visual: React.ReactNode
  testId: string
}) {
  return (
    <label
      data-testid={props.testId}
      className={cn(
        'flex cursor-pointer flex-col overflow-hidden rounded-ui-lg border bg-surface text-left transition-[box-shadow,border] duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
        props.selected
          ? 'border-primary ring-2 ring-primary'
          : 'border-border hover:border-border-strong hover:shadow-1',
      )}
    >
      <input
        type="radio"
        name="new-project-template"
        className="sr-only"
        checked={props.selected}
        onChange={props.onSelect}
      />
      <div className="h-[118px] w-full overflow-hidden">{props.visual}</div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="flex items-start justify-between gap-2">
          <span className="font-strong leading-tight">{props.title}</span>
          {props.badge ? (
            <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-ui-sm text-muted">
              {props.badge}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-ui-sm text-muted">{props.text}</span>
      </div>
    </label>
  )
}
