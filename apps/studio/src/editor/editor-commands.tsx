import { componentLabel, paletteFor } from '@rublox/catalog'
import type { ScreenId } from '@rublox/schema'
import { Layers, Plus, Puzzle, Redo2, RotateCw, Square, Terminal, Undo2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { type Command, useCommands } from '../lib/commands.ts'
import { isMod, isTyping, useKeydown } from '../lib/hotkeys.ts'
import { usePrefs } from '../lib/prefs.ts'
import type { EditorTab } from '../routes/p.$projectId.tsx'
import { addComponentOfType, addNewScreen, deleteComponent, duplicate } from './actions.ts'
import { ComponentIcon } from './component-icon.tsx'
import { useSession } from './context.tsx'
import { freeKey } from './design/free-layout.ts'
import { useEditorNavigate } from './nav.ts'
import { useEditor } from './store.ts'

/** Keyboard shortcuts and command palette entries of the editor (SPEC § 5.1). */
export function EditorCommands({
  projectId,
  tab,
  screenId,
}: {
  projectId: string
  tab: EditorTab
  screenId: ScreenId
}) {
  const { t } = useTranslation()
  const session = useSession()
  const go = useEditorNavigate(projectId)
  const { mode, locale } = usePrefs()

  useEffect(() => {
    const commands: Command[] = [
      {
        id: 'design',
        group: 'editor',
        label: t('commands.design'),
        icon: <Layers size={16} />,
        run: () => go({ tab: 'design' }),
      },
      {
        id: 'blocks',
        group: 'editor',
        label: t('commands.blocks'),
        icon: <Puzzle size={16} />,
        run: () => go({ tab: 'blocks' }),
      },
      {
        id: 'undo',
        group: 'editor',
        label: t('commands.undo'),
        icon: <Undo2 size={16} />,
        shortcut: 'Mod+Z',
        run: () => session.undo.undo(),
      },
      {
        id: 'redo',
        group: 'editor',
        label: t('commands.redo'),
        icon: <Redo2 size={16} />,
        shortcut: 'Mod+Shift+Z',
        run: () => session.undo.redo(),
      },
      {
        id: 'add-screen',
        group: 'editor',
        label: t('commands.addScreen'),
        icon: <Plus size={16} />,
        run: () => go({ screen: addNewScreen(session) }),
      },
      {
        id: 'restart',
        group: 'editor',
        label: t('commands.restart'),
        icon: <RotateCw size={16} />,
        run: () => useEditor.getState().preview?.restart(),
      },
      {
        id: 'stop',
        group: 'editor',
        label: t('commands.stop'),
        icon: <Square size={16} />,
        run: () => useEditor.getState().preview?.stop(),
      },
      {
        id: 'console',
        group: 'editor',
        label: t('commands.toggleConsole'),
        icon: <Terminal size={16} />,
        run: () => usePrefs.getState().set({ consoleOpen: !usePrefs.getState().consoleOpen }),
      },
      ...paletteFor(mode).flatMap(({ components }) =>
        components.map(
          (def): Command => ({
            id: `add-${def.type}`,
            group: 'add',
            label: t('commands.add', { name: componentLabel(def.type, locale) }),
            icon: <ComponentIcon type={def.type} />,
            keywords: [def.type],
            run: () => {
              if (tab !== 'design') void go({ tab: 'design' })
              addComponentOfType(session, screenId, def.type, locale)
            },
          }),
        ),
      ),
    ]
    useCommands.getState().setPage(commands)
    return () => useCommands.getState().setPage([])
  }, [t, go, session, mode, locale, tab, screenId])

  useKeydown((event) => {
    if (useCommands.getState().open) return
    const key = event.key.toLowerCase()
    if (isMod(event) && (key === 'z' || key === 'y')) {
      if (isTyping(event)) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) session.undo.redo()
      else session.undo.undo()
      return
    }
    if (tab !== 'design' || isTyping(event)) return
    const target = event.target as HTMLElement
    if (target.closest('[role="tree"], [role="dialog"], [role="menu"]')) return
    const selected = useEditor.getState().selected
    if (!selected) return
    // A sprite or a scene text: arrows move it, Alt + arrows resize it, R turns it.
    if (freeKey(session, screenId, selected, event)) {
      event.preventDefault()
      return
    }
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      deleteComponent(session, screenId, selected)
    } else if (isMod(event) && key === 'd') {
      event.preventDefault()
      duplicate(session, screenId, selected)
    } else if (key === 'escape') {
      useEditor.getState().select(null)
    }
  })

  return null
}
