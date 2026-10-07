import { prop } from '@rublox/catalog'
import { type NavItem, setNavigation, setTheme, type Theme } from '@rublox/schema'
import { useTranslation } from 'react-i18next'
import { Input, Select } from '../../components/ui/input.tsx'
import { Segmented } from '../../components/ui/segmented.tsx'
import { Switch } from '../../components/ui/switch.tsx'
import { cn } from '../../lib/cn.ts'
import { useDoc, useSession } from '../context.tsx'
import { IconEditor } from './editors-j2.tsx'

/** Ready-made color pairs: a quick start, still editable one by one. */
const PRESETS: { primary: string; secondary: string; background: string }[] = [
  { primary: '#5b4bff', secondary: '#ff6b5c', background: '#ffffff' },
  { primary: '#0f8f7f', secondary: '#f5b400', background: '#ffffff' },
  { primary: '#d9543a', secondary: '#3b6fd8', background: '#fff8f2' },
  { primary: '#c23a8c', secondary: '#7b4fd6', background: '#fdf6ff' },
  { primary: '#1883b8', secondary: '#2a9454', background: '#f3f9fc' },
  { primary: '#1b1a24', secondary: '#ff6b5c', background: '#f4f3f9' },
]

const iconDef = prop.icon({ default: '', group: 'content' })

/**
 * The app's theme and navigation (SPEC § 4.1), shown in the inspector when the screen itself
 * is selected. Components follow the theme unless one of their colors or corners is set.
 */
