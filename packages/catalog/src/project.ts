import {
  type ComponentNode,
  DEFAULT_THEME,
  type Locale,
  type NewScreen,
  newId,
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  type ProjectDoc,
  type UiMode,
  uniqueName,
} from '@rublox/schema'
import { getComponentDef, isLocalized, SCREEN_TYPE } from './registry.ts'

export class UnknownComponentError extends Error {
  override name = 'UnknownComponentError'
}

/**
 * A new component of `type`, named `<prefix>N` with the first free N. Localized defaults
 * (the text of a button…) are written in `locale`, so that the project does not change
 * language with the interface.
 */
export function createComponent(
  type: string,
  locale: Locale,
  takenNames: Iterable<string>,
): ComponentNode {
  const def = getComponentDef(type)
  if (!def) throw new UnknownComponentError(type)
  const props: Record<string, unknown> = {}
  for (const [key, propDef] of Object.entries(def.props)) {
    if (isLocalized(propDef.default) && !propDef.state) props[key] = propDef.default[locale]
  }
  const node: ComponentNode = {
    type,
    name: uniqueName(def.strings[locale].prefix, takenNames),
    props,
  }
  if (def.container) node.children = []
  return node
}

const FIRST_SCREEN: Record<Locale, string> = { fr: 'Accueil', en: 'Home' }

/** Input for `addScreen`: a screen named `Ecran2`, `Ecran3`… (or `Screen2` in English). */
export function createScreen(locale: Locale, takenNames: Iterable<string>): NewScreen {
  const prefix = getComponentDef(SCREEN_TYPE)?.strings[locale].prefix ?? 'Screen'
  // The first screen counts as number 1, whatever its name: the next one is `Ecran2`.
  const name = uniqueName(prefix, [...takenNames, `${prefix}1`])
  return { name, root: { type: SCREEN_TYPE, name, props: {}, children: [] } }
}

export type NewProject = {
  id?: string
  name: string
  locale: Locale
  mode: UiMode
  now?: Date
}

/** A new project: one empty screen, the default theme, stack navigation. */
export function createProject(input: NewProject): ProjectDoc {
  const screenId = newId()
  const rootId = newId()
  const now = (input.now ?? new Date()).toISOString()
  const screenName = FIRST_SCREEN[input.locale]
  return {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    meta: {
      id: input.id ?? newId(),
      name: input.name,
      mode: input.mode,
      locale: input.locale,
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      theme: { ...DEFAULT_THEME },
      navigation: { kind: 'stack', startScreen: screenId },
      orientation: 'portrait',
    },
    screenOrder: [screenId],
    screens: {
      [screenId]: {
        name: screenName,
        rootId,
        components: {
          [rootId]: {
            type: SCREEN_TYPE,
            name: screenName,
            props: {},
            children: [],
          },
        },
        nonVisual: [],
      },
    },
    blocks: {},
    variables: { app: [], stored: [], shared: [] },
    assets: {},
    data: { tables: {}, apis: {} },
  }
}
