import { arg, type EventDef, event, type Localized, type PropDef, prop } from './define.ts'

/** Properties every visible component has (SPEC § 4.4). */
export function commonProps(): Record<string, PropDef> {
  return {
    visible: prop.boolean({
      default: true,
      group: 'layout',
      junior: true,
      blocks: 'get-set',
    }),
    width: prop.size({
      default: 'auto',
      group: 'layout',
      junior: true,
      blocks: 'get-set',
    }),
    height: prop.size({
      default: 'auto',
      group: 'layout',
      junior: true,
      blocks: 'get-set',
    }),
    grow: prop.boolean({ default: false, group: 'layout' }),
    alignSelf: prop.enum(['auto', 'start', 'center', 'end', 'stretch'], {
      default: 'auto',
      group: 'layout',
    }),
    margin: prop.spacing({ default: 0, group: 'layout' }),
    padding: prop.spacing({ default: 0, group: 'layout' }),
    background: prop.color({ default: '', group: 'style', blocks: 'get-set' }),
    borderWidth: prop.number({ default: 0, min: 0, max: 32, group: 'style' }),
    borderColor: prop.color({ default: '@border', group: 'style' }),
    radius: prop.number({ default: 0, min: 0, max: 999, group: 'style' }),
    shadow: prop.enum(['none', 'small', 'medium', 'large'], {
      default: 'none',
      group: 'style',
    }),
    opacity: prop.number({
      default: 100,
      min: 0,
      max: 100,
      step: 5,
      group: 'style',
      blocks: 'get-set',
    }),
  }
}

/** Flex layout of a container's children (Screen, Row, Column). */
export function containerProps(direction: 'row' | 'column'): Record<string, PropDef> {
  return {
    gap: prop.number({
      default: direction === 'row' ? 8 : 12,
      min: 0,
      max: 200,
      group: 'layout',
      junior: true,
    }),
    alignItems: prop.enum(['start', 'center', 'end', 'stretch'], {
      default: direction === 'row' ? 'center' : 'stretch',
      group: 'layout',
      junior: true,
    }),
    justify: prop.enum(['start', 'center', 'end', 'between', 'around'], {
      default: 'start',
      group: 'layout',
      junior: true,
    }),
    wrap: prop.boolean({ default: false, group: 'layout' }),
  }
}

export const COMMON_STRINGS: Localized<{
  props: Record<string, string>
  enums: Record<string, Record<string, string>>
}> = {
  fr: {
    props: {
      visible: 'visible',
      width: 'largeur',
      height: 'hauteur',
      grow: 'grandir pour remplir',
      alignSelf: 'alignement dans le parent',
      margin: 'marges',
      padding: 'espacement interne',
      background: 'fond',
      borderWidth: 'épaisseur de bordure',
      borderColor: 'couleur de bordure',
      radius: 'arrondi',
      shadow: 'ombre',
      opacity: 'opacité',
      gap: 'écart',
      alignItems: 'alignement',
      justify: 'répartition',
      wrap: 'retour à la ligne',
    },
    enums: {
      alignItems: {
        start: 'Début',
        center: 'Centre',
        end: 'Fin',
        stretch: 'Étirer',
      },
      justify: {
        start: 'Au début',
        center: 'Au centre',
        end: 'À la fin',
        between: 'Espacés',
        around: 'Répartis',
      },
      alignSelf: {
        auto: 'Comme le parent',
        start: 'Début',
        center: 'Centre',
        end: 'Fin',
        stretch: 'Étirer',
      },
      shadow: {
        none: 'Aucune',
        small: 'Légère',
        medium: 'Moyenne',
        large: 'Forte',
      },
    },
  },
  en: {
    props: {
      visible: 'visible',
      width: 'width',
      height: 'height',
      grow: 'grow to fill',
      alignSelf: 'align in parent',
      margin: 'margin',
      padding: 'padding',
      background: 'background',
      borderWidth: 'border width',
      borderColor: 'border color',
      radius: 'corner radius',
      shadow: 'shadow',
      opacity: 'opacity',
      gap: 'gap',
      alignItems: 'alignment',
      justify: 'distribution',
      wrap: 'wrap',
    },
    enums: {
      alignItems: {
        start: 'Start',
        center: 'Center',
        end: 'End',
        stretch: 'Stretch',
      },
      justify: {
        start: 'At the start',
        center: 'In the center',
        end: 'At the end',
        between: 'Space between',
        around: 'Space around',
      },
      alignSelf: {
        auto: 'Like the parent',
        start: 'Start',
        center: 'Center',
        end: 'End',
        stretch: 'Stretch',
      },
      shadow: {
        none: 'None',
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
      },
    },
  },
}

/**
 * Browser features are not everywhere (SPEC § 4.4): a component that needs one has an
 * `available` state property, set when the app starts.
 */
export function availableProp(): Record<string, PropDef> {
  return { available: prop.boolean({ default: true, group: 'advanced', state: true }) }
}

/** The explicit error event of a component that needs a browser feature or a permission. */
export function errorEvent(): Record<string, EventDef> {
  return { error: event({ args: { message: arg('string') } }) }
}

/** Labels of `availableProp` and `errorEvent`, merged by `defineComponent` when used. */
export const DEVICE_STRINGS: Localized<{
  props: Record<string, string>
  events: Record<string, string>
  args: Record<string, string>
}> = {
  fr: {
    props: { available: 'disponible' },
    events: { error: 'quand %1 a un problème' },
    args: { message: 'message' },
  },
  en: {
    props: { available: 'available' },
    events: { error: 'when %1 has a problem' },
    args: { message: 'message' },
  },
}
