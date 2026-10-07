import {
  CircleAlert,
  Copy,
  Info,
  Link2,
  RefreshCw,
  Smartphone,
  Square,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { QrCode } from '../../components/qr-code.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Dialog } from '../../components/ui/dialog.tsx'
import { Tooltip } from '../../components/ui/tooltip.tsx'
import { cn } from '../../lib/cn.ts'
import { config } from '../../lib/config.ts'
import { useSession } from '../context.tsx'
import { type LiveStatus, live, useLive } from './live.ts'

const LOG_ICONS = { log: Info, warn: TriangleAlert, error: CircleAlert }

/** Hosts a phone cannot reach: the address of the apps origin only works on this computer. */
function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host.endsWith('.localhost')
    )
  } catch {
    return false
  }
}

function statusKey(status: LiveStatus): 'connecting' | 'live' | 'offline' | 'ended' {
  if (status === 'live') return 'live'
  if (status === 'offline' || status === 'error') return 'offline'
  if (status === 'ended') return 'ended'
  return 'connecting'
}

/** The dot and words of the live test state. */
export function LiveStatusBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { status, phones } = useLive()
  const key = statusKey(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-ui-sm font-strong',
        key === 'live' && 'bg-mint-soft text-mint-text',
        key === 'offline' && 'bg-coral-soft text-danger',
        (key === 'connecting' || key === 'ended') && 'bg-surface-2 text-muted',
        className,
      )}
      data-testid="live-status"
      data-status={key}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          key === 'live' ? 'bg-mint' : key === 'offline' ? 'bg-coral' : 'bg-muted',
          key === 'live' && phones.length > 0 && 'animate-pulse',
        )}
      />
      {t(`live.status.${key}`)}
    </span>
  )
}

/** "Test" in the top bar: opens the dialog; shows the phones while a test runs. */
export function LiveButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { status, phones } = useLive()
  const active = status !== 'idle'
  // Leaving the editor stops feeding the phones (the link stays valid for this tab).
  useEffect(() => () => live.dispose(), [])
  return (
    <>
      <Tooltip
        content={
          active
            ? t('live.pill', { phones: t('live.phones', { count: phones.length }) })
            : t('live.title')
        }
      >
        <Button
          icon={<Smartphone size={16} />}
          aria-label={active ? t('live.reopen') : t('editor.test')}
          onClick={() => setOpen(true)}
          data-testid="live-open"
          className="relative"
        >
          <span className="rx-bar-label">{t('editor.test')}</span>
          {active ? (
            <span
              className={cn(
                'absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-strong text-white ring-2 ring-surface',
                status === 'live' ? 'bg-mint' : 'bg-coral',
              )}
              data-testid="live-phones"
            >
              {phones.length}
            </span>
          ) : null}
        </Button>
      </Tooltip>
      {open ? <LiveDialog open onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/** "Test on my phone" (SPEC § 4.3): QR code, link, connected phones, their console. */
export function LiveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const session = useSession()
  const { link, status, phones, logs, ended } = useLive()

  useEffect(() => {
    if (open) void live.start(session)
  }, [open, session])

  const time = link
    ? new Date(link.expiresAt).toLocaleTimeString(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
  const local = isLocalHost(config.appsUrl)

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={t('live.title')}
      description={t('live.intro')}
      className="max-h-[calc(100dvh-24px)] w-[min(94vw,680px)] overflow-y-auto"
    >
      <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-2">
          {link && status !== 'ended' ? (
            <QrCode value={link.url} label={t('live.qr')} className="w-full shadow-1" />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-ui-lg border border-dashed border-border-strong bg-surface-2 p-4 text-center text-ui-sm text-muted">
              {status === 'ended' && ended ? t(`live.ended.${ended}`) : t('live.creating')}
            </div>
          )}
          {link && status !== 'ended' ? (
            <p className="text-center text-ui-sm text-muted">{t('live.expires', { time })}</p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <LiveStatusBadge />
            <span className="text-ui-sm text-muted" data-testid="live-phone-count">
              {phones.length ? t('live.phones', { count: phones.length }) : t('live.noPhone')}
            </span>
          </div>
          {link && status !== 'ended' ? (
            <div className="flex items-center gap-1.5 rounded-ui border border-border bg-surface-2 py-1 pr-1 pl-2.5">
              <Link2 size={15} className="shrink-0 text-muted" />
              <input
                readOnly
                value={link.url}
                aria-label={t('live.copy')}
                data-testid="live-url"
                className="min-w-0 flex-1 truncate bg-transparent font-mono text-ui-sm outline-none"
              />
              <Button
                size="sm"
                icon={<Copy size={14} />}
                onClick={async () => {
                  await navigator.clipboard?.writeText(link.url).catch(() => {})
                  toast.success(t('live.copied'))
                }}
              >
                {t('live.copy')}
              </Button>
            </div>
          ) : null}
          {local ? (
            <p className="flex gap-2 rounded-ui bg-yellow-soft px-3 py-2 text-ui-sm">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              {t('live.localOnly', { host: new URL(config.appsUrl).host })}
            </p>
          ) : null}
          {status === 'error' ? (
            <p role="alert" className="text-ui-sm text-danger">
              {t('live.error')}
            </p>
          ) : null}
          {phones.length ? (
            <ul
              className="flex flex-col gap-1"
              aria-label={t('live.phones', { count: phones.length })}
            >
              {phones.map((phone) => (
                <li
                  key={phone.id}
                  className="flex items-center gap-2 rounded-ui bg-surface-2 px-2.5 py-1.5 text-ui-sm"
                >
                  <Smartphone size={15} className="shrink-0 text-primary-text" />
                  <span className="min-w-0 flex-1 truncate font-strong">{phone.device || '…'}</span>
                  <span className={cn('text-muted', phone.running && 'text-mint-text')}>
                    {phone.running ? t('live.running') : t('live.stopped')}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-auto flex flex-wrap justify-end gap-2 pt-1">
            <Tooltip content={t('live.newLinkHint')}>
              <Button icon={<RefreshCw size={15} />} onClick={() => void live.start(session, true)}>
                {t('live.newLink')}
              </Button>
            </Tooltip>
            {link && status !== 'ended' ? (
              <Button
                variant="danger"
                icon={<Square size={13} fill="currentColor" />}
                onClick={async () => {
                  await live.stop()
                  toast(t('live.revoked'))
                  onClose()
                }}
              >
                {t('live.revoke')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <section className="mt-5" aria-label={t('live.console')}>
        <h3 className="mb-1.5 text-ui-sm font-strong">{t('live.console')}</h3>
        <ol
          className="h-32 overflow-y-auto rounded-ui border border-border bg-surface-2/60 font-mono text-[12px]"
          data-testid="live-console"
          aria-live="polite"
        >
          {logs.length === 0 ? (
            <li className="flex h-full items-center justify-center px-4 text-center font-ui text-ui-sm text-muted">
              {t('live.consoleEmpty')}
            </li>
          ) : null}
          {logs.map((entry) => {
            const Icon = LOG_ICONS[entry.level]
            return (
              <li
                key={entry.id}
                className={cn(
                  'flex items-start gap-2 border-b border-border/60 px-2.5 py-1',
                  entry.level === 'error' && 'text-danger',
                )}
              >
                <Icon size={13} className="mt-0.5 shrink-0" aria-label={entry.level} />
                <span className="shrink-0 font-ui text-[11px] font-strong text-primary-text">
                  {entry.device}
                </span>
                <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                  {entry.message}
                </span>
              </li>
            )
          })}
        </ol>
      </section>
    </Dialog>
  )
}
