import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Badge, Section } from '../components/ui/field.tsx'
import { api, call } from '../lib/api.ts'
import { relativeTime } from '../lib/time.ts'

/** The usage journal of the assistant, for the administrator (SPEC § 4.12). */
export function AiJournal() {
  const { t, i18n } = useTranslation()
  const usage = useQuery({
    queryKey: ['admin', 'ai-usage'],
    queryFn: () => call(api.ai.usage.$get()),
  })
  const number = (value: number) => value.toLocaleString(i18n.language)
  const data = usage.data
  return (
    <Section title={t('ai.admin.journal')} description={t('ai.admin.journalText')}>
      {data ? (
        <>
          <p className="mb-3 text-ui-sm">
            {t('ai.admin.today', {
              requests: data.today.requests,
              input: number(data.today.inputTokens),
              output: number(data.today.outputTokens),
            })}
          </p>
          {data.entries.length === 0 ? (
            <p className="text-muted">{t('ai.admin.empty')}</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[640px] text-left text-ui-sm" data-testid="ai-journal">
                <thead className="sticky top-0 bg-surface text-muted">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-strong">{t('ai.admin.columns.who')}</th>
                    <th className="py-2 pr-3 font-strong">{t('ai.admin.columns.what')}</th>
                    <th className="py-2 pr-3 font-strong">{t('ai.admin.columns.model')}</th>
                    <th className="py-2 pr-3 font-strong">{t('ai.admin.columns.tokens')}</th>
                    <th className="py-2 pr-3 font-strong">{t('ai.admin.columns.outcome')}</th>
                    <th className="py-2 font-strong">{t('ai.admin.columns.when')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2 pr-3">
                        {entry.displayName} <span className="text-muted">@{entry.username}</span>
                      </td>
                      <td className="py-2 pr-3">{t(`ai.admin.kinds.${entry.kind}`)}</td>
                      <td className="py-2 pr-3 font-mono text-ui-sm">{entry.model}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {number(entry.inputTokens)} / {number(entry.outputTokens)}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          tone={
                            entry.outcome === 'ok'
                              ? 'success'
                              : entry.outcome === 'refused'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {t(`ai.admin.outcomes.${entry.outcome}`)}
                        </Badge>
                      </td>
                      <td className="py-2">{relativeTime(entry.createdAt, t, i18n.language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </Section>
  )
}
