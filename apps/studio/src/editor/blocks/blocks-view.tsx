import { type GeneratedCode, generateProjectCode } from '@rublox/blocks'
import type { ProjectDoc, ScreenId, WorkspaceKey } from '@rublox/schema'
import { Code2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, ResizeHandle } from '../../components/ui/panels.tsx'
import { Switch } from '../../components/ui/switch.tsx'
import { usePrefs } from '../../lib/prefs.ts'
import { useDoc } from '../context.tsx'
import { Preview } from '../preview/preview.tsx'
import { CodeView } from './code-view.tsx'
import { PromptDialog } from './prompt.tsx'
import { BlocksWorkspace } from './workspace.tsx'

const GENERATE_DELAY_MS = 120

/** Regenerates the modules shortly after each change (the preview updates within ~300 ms). */
function useGeneratedCode(doc: ProjectDoc): {
  doc: ProjectDoc
  code: Record<WorkspaceKey, GeneratedCode>
} {
  const [state, setState] = useState(() => ({ doc, code: generateProjectCode(doc) }))
  useEffect(() => {
    if (state.doc === doc) return
    const timer = setTimeout(
      () => setState({ doc, code: generateProjectCode(doc) }),
      GENERATE_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [doc, state.doc])
  return state
}

/**
 * Blocks: the toolbox and workspace, the live preview next to it and, in Studio, the code
 * (SPEC § 5.3).
 */
export default function BlocksView({
  workspace,
  previewScreen,
}: {
  projectId: string
  workspace: WorkspaceKey
  previewScreen: ScreenId
}) {
  const { t } = useTranslation()
  const doc = useDoc()
  const generated = useGeneratedCode(doc)
  const { mode, juniorCode, moreBlocks, set } = usePrefs()
  const showCode = mode === 'studio' || juniorCode
  const label = `${t('editor.blocks.workspace')} — ${doc.screens[workspace]?.name ?? t('editor.screens.appShort')}`
  return (
    <>
      <PanelGroup id={`blocks-${mode}-${showCode}`} className="h-full">
        <Panel id="workspace" minSize="35%" className="relative flex h-full flex-col">
          {mode === 'junior' ? (
            <div className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-surface px-3">
              <label
                htmlFor="more-blocks"
                className="flex cursor-pointer items-center gap-2 font-strong"
              >
                <Switch
                  id="more-blocks"
                  checked={moreBlocks}
                  onChange={(value) => set({ moreBlocks: value })}
                />
                <Sparkles size={16} className="text-yellow" />
                {t('editor.blocks.moreBlocks')}
              </label>
              <label
                htmlFor="junior-code"
                className="flex cursor-pointer items-center gap-2 font-strong"
              >
                <Switch
                  id="junior-code"
                  checked={juniorCode}
                  onChange={(value) => set({ juniorCode: value })}
                />
                <Code2 size={16} className="text-primary-text" />
                {t('editor.blocks.showCode')}
              </label>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <BlocksWorkspace key={workspace} workspaceKey={workspace} label={label} />
          </div>
        </Panel>
        <ResizeHandle />
        <Panel
          id="side"
          defaultSize={showCode ? '34%' : '28%'}
          minSize={260}
          maxSize="50%"
          className="h-full"
        >
          {showCode ? (
            <PanelGroup id={`blocks-side-${mode}`} orientation="vertical" className="h-full">
              <Panel id="preview" defaultSize="58%" minSize={200} className="h-full">
                <Preview doc={generated.doc} code={generated.code} screenId={previewScreen} />
              </Panel>
              <ResizeHandle orientation="vertical" />
              <Panel id="code" minSize={120} className="h-full bg-surface">
                <CodeView code={generated.code[workspace]?.code ?? ''} />
              </Panel>
            </PanelGroup>
          ) : (
            <Preview doc={generated.doc} code={generated.code} screenId={previewScreen} />
          )}
        </Panel>
      </PanelGroup>
      <PromptDialog />
    </>
  )
}
