import type { UiMode } from '@rublox/schema'
import * as Blockly from 'blockly/core'
import { type BlockCategory, CATEGORY_COLORS } from './colors.ts'

/** Blockly's own style names, mapped to our categories. */
const BUILTIN_STYLES: Record<string, BlockCategory> = {
  logic: 'logic',
  loop: 'control',
  math: 'math',
  text: 'text',
  list: 'lists',
  variable: 'variables',
  variable_dynamic: 'variables',
  procedure: 'functions',
  colour: 'colour',
}

const OWN_STYLES: Record<string, BlockCategory> = {
  rx_event: 'events',
  rx_component: 'components',
  rx_screen: 'screens',
  rx_interface: 'interface',
  rx_debug: 'debug',
}

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const value = (n >> shift) & 0xff
    const target = amount < 0 ? 0 : 255
    return Math.round(value + (target - value) * Math.abs(amount))
  }
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`
}

const themes = new Map<string, Blockly.Theme>()

/**
 * The Blockly theme of a mode (Junior: round font, Studio: compact) in light or dark. Colours
 * come from `CATEGORY_COLORS`; the workspace follows the studio's surfaces.
 */
export function blocklyTheme(mode: UiMode, dark: boolean): Blockly.Theme {
  const name = `rublox-${mode}-${dark ? 'dark' : 'light'}`
  const cached = themes.get(name)
  if (cached) return cached
  const blockStyles: Record<string, Partial<Blockly.Theme.BlockStyle>> = {}
  const categoryStyles: Record<string, Blockly.Theme.CategoryStyle> = {}
  for (const [style, category] of Object.entries({
    ...BUILTIN_STYLES,
    ...OWN_STYLES,
  })) {
    const colour = CATEGORY_COLORS[category]
    blockStyles[`${style}_blocks`] = {
      colourPrimary: colour,
      colourSecondary: shade(colour, dark ? -0.25 : 0.35),
      colourTertiary: shade(colour, -0.25),
      ...(style === 'rx_event' ? { hat: 'cap' } : {}),
    }
    categoryStyles[`${style}_category`] = { colour }
  }
  const theme = Blockly.Theme.defineTheme(name, {
    name,
    base: Blockly.Themes.Classic,
    blockStyles,
    categoryStyles,
    componentStyles: dark
      ? {
          workspaceBackgroundColour: '#14131c',
          toolboxBackgroundColour: '#1c1b26',
          toolboxForegroundColour: '#e8e6f2',
          flyoutBackgroundColour: '#23222f',
          flyoutForegroundColour: '#d6d3e6',
          flyoutOpacity: 0.98,
          scrollbarColour: '#4a4860',
          insertionMarkerColour: '#ffffff',
          insertionMarkerOpacity: 0.35,
          cursorColour: '#ffd166',
          selectedGlowColour: '#ffd166',
        }
      : {
          workspaceBackgroundColour: '#f7f6fb',
          toolboxBackgroundColour: '#ffffff',
          toolboxForegroundColour: '#2a2838',
          flyoutBackgroundColour: '#efedf7',
          flyoutForegroundColour: '#2a2838',
          flyoutOpacity: 0.98,
          scrollbarColour: '#b9b5cc',
          insertionMarkerColour: '#000000',
          insertionMarkerOpacity: 0.25,
          cursorColour: '#5b4bff',
          selectedGlowColour: '#5b4bff',
        },
    fontStyle:
      mode === 'junior'
        ? {
            family: '"Nunito Variable", Nunito, system-ui, sans-serif',
            weight: '700',
            size: 12,
          }
        : {
            family: '"Inter Variable", Inter, system-ui, sans-serif',
            weight: '500',
            size: 11,
          },
    startHats: mode === 'junior',
  })
  themes.set(name, theme)
  return theme
}

/** Junior uses Zelos (Scratch-like), Studio Thrasos (compact). */
export function rendererFor(mode: UiMode): 'zelos' | 'thrasos' {
  return mode === 'junior' ? 'zelos' : 'thrasos'
}

export type InjectOptions = {
  mode: UiMode
  dark: boolean
  toolbox: Blockly.utils.toolbox.ToolboxDefinition
  readOnly?: boolean
}

/** Creates a workspace with Rublox's options: no sounds or media fetched from elsewhere. */
export function injectWorkspace(element: Element, options: InjectOptions): Blockly.WorkspaceSvg {
  return Blockly.inject(element, {
    renderer: rendererFor(options.mode),
    theme: blocklyTheme(options.mode, options.dark),
    toolbox: options.toolbox,
    readOnly: options.readOnly ?? false,
    sounds: false,
    media: '/blockly-media/',
    oneBasedIndex: true,
    trashcan: true,
    comments: true,
    collapse: true,
    disable: true,
    grid: {
      spacing: 24,
      length: 2,
      colour: options.dark ? '#2b2a38' : '#dedbea',
      snap: true,
    },
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: {
      controls: true,
      wheel: false,
      startScale: options.mode === 'junior' ? 0.9 : 0.85,
      maxScale: 2,
      minScale: 0.4,
      scaleSpeed: 1.15,
      pinch: true,
    },
  })
}
