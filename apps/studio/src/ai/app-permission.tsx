import type { ProjectDoc } from '@rublox/schema'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Switch } from '../components/ui/switch.tsx'
import { api, call } from '../lib/api.ts'
import { errorMessage } from '../lib/errors.ts'
import { AI_TYPES, useFeatures } from '../lib/features.ts'

const permission = api.ai.projects[':projectId']

/** Whether a project uses the AI component. */
export function usesAi(doc: ProjectDoc): boolean {
  return Object.values(doc.screens).some((screen) =>
    Object.values(screen.components).some((node) => AI_TYPES.includes(node.type)),
  )
}

/**
 * "Allow AI in the published app" (SPEC § 4.12): the owner pays for the questions of the AI
 * component of their published app, so it stays off until they allow it.
 */
export function AppAiPermission({ projectId, doc }: { projectId: string; doc: ProjectDoc }) {
  const { t } = useTranslation()
  const { aiConfigured } = useFeatures()
  const client = useQueryClient()
  const shown = aiConfigured && usesAi(doc)
  const key = ['ai-permission', projectId]
  const state = useQuery({
    queryKey: key,
    queryFn: () => call(permission.$get({ param: { projectId } })),
    enabled: shown,
  })
  if (!shown || !state.data) return null
  return (
    <div
      className="mt-4 flex items-start gap-3 rounded-ui bg-primary-soft p-3"
      data-testid="ai-permission"
    >
      <Sparkles size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <label htmlFor="ai-in-app" className="font-strong">
          {t('ai.app.allow')}
        </label>
        <p className="text-ui-sm text-muted">{t('ai.app.allowText')}</p>
      </div>
      <Switch
        id="ai-in-app"
        checked={state.data.allowInApp}
        onChange={async (value) => {
          try {
            await call(permission.$put({ param: { projectId }, json: { allowInApp: value } }))
            toast.success(value ? t('ai.app.allowed') : t('ai.app.notAllowed'))
            await client.invalidateQueries({ queryKey: key })
          } catch (error) {
            toast.error(errorMessage(t, error))
          }
        }}
      />
    </div>
  )
}