export function AppSettings() {
  const { t } = useTranslation('catalog')
  const session = useSession()
  const doc = useDoc()
  const theme = doc.settings.theme
  const navigation = doc.settings.navigation
  const items: NavItem[] = navigation.items ?? doc.screenOrder.map((screen) => ({ screen }))
  const patch = (next: Partial<Theme>) => setTheme(session.ydoc, next)
  const setItems = (next: NavItem[]) =>
    setNavigation(session.ydoc, {
      items: doc.screenOrder
        .map((screen) => next.find((item) => item.screen === screen))
        .filter((item): item is NavItem => Boolean(item)),
    })

  return (
    <div className="flex flex-col" data-testid="app-settings">
      <Group title={t('studio.app.theme')}>
        <p className="text-ui-sm text-muted">{t('studio.app.themeHint')}</p>
        <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
          <legend className="sr-only">{t('studio.app.presets')}</legend>
          {PRESETS.map((preset) => {
            const active =
              preset.primary === theme.primary &&
              preset.secondary === theme.secondary &&
              preset.background === theme.background
            return (
              <button
                key={preset.primary + preset.secondary}
                type="button"
                aria-pressed={active}
                aria-label={`${preset.primary} ${preset.secondary}`}
                title={`${preset.primary} · ${preset.secondary}`}
                onClick={() => patch(preset)}
                className={cn(
                  'flex h-8 overflow-hidden rounded-lg border-2',
                  active ? 'border-primary' : 'border-border hover:border-border-strong',
                )}
              >
                <span className="w-5" style={{ background: preset.primary }} />
                <span className="w-3" style={{ background: preset.secondary }} />
                <span className="w-3" style={{ background: preset.background }} />
              </button>
            )
          })}
        </fieldset>
        <ColorRow
          id="theme-primary"
          label={t('studio.app.primary')}
          value={theme.primary}
          onChange={(primary) => patch({ primary })}
        />
        <ColorRow
          id="theme-secondary"
          label={t('studio.app.secondary')}
          value={theme.secondary}
          onChange={(secondary) => patch({ secondary })}
        />
        <ColorRow
          id="theme-background"
          label={t('studio.app.background')}
          value={theme.background}
          onChange={(background) => patch({ background })}
        />
        <Field id="theme-font" label={t('studio.app.font')}>
          <Select
            id="theme-font"
            value={theme.font}
            onChange={(event) => patch({ font: event.target.value as Theme['font'] })}
          >
            {(['system', 'rounded', 'serif', 'mono'] as const).map((font) => (
              <option key={font} value={font}>
                {t(`studio.app.fonts.${font}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="theme-radius" label={`${t('studio.app.radius')} · ${theme.radius} px`}>
          <input
            id="theme-radius"
            type="range"
            min={0}
            max={32}
            value={theme.radius}
            onChange={(event) => patch({ radius: Number(event.target.value) })}
            className="w-full accent-primary"
          />
        </Field>
        <Field id="theme-scheme" label={t('studio.app.scheme')}>
          <Segmented
            label={t('studio.app.scheme')}
            size="sm"
            value={theme.scheme}
            onChange={(scheme) => patch({ scheme })}
            className="w-full [&>*]:flex-1"
            options={[
              { value: 'light', label: t('studio.app.schemes.light') },
              { value: 'dark', label: t('studio.app.schemes.dark') },
              { value: 'auto', label: t('studio.app.schemes.auto') },
            ]}
          />
        </Field>
      </Group>
      <Group title={t('studio.app.navigation')}>
        <Segmented
          label={t('studio.app.navigation')}
          size="sm"
          value={navigation.kind}
          onChange={(kind) => setNavigation(session.ydoc, { kind })}
          className="w-full [&>*]:flex-1"
          options={[
            { value: 'stack', label: t('studio.app.kinds.stack') },
            { value: 'tabs', label: t('studio.app.kinds.tabs') },
            { value: 'drawer', label: t('studio.app.kinds.drawer') },
          ]}
        />
        <p className="text-ui-sm text-muted">{t(`studio.app.kindHints.${navigation.kind}`)}</p>
        {navigation.kind !== 'stack' ? (
          <ul className="flex flex-col gap-2" aria-label={t('studio.app.entries')}>
            {doc.screenOrder.map((screenId) => {
              const screen = doc.screens[screenId]
              const item = items.find((entry) => entry.screen === screenId)
              const update = (change: Partial<NavItem>) =>
                setItems(
                  items.map((entry) =>
                    entry.screen === screenId ? { ...entry, ...change } : entry,
                  ),
                )
              return (
                <li
                  key={screenId}
                  className="flex flex-col gap-1.5 rounded-ui border border-border p-2"
                >
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(item)}
                      label={t('studio.app.inMenu', { name: screen?.name ?? '' })}
                      onChange={(on) =>
                        setItems(
                          on
                            ? [...items, { screen: screenId }]
                            : items.filter((entry) => entry.screen !== screenId),
                        )
                      }
                    />
                    <span className="truncate font-strong">{screen?.name}</span>
                  </div>
                  {item ? (
                    <div className="grid grid-cols-[1fr_1.2fr] gap-1.5">
                      <IconEditor
                        id={`nav-icon-${screenId}`}
                        type="Screen"
                        prop="icon"
                        def={iconDef}
                        value={item.icon ?? ''}
                        onChange={(icon) => update({ icon: icon || undefined })}
                      />
                      <Input
                        aria-label={t('studio.app.label', { name: screen?.name ?? '' })}
                        placeholder={screen?.name}
                        value={item.label ?? ''}
                        onChange={(event) => update({ label: event.target.value || undefined })}
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border p-3">
      <h3 className="text-ui-sm font-strong text-muted uppercase tracking-wide junior:text-ui junior:normal-case junior:tracking-normal">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-ui-sm text-muted first-letter:uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

function ColorRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#5b4bff'}
        onChange={(event) => onChange(event.target.value)}
        className="h-control w-12 shrink-0 cursor-pointer rounded-ui border border-border bg-surface p-1"
      />
      <label htmlFor={id} className="flex-1 text-ui-sm">
        {label}
      </label>
      <Input
        aria-label={label}
        value={value}
        className="w-24 font-mono text-ui-sm"
        onChange={(event) => {
          if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value.toLowerCase())
        }}
      />
    </div>
  )
}
