import { type GeneratedCode, generateProjectCode } from '@rublox/blocks'
import { APP_WORKSPACE, type ProjectDoc, type ScreenId, type WorkspaceKey } from '@rublox/schema'
import { Code2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAiPanel } from '../../ai/store.ts'
import { Button } from '../../components/ui/button.tsx'
import { Panel, PanelGroup, ResizeHandle } from '../../components/ui/panels.tsx'
import { Switch } from '../../components/ui/switch.tsx'
import { useFeatures } from '../../lib/features.ts'
import { usePrefs } from '../../lib/prefs.ts'
import { useDoc } from '../context.tsx'
import { Preview } from '../preview/preview.tsx'
import { useEditor } from '../store.ts'
import { CodeView } from './code-view.tsx'
import { PromptDialog } from './prompt.tsx'
import { BlocksWorkspace } from './workspace.tsx'

const GENERATE_DELAY_MS = 120

/** Regenerates the modules shortly after each change (the preview updates within ~300 ms). */
function useGeneratedCode(
  doc: ProjectDoc,
  slow: boolean,
): {
  doc: ProjectDoc
  code: Record<WorkspaceKey, GeneratedCode>
  shown: Record<WorkspaceKey, GeneratedCode>
} {
  // The code view shows the readable code; the preview runs the slow variant when needed.
  const make = () => {
    const code = generateProjectCode(doc)
    return { doc, slow, code, shown: code, run: slow ? generateProjectCode(doc, { slow }) : code }
  }
  const [state, setState] = useState(make)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `make` reads doc and slow
  useEffect(() => {
    if (state.doc === doc && state.slow === slow) return
    const timer = setTimeout(() => setState(make()), state.slow === slow ? GENERATE_DELAY_MS : 0)
    return () => clearTimeout(timer)
  }, [doc, slow, state.doc, state.slow])
  return { doc: state.doc, code: state.run, shown: state.shown }
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
  const slow = useEditor((s) => s.slow.enabled)
  const generated = useGeneratedCode(doc, slow)
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
              <div className="flex-1" />
              <ExplainScreenButton workspace={workspace} />
            </div>
          ) : null}
          <div className="relative min-h-0 flex-1">
            {mode === 'studio' ? (
              <div className="absolute top-2 right-3 z-10">
                <ExplainScreenButton workspace={workspace} />
              </div>
            ) : null}
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
                <CodeView code={generated.shown[workspace]?.code ?? ''} />
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

/** "Explain this screen" (J6), when this account may ask the assistant. */
function ExplainScreenButton({ workspace }: { workspace: WorkspaceKey }) {
  const { t } = useTranslation()
  const features = useFeatures()
  const previewScreen = useDoc().screenOrder[0]
  if (!features.ai) return null
  const screen = workspace === APP_WORKSPACE ? previewScreen : workspace
  if (!screen) return null
  return (
    <Button
      size="sm"
      icon={<Sparkles size={15} className="text-primary" />}
      data-testid="ai-explain-screen"
      onClick={() =>
        useAiPanel.getState().open({ kind: 'explain', target: 'screen', workspace: screen })
      }
    >
      {t('ai.explain.screen')}
    </Button>
  )
}
