import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn.ts'

/** How many entries of an object or a list are shown before "… and N more". */
const SHOWN = 50

/** `current` + `temperature` → `current.temperature`; an index → `[0]`. */
export function childPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`
  return parent ? `${parent}.${key}` : key
}

function preview(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string')
    return JSON.stringify(value.length > 80 ? `${value.slice(0, 80)}…` : value)
  if (typeof value === 'object') return Array.isArray(value) ? `[${value.length}]` : '{…}'
  return String(value)
}

/**
 * The answer of an API as a tree (SPEC § 4.5). Each field is a button: `onPick(path)` creates
 * the block that reads it. Objects and lists open and close.
 */
export function JsonTree({ value, onPick }: { value: unknown; onPick: (path: string) => void }) {
  if (value === null || typeof value !== 'object') {
    return (
      <pre className="whitespace-pre-wrap break-words">
        {typeof value === 'string' ? value : preview(value)}
      </pre>
    )
  }
  return (
    <ul className="flex flex-col">
      <Children value={value} path="" depth={0} onPick={onPick} />
    </ul>
  )
}

function Children({
  value,
  path,
  depth,
  onPick,
}: {
  value: object
  path: string
  depth: number
  onPick: (path: string) => void
}) {
  const { t } = useTranslation()
  const entries: [string | number, unknown][] = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value)
  return (
    <>
      {entries.slice(0, SHOWN).map(([key, child]) => (
        <Node
          key={String(key)}
          name={key}
          value={child}
          path={childPath(path, key)}
          depth={depth}
          onPick={onPick}
        />
      ))}
      {entries.length > SHOWN ? (
        <li className="py-0.5 text-muted" style={{ paddingLeft: depth * 16 + 20 }}>
          {t('data.api.more', { count: entries.length - SHOWN })}
        </li>
      ) : null}
    </>
  )
}

function Node({
  name,
  value,
  path,
  depth,
  onPick,
}: {
  name: string | number
  value: unknown
  path: string
  depth: number
  onPick: (path: string) => void
}) {
  const branch = value !== null && typeof value === 'object'
  const [open, setOpen] = useState(depth < 1)
  return (
    <li>
      <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: depth * 16 }}>
        {branch ? (
          <button
            type="button"
            aria-label={String(name)}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="grid size-4 place-items-center rounded text-muted hover:bg-surface-2"
          >
            <ChevronRight size={12} className={cn('transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          <span className="size-4" />
        )}
        <button
          type="button"
          title={path}
          onClick={() => onPick(path)}
          className="rounded px-1 font-strong text-primary-text hover:bg-primary-soft focus-visible:bg-primary-soft"
        >
          {typeof name === 'number' ? `[${name}]` : name}
        </button>
        <span className="truncate text-muted">
          {branch && open ? (Array.isArray(value) ? `[${value.length}]` : '') : preview(value)}
        </span>
      </div>
      {branch && open ? (
        <ul>
          <Children value={value as object} path={path} depth={depth + 1} onPick={onPick} />
        </ul>
      ) : null}
    </li>
  )
}
