import { Check, Globe, Moon, Settings2, Sun, SunMoon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type ThemePref, usePrefs } from '../lib/prefs.ts'
import { IconButton } from './ui/button.tsx'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './ui/menu.tsx'
import { Segmented } from './ui/segmented.tsx'

/** The Junior / Studio switch, always visible in the top bar (SPEC § 5.2). */
export function ModeSwitch() {
  const { t } = useTranslation()
  const { mode, setMode } = usePrefs()
  return (
    <Segmented
      label={t('prefs.mode')}
      value={mode}
      onChange={setMode}
      size="sm"
      options={[
        { value: 'junior', label: t('prefs.junior'), title: t('prefs.juniorHint') },
        { value: 'studio', label: t('prefs.studio'), title: t('prefs.studioHint') },
      ]}
    />
  )
}

const THEME_ICONS: Record<ThemePref, typeof Sun> = { light: Sun, dark: Moon, system: SunMoon }

/** Theme and language. */
export function PrefsMenu() {
  const { t } = useTranslation()
  const { theme, setTheme, locale, setLocale } = usePrefs()
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={t('prefs.settings')} data-testid="prefs-menu">
          <Settings2 size={18} />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{t('prefs.theme')}</MenuLabel>
        {(['light', 'dark', 'system'] as const).map((value) => {
          const ItemIcon = THEME_ICONS[value]
          return (
            <MenuItem
              key={value}
              icon={<ItemIcon size={15} />}
              onSelect={() => setTheme(value)}
              shortcut={theme === value ? <Check size={14} /> : null}
            >
              {t(`prefs.${value}`)}
            </MenuItem>
          )
        })}
        <MenuSeparator />
        <MenuLabel>{t('prefs.language')}</MenuLabel>
        {(['fr', 'en'] as const).map((value) => (
          <MenuItem
            key={value}
            icon={<Globe size={15} />}
            onSelect={() => setLocale(value)}
            shortcut={locale === value ? <Check size={14} /> : null}
          >
            {value === 'fr' ? t('prefs.french') : t('prefs.english')}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
