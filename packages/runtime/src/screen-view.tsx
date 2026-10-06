import { getComponentDef, resolveProps } from '@rublox/catalog'
import type { ComponentId, Locale, Screen, Theme } from '@rublox/schema'
import { type CSSProperties, type ReactNode, useMemo, useRef } from 'react'
import { RENDERERS } from './components/registry.ts'
import { commonStyle } from './styles.ts'
import { type Scheme, themeVariables } from './theme.ts'

export type ScreenViewProps = {
  screen: Screen
  locale: Locale
  /** Run (the player) or design (the editor canvas: no events, hidden components left out). */
  mode: 'run' | 'design'
  /** Values set while running, over the project's values. */
  overrides?: ReadonlyMap<ComponentId, Readonly<Record<string, unknown>>>
  emit?: (componentId: ComponentId, event: string, args?: Record<string, unknown>) => void
  setValue?: (componentId: ComponentId, prop: string, value: unknown) => void
  assetUrl?: (value: string) => string | undefined
  /** Renderers hand their imperative handle to the engine through this (run mode). */
  expose?: (componentId: ComponentId, handle: unknown) => void
  /** Lets the editor add elements (drop markers…) among a container's children. */
  decorateChildren?: (parentId: ComponentId, children: ReactNode[]) => ReactNode[]
}

const noop = () => {}
const httpsOnly = (value: string) =>
  /^https:\/\//i.test(value) || /^(blob:|data:(image|audio|video)\/)/i.test(value)
    ? value
    : undefined

/** Draws the component tree of a screen with the catalog renderers. */
export function ScreenView(props: ScreenViewProps): ReactNode {
  const design = props.mode === 'design'
  // One stable function per component, so that `useExpose` does not run on every render.
  const exposers = useRef(new Map<ComponentId, (handle: unknown) => void>())
  const exposeRef = useRef(props.expose)
  exposeRef.current = props.expose
  const exposeFor = (id: ComponentId) => {
    let fn = exposers.current.get(id)
    if (!fn) {
      fn = (handle: unknown) => exposeRef.current?.(id, handle)
      exposers.current.set(id, fn)
    }
    return fn
  }
  const render = (id: ComponentId): ReactNode => {
    const node = props.screen.components[id]
    if (!node) return null
    if (design && node.hidden) return null
    const Renderer = RENDERERS[node.type]
    const def = getComponentDef(node.type)
    if (!Renderer || !def) return null
    const values = {
      ...resolveProps(node.type, node.props, props.locale),
      ...props.overrides?.get(id),
    }
    let children: ReactNode[] | undefined
    if (def.container) {
      children = (node.children ?? []).map((child) => <Slot key={child}>{render(child)}</Slot>)
      if (props.decorateChildren) children = props.decorateChildren(id, children)
    }
    return (
      <Renderer
        id={id}
        name={node.name}
        props={values}
        style={commonStyle(values, design, node.props)}
        design={design}
        emit={(event, args) => props.emit?.(id, event, args)}
        expose={exposeFor(id)}
        setValue={(prop, value) => props.setValue?.(id, prop, value)}
        assetUrl={props.assetUrl ?? httpsOnly}
        locale={props.locale}
      >
        {children}
      </Renderer>
    )
  }
  return render(props.screen.rootId)
}

function Slot({ children }: { children: ReactNode }) {
  return children
}

/** The themed box an app is drawn in (the phone screen). */
export function AppSurface({
  theme,
  scheme,
  children,
  className,
  style,
}: {
  theme: Theme
  scheme: Scheme
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const variables = useMemo(() => themeVariables(theme, scheme), [theme, scheme])
  return (
    <div
      className={`rx-app${className ? ` ${className}` : ''}`}
      data-scheme={scheme}
      style={{ ...(variables as CSSProperties), ...style }}
    >
      {children}
    </div>
  )
}

export { noop }
