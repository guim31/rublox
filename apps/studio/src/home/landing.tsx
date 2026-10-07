import { Link } from '@tanstack/react-router'
import { Blocks, GraduationCap, LogIn, MousePointerClick, Smartphone, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo, Mascot } from '../components/brand.tsx'
import { PrefsMenu } from '../components/prefs-controls.tsx'
import { Button } from '../components/ui/button.tsx'
import { usePrefs } from '../lib/prefs.ts'

/**
 * The welcome page for a visitor who is not signed in (SPEC § 1, § 2): what Rublox is, then
 * "Try without an account" (guest mode) or "Sign in" (the instance is invitation only).
 */
export function Landing() {
  const { t } = useTranslation()
  const set = usePrefs((s) => s.set)
  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5">
        <Logo />
        <div className="flex-1" />
        <PrefsMenu />
        <Link
          to="/login"
          className="inline-flex h-control items-center gap-2 rounded-ui px-3 font-strong hover:bg-surface-2 junior:px-4"
        >
          <LogIn size={16} />
          {t('landing.signIn')}
        </Link>
      </header>

      <main className="flex-1">
        <section
          aria-labelledby="landing-title"
          className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-8 pb-16 md:grid-cols-[1.1fr_1fr] md:pt-16"
        >
          <div className="flex flex-col items-start gap-5 rx-anim-in">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-ui-sm font-strong text-primary-text">
              <Sparkles size={14} />
              {t('tagline')}
            </span>
            <h1
              id="landing-title"
              className="font-junior text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] font-black tracking-tight"
            >
              {t('landing.title')}
            </h1>
            <p className="max-w-xl text-ui-lg text-muted">{t('landing.lead')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                icon={<MousePointerClick size={18} />}
                onClick={() => set({ welcomed: true })}
                data-testid="try-guest"
              >
                {t('landing.tryGuest')}
              </Button>
              <Link
                to="/login"
                className="inline-flex h-[calc(var(--h-control)+8px)] items-center gap-2 rounded-ui border border-border bg-surface px-5 text-ui-lg font-strong transition-colors hover:border-border-strong hover:bg-surface-2"
                data-testid="landing-sign-in"
              >
                <LogIn size={18} />
                {t('landing.signIn')}
              </Link>
            </div>
            <p className="text-ui-sm text-muted">{t('landing.tryGuestHint')}</p>
            <p className="max-w-lg rounded-ui border border-border bg-surface px-3 py-2 text-ui-sm text-muted">
              {t('landing.invitation')}
            </p>
          </div>
          <Illustration />
        </section>

        <section aria-labelledby="landing-features" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 id="landing-features" className="text-center text-ui-xl font-strong">
              {t('landing.features.title')}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Feature icon={<Smartphone size={22} />} tone="bg-primary-soft text-primary-text">
                {t('landing.features.design.title')}
                {t('landing.features.design.text')}
              </Feature>
              <Feature icon={<Blocks size={22} />} tone="bg-coral-soft text-danger">
                {t('landing.features.blocks.title')}
                {t('landing.features.blocks.text')}
              </Feature>
              <Feature icon={<GraduationCap size={22} />} tone="bg-mint-soft text-mint-text">
                {t('landing.features.learn.title')}
                {t('landing.features.learn.text')}
              </Feature>
              <Feature icon={<MousePointerClick size={22} />} tone="bg-yellow-soft text-text">
                {t('landing.features.phone.title')}
                {t('landing.features.phone.text')}
              </Feature>
            </ul>
          </div>
        </section>

        <section aria-labelledby="landing-modes" className="mx-auto max-w-6xl px-5 py-14">
          <h2 id="landing-modes" className="text-center text-ui-xl font-strong">
            {t('landing.modes.title')}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-ui-lg border border-border bg-surface p-5">
              <Mascot size={84} mood="cheer" className="shrink-0 text-text" />
              <div>
                <h3 className="font-junior text-[22px] font-black">{t('prefs.junior')}</h3>
                <p className="mt-1 text-muted">{t('landing.modes.junior')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-ui-lg border border-border bg-surface p-5">
              <CodeGlyph />
              <div>
                <h3 className="text-[22px] font-strong">{t('prefs.studio')}</h3>
                <p className="mt-1 text-muted">{t('landing.modes.studio')}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-6 text-center text-ui-sm text-muted">
        {t('landing.footer')}
      </footer>
    </div>
  )
}

function Feature({
  icon,
  tone,
  children,
}: {
  icon: ReactNode
  tone: string
  children: [ReactNode, ReactNode]
}) {
  return (
    <li className="flex flex-col gap-2 rounded-ui-lg border border-border bg-bg p-5">
      <span className={`grid size-11 place-items-center rounded-ui ${tone}`}>{icon}</span>
      <h3 className="font-strong text-ui-lg">{children[0]}</h3>
      <p className="text-muted">{children[1]}</p>
    </li>
  )
}

/** "</>" in a soft tile: Studio shows the code. */
function CodeGlyph() {
  return (
    <span
      aria-hidden="true"
      className="grid size-[84px] shrink-0 place-items-center rounded-ui-lg bg-primary-soft font-mono text-[30px] font-bold text-primary-text"
    >
      {'</>'}
    </span>
  )
}

/**
 * A phone running a tiny app, the two blocks that make it work, and the mascot: drawn for
 * Rublox, in HTML so that its texts follow the language.
 */
function Illustration() {
  const { t } = useTranslation()
  return (
    <div aria-hidden="true" className="relative mx-auto h-[420px] w-full max-w-[440px] select-none">
      <div className="absolute inset-x-10 top-6 bottom-0 rounded-full bg-primary-soft blur-3xl" />
      <div className="absolute top-0 left-1/2 h-[400px] w-[210px] -translate-x-1/2 rounded-[34px] border-[7px] border-text bg-surface shadow-3">
        <div className="mx-auto mt-2 h-4 w-16 rounded-full bg-text" />
        <div className="flex flex-col items-center gap-5 px-4 pt-16">
          <span className="font-junior text-[30px] font-black text-primary-text">
            {t('landing.demo.hello')}
          </span>
          <span className="rounded-[12px] bg-primary px-5 py-2.5 font-strong text-on-primary shadow-1">
            {t('landing.demo.button')}
          </span>
        </div>
      </div>
      <div className="absolute top-[58%] -left-2 flex -rotate-3 flex-col drop-shadow-lg sm:left-0">
        <span className="rounded-t-[10px] rounded-br-[10px] bg-[#9a5c08] px-3 pt-2 pb-3 text-ui-sm font-strong text-white">
          {t('landing.demo.when')}
        </span>
        <span className="ml-4 rounded-[8px] bg-[#0b6f63] px-3 py-2 text-ui-sm font-strong text-white">
          {t('landing.demo.set')}{' '}
          <span className="rounded bg-white px-1.5 text-[#0b6f63]">
            « {t('landing.demo.hello')} »
          </span>
        </span>
      </div>
      <Mascot size={110} mood="wave" animated className="absolute -right-2 bottom-2 text-text" />
    </div>
  )
}
