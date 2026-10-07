import { Fragment, type ReactNode } from 'react'

/**
 * A small, safe Markdown subset for the Rich text component: headings (#, ##, ###), bullet
 * and numbered lists, paragraphs, **bold**, *italic*, `code` and [links](https://…). Text
 * never becomes HTML: everything is drawn as React elements.
 */
export function renderMarkdown(
  source: string,
  linkColor: string,
  interactive: boolean,
): ReactNode[] {
  const blocks: ReactNode[] = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const key = () => blocks.length

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(<p key={key()}>{inline(paragraph.join('\n'), linkColor, interactive)}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((item, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: static content
      <li key={i}>{inline(item, linkColor, interactive)}</li>
    ))
    blocks.push(list.ordered ? <ol key={key()}>{items}</ol> : <ul key={key()}>{items}</ul>)
    list = null
  }

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1]?.length ?? 1
      const content = inline(heading[2] ?? '', linkColor, interactive)
      blocks.push(
        level === 1 ? (
          <h1 key={key()}>{content}</h1>
        ) : level === 2 ? (
          <h2 key={key()}>{content}</h2>
        ) : (
          <h3 key={key()}>{content}</h3>
        ),
      )
    } else if (bullet || numbered) {
      flushParagraph()
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? numbered)?.[1] ?? '')
    } else if (!line.trim()) {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  flushParagraph()
  flushList()
  return blocks
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/

function inline(text: string, linkColor: string, interactive: boolean): ReactNode[] {
  const parts = text.split(INLINE).filter((part) => part !== '')
  return parts.map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
    <Fragment key={i}>{inlinePart(part, linkColor, interactive)}</Fragment>
  ))
}

function inlinePart(part: string, linkColor: string, interactive: boolean): ReactNode {
  if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
    return <strong>{inline(part.slice(2, -2), linkColor, interactive)}</strong>
  if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_')))
    return <em>{part.slice(1, -1)}</em>
  if (part.startsWith('`') && part.endsWith('`')) return <code>{part.slice(1, -1)}</code>
  const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
  if (!link) return part
  const href = link[2] ?? ''
  if (/^(https?:|mailto:)/i.test(href) && interactive) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: linkColor }}>
        {link[1]}
      </a>
    )
  }
  return <span style={{ color: linkColor, textDecoration: 'underline' }}>{link[1]}</span>
}
