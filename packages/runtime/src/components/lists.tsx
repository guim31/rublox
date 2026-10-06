import { messages } from '@rublox/i18n'
import { cssColor } from '../theme.ts'
import { type Renderer, type RendererProps, rootAttributes } from './types.ts'

type Item = { image?: string; title?: string; subtitle?: string }

function itemsOf(p: RendererProps): Item[] {
  return Array.isArray(p.props.items)
    ? p.props.items.map((item) =>
        item && typeof item === 'object' ? (item as Item) : { title: String(item) },
      )
    : []
}

function Empty({ p }: { p: RendererProps }) {
  return <p className="rx-list-empty">{messages[p.locale].catalog.runtime.noItems}</p>
}

export const ListViewRenderer: Renderer = (p) => {
  const items = Array.isArray(p.props.items) ? p.props.items.map(String) : []
  const dividers = p.props.dividers !== false
  return (
    <div {...rootAttributes(p, 'ListView')} className="rx-list" style={p.style}>
      {items.length === 0 ? <Empty p={p} /> : null}
      <ul aria-label={p.name}>
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: items may repeat
          <li key={i} className={dividers && i > 0 ? 'rx-list-divided' : undefined}>
            <button
              type="button"
              tabIndex={p.design ? -1 : undefined}
              style={{
                fontSize: Number(p.props.fontSize) || 16,
                color: cssColor(p.props.textColor) ?? 'var(--rx-text)',
              }}
              onClick={() => {
                if (p.design) return
                p.setValue('selectedItem', item)
                p.setValue('selectedIndex', i + 1)
                p.emit('itemClick', { item, index: i + 1 })
              }}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Thumb({ p, src, round }: { p: RendererProps; src: string | undefined; round?: boolean }) {
  const url = src ? p.assetUrl(src) : undefined
  return (
    <span className="rx-thumb" style={{ borderRadius: round ? '50%' : undefined }}>
      {url ? <img src={url} alt="" draggable={false} /> : null}
    </span>
  )
}

export const DataListRenderer: Renderer = (p) => {
  const items = itemsOf(p)
  const button = String(p.props.buttonText ?? '')
  const shape = String(p.props.imageShape ?? 'square')
  const card = cssColor(p.props.cardColor) ?? 'var(--rx-surface)'
  const pick = (i: number, item: Item) => {
    p.setValue('selectedIndex', i + 1)
    return { index: i + 1, title: item.title ?? '', subtitle: item.subtitle ?? '' }
  }
  return (
    <div
      {...rootAttributes(p, 'DataList')}
      className="rx-datalist"
      style={{ gap: Number(p.props.gap) || 0, ...p.style }}
    >
      {items.length === 0 ? <Empty p={p} /> : null}
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items have no identity of their own
        <div key={i} className="rx-card" style={{ background: card }}>
          <button
            type="button"
            className="rx-card-main"
            tabIndex={p.design ? -1 : undefined}
            onClick={() => !p.design && p.emit('itemClick', pick(i, item))}
          >
            {shape !== 'none' ? <Thumb p={p} src={item.image} round={shape === 'round'} /> : null}
            <span className="rx-card-text">
              <span className="rx-card-title">{item.title}</span>
              {item.subtitle ? <span className="rx-card-subtitle">{item.subtitle}</span> : null}
            </span>
          </button>
          {button ? (
            <button
              type="button"
              className="rx-card-button"
              tabIndex={p.design ? -1 : undefined}
              onClick={() => {
                if (p.design) return
                const { index, title } = pick(i, item)
                p.emit('buttonClick', { index, title })
              }}
            >
              {button}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export const DataGridRenderer: Renderer = (p) => {
  const items = itemsOf(p)
  const columns = Math.max(1, Math.round(Number(p.props.columns) || 2))
  const card = cssColor(p.props.cardColor) ?? 'var(--rx-surface)'
  return (
    <div
      {...rootAttributes(p, 'DataGrid')}
      className="rx-datagrid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: Number(p.props.gap) || 0,
        ...p.style,
      }}
    >
      {items.length === 0 ? <Empty p={p} /> : null}
      {items.map((item, i) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: items have no identity of their own
          key={i}
          type="button"
          className="rx-tile"
          style={{ background: card }}
          tabIndex={p.design ? -1 : undefined}
          onClick={() => {
            if (p.design) return
            p.setValue('selectedIndex', i + 1)
            p.emit('itemClick', { index: i + 1, title: item.title ?? '' })
          }}
        >
          <Thumb p={p} src={item.image} />
          <span className="rx-card-title">{item.title}</span>
        </button>
      ))}
    </div>
  )
}
