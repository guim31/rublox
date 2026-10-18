import type { Locale, ProjectDoc } from '@rublox/schema'
import {
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  type Template,
  type TemplateCategory,
  templateProject,
} from '@rublox/templates'
import { FilePlus2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button.tsx'
import { Dialog } from '../components/ui/dialog.tsx'
import { Input } from '../components/ui/input.tsx'
import { cn } from '../lib/cn.ts'
import { summarize } from '../storage/projects.ts'
import { templateCover } from '../storage/template-files.ts'
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

type Filter = 'all' | TemplateCategory

/**
 * "New project" (SPEC § 4.8): a name, and a blank project or one of the 18 templates
 * (`content/templates/`), built in the language of the app. J10: the templates are sorted by
 * category (games first), and a game shows an animated picture of itself instead of its first
 * screen in miniature.
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
  const [filter, setFilter] = useState<Filter>('all')
  const docs = useMemo(
    () => (props.open ? previewsOf(props.locale) : null),
    [props.open, props.locale],
  )

  useEffect(() => {
    if (props.open) {
      setName(props.defaultName)
      setTouched(false)
      setChosen(null)
      setFilter('all')
    }
  }, [props.open, props.defaultName])

  const choose = (template: Template | null) => {
    setChosen(template)
    if (!touched) setName(template ? template.texts[props.locale].title : props.defaultName)
  }

  const card = (template: Template) => {
    const doc = docs?.get(template.id)
    if (!doc) return null
    const texts = template.texts[props.locale]
    const cover = templateCover(template)
    return (
      <Choice
        key={template.id}
        selected={chosen?.id === template.id}
        onSelect={() => choose(template)}
        title={`${template.icon} ${texts.title}`}
        text={texts.description}
        badge={t(`templates.modes.${template.mode}`)}
        badgeTone={template.mode}
        badgeHint={t(`newProject.modeHint.${template.mode}`)}
        testId={`template-${template.id}`}
        visual={
          cover ? (
            <img
              src={cover}
              alt=""
              draggable={false}
              className="size-full object-cover"
              data-testid="template-cover"
            />
          ) : (
            <div
              className={cn('relative size-full [--thumb-scale:0.34]', ACCENTS[template.accent])}
            >
              <div className="absolute inset-x-5 top-3 bottom-0 overflow-hidden rounded-t-[14px] border-4 border-b-0 border-text/85 bg-surface">
                <ProjectThumbnail preview={summarize(doc).preview} dark={props.dark} />
              </div>
            </div>
          )
        }
      />
    )
  }

  const blank = (
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
  )

  const byCategory = (category: TemplateCategory) =>
    TEMPLATES.filter((template) => template.category === category)

  return (
    <Dialog
      open={props.open}
      onOpenChange={(value) => !value && props.onClose()}
      title={t('templates.title')}
      className="w-[min(96vw,1040px)]"
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
          <fieldset className="mb-3 flex flex-wrap gap-1.5">
            <legend className="sr-only">{t('newProject.categoriesLabel')}</legend>
            {(['all', ...TEMPLATE_CATEGORIES] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                data-testid={`template-category-${value}`}
                onClick={() => setFilter(value)}
                className={cn(
                  'inline-flex h-control items-center gap-1.5 rounded-full border px-3 text-ui-sm font-strong transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary',
                  filter === value
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border bg-surface text-text hover:border-border-strong',
                )}
              >
                {t(`newProject.categories.${value}`)}
                {value === 'all' ? null : (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-ui-sm',
                      filter === value ? 'bg-on-primary/20' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {byCategory(value).length}
                  </span>
                )}
              </button>
            ))}
          </fieldset>
          <div
            className="flex max-h-[min(56vh,560px)] flex-col gap-5 overflow-y-auto p-1"
            data-testid="template-list"
          >
            {filter === 'all' ? (
              <>
                <Section title={t('newProject.blankSection')}>{blank}</Section>
                {TEMPLATE_CATEGORIES.map((category) => (
                  <Section key={category} title={t(`newProject.categories.${category}`)}>
                    {byCategory(category).map(card)}
                  </Section>
                ))}
              </>
            ) : (
              <Section title={t(`newProject.categories.${filter}`)}>
                {blank}
                {byCategory(filter).map(card)}
              </Section>
            )}
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

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-ui-sm font-strong text-muted">{props.title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 junior:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
        {props.children}
      </div>
    </section>
  )
}

function Choice(props: {
  selected: boolean
  onSelect: () => void
  title: string
  text: string
  badge?: string
  badgeTone?: 'junior' | 'studio'
  badgeHint?: string
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
            <span
              title={props.badgeHint}
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-ui-sm',
                props.badgeTone === 'studio'
                  ? 'bg-primary-soft text-primary-text'
                  : 'bg-mint-soft text-mint-text',
              )}
            >
              {props.badge}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-ui-sm text-muted">{props.text}</span>
      </div>
    </label>
  )
}
