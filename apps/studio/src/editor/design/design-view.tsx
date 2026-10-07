import type { ScreenId } from '@rublox/schema'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, ResizeHandle } from '../../components/ui/panels.tsx'
import { Segmented } from '../../components/ui/segmented.tsx'
import { usePrefs } from '../../lib/prefs.ts'
import { AssetsPanel } from './assets.tsx'
import { Canvas } from './canvas.tsx'
import { Inspector } from './inspector.tsx'
import { Layers } from './layers.tsx'
import { Palette } from './palette.tsx'

/** Design: palette, layers and images on the left, the canvas, the inspector (SPEC § 5.3). */
export function DesignView({ screenId }: { screenId: ScreenId }) {
  const { t } = useTranslation()
  const mode = usePrefs((s) => s.mode)
  const [leftTab, setLeftTab] = useState<'layers' | 'assets'>('layers')
  return (
    <PanelGroup id={`design-${mode}`} className="h-full">
      <Panel
        id="left"
        defaultSize={mode === 'junior' ? '22%' : '18%'}
        minSize={200}
        maxSize="34%"
        className="flex h-full flex-col bg-surface"
      >
        <PanelGroup id={`design-left-${mode}`} orientation="vertical" className="h-full">
          <Panel id="palette" defaultSize="55%" minSize={120} className="flex h-full flex-col">
            <div className="flex h-full min-h-0 flex-col" data-tour="palette" data-tour-anchor>
              <Palette screenId={screenId} />
            </div>
          </Panel>
          <ResizeHandle orientation="vertical" />
          <Panel id="layers" minSize={120} className="flex h-full flex-col">
            <div className="flex items-center px-3 pt-2.5 pb-1">
              <Segmented
                label={t('editor.layers.title')}
                size="sm"
                value={leftTab}
                onChange={setLeftTab}
                className="w-full [&>*]:flex-1"
                options={[
                  { value: 'layers', label: t('editor.design.layers') },
                  { value: 'assets', label: t('editor.design.assets') },
                ]}
              />
            </div>
            {leftTab === 'layers' ? <Layers screenId={screenId} /> : <AssetsPanel />}
          </Panel>
        </PanelGroup>
      </Panel>
      <ResizeHandle />
      <Panel id="canvas" minSize="30%" className="h-full">
        <Canvas screenId={screenId} />
      </Panel>
      <ResizeHandle />
      <Panel
        id="inspector"
        defaultSize={mode === 'junior' ? '24%' : '20%'}
        minSize={240}
        maxSize="36%"
        className="h-full bg-surface"
      >
        <div className="h-full" data-tour="inspector">
          <Inspector screenId={screenId} />
        </div>
      </Panel>
    </PanelGroup>
  )
}
