import { componentLabel, paletteFor } from '@rublox/catalog'
import type { ScreenId } from '@rublox/schema'
import {
  ClipboardPaste,
  Copy,
  Layers,
  Palette,
  Plus,
  Puzzle,
  Redo2,
  RotateCw,
  Scissors,
  Square,
  Terminal,
  Undo2,
} from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { type Command, useCommands } from '../lib/commands.ts'
import { AI_TYPES, useFeatures } from '../lib/features.ts'
import { isMod, isTyping, useKeydown } from '../lib/hotkeys.ts'
import { usePrefs } from '../lib/prefs.ts'
import type { EditorTab } from '../routes/p.$projectId.tsx'
import { addComponentOfType, addNewScreen, deleteComponent, duplicate } from './actions.ts'
import {
  copySelection,
  pastePayload,
  readPayload,
  selectedIds,
  storedPayload,
} from './clipboard.ts'
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
  const { t: tc } = useTranslation('catalog')
  const session = useSession()
  const go = useEditorNavigate(projectId)
  const { mode, locale } = usePrefs()
  const aiOn = useFeatures().ai !== null

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
        run: () => usePrefs.getState().toggleConsole(),
      },
      {
        id: 'copy',
        group: 'editor',
        label: tc('studio.clipboard.copy'),
        icon: <Copy size={16} />,
        shortcut: 'Mod+C',
        run: () => {
          if (copySelection(session, screenId)) toast(tc('studio.clipboard.copied'))
        },
      },
      {
        id: 'cut',
        group: 'editor',
        label: tc('studio.clipboard.cutAction'),
        icon: <Scissors size={16} />,
        shortcut: 'Mod+X',
        run: () => {
          if (copySelection(session, screenId, true)) toast(tc('studio.clipboard.cut'))
        },
      },
      {
        id: 'paste',
        group: 'editor',
        label: tc('studio.clipboard.paste'),
        icon: <ClipboardPaste size={16} />,
        shortcut: 'Mod+V',
        run: () => {
          const payload = storedPayload()
          if (!payload) return void toast(tc('studio.clipboard.empty'))
          if (tab !== 'design') void go({ tab: 'design' })
          pastePayload(session, screenId, payload)
        },
      },
      {
        id: 'app-settings',
        group: 'editor',
        label: tc('studio.app.open'),
        icon: <Palette size={16} />,
        run: () => {
          if (tab !== 'design') void go({ tab: 'design' })
          const root = session.getDoc().screens[screenId]?.rootId ?? null
          useEditor.getState().select(root)
          useEditor.getState().set({ inspectorTab: 'app' })
        },
      },
      ...paletteFor(mode).flatMap(({ components }) =>
        components
          .filter((def) => aiOn || !AI_TYPES.includes(def.type))
          .map(
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
  }, [t, tc, go, session, mode, locale, tab, screenId, aiOn])

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
    const all = selectedIds()
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      session.ydoc.transact(() => {
        for (const id of all) deleteComponent(session, screenId, id)
      })
    } else if (isMod(event) && key === 'd') {
      event.preventDefault()
      session.ydoc.transact(() => {
        for (const id of all) duplicate(session, screenId, id)
      })
    } else if (key === 'escape') {
      useEditor.getState().select(null)
    }
  })

  // Copy, cut and paste go through the browser's events: they read and write the system
  // clipboard without asking for a permission.
  useEffect(() => {
    if (tab !== 'design') return
    const inEditorArea = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return true
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return false
      return !target.closest('[role="dialog"], [role="menu"]')
    }
    const onCopy = (event: ClipboardEvent, cut: boolean) => {
      if (!inEditorArea(event) || session.readOnly) return
      const text = copySelection(session, screenId, cut)
      if (!text) return
      event.preventDefault()
      event.clipboardData?.setData('text/plain', text)
      useEditor.getState().announce(tc(cut ? 'studio.clipboard.cut' : 'studio.clipboard.copied'))
    }
    const copy = (event: ClipboardEvent) => onCopy(event, false)
    const cut = (event: ClipboardEvent) => onCopy(event, true)
    const paste = (event: ClipboardEvent) => {
      if (!inEditorArea(event) || session.readOnly) return
      const payload = readPayload(event.clipboardData?.getData('text/plain')) ?? storedPayload()
      if (!payload) return
      event.preventDefault()
      const pasted = pastePayload(session, screenId, payload)
      useEditor.getState().announce(tc('studio.clipboard.pasted', { count: pasted.length }))
    }
    document.addEventListener('copy', copy)
    document.addEventListener('cut', cut)
    document.addEventListener('paste', paste)
    return () => {
      document.removeEventListener('copy', copy)
      document.removeEventListener('cut', cut)
      document.removeEventListener('paste', paste)
    }
  }, [tab, session, screenId, tc])

  return null
}
