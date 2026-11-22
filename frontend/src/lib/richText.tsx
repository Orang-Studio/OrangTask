import { Fragment, type ReactNode } from 'react'
import { safeHttpUrl } from './safeUrl'

const INLINE = /(\[[^\]\n]*\]\([^)\s]+\)|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`)/g
const LINK = /^\[([^\]\n]*)\]\(([^)\s]+)\)$/

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`
    const link = part.match(LINK)
    if (link) {
      const href = safeHttpUrl(link[2])
      if (!href) return <Fragment key={key}>{part}</Fragment>
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-600 dark:text-orange-400 underline break-words"
        >
          {link[1] || href}
        </a>
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return <span key={key} className="line-through opacity-70">{part.slice(2, -2)}</span>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="text-[0.85em] bg-gray-100 dark:bg-ink-900 px-1 py-0.5">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

type Bullet = { text: string; checked: boolean | null }

export function renderRichText(content: string): ReactNode {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []

  let bullets: Bullet[] = []
  let bulletStart = 0
  let ordered: string[] = []
  let orderedStart = 0
  let quotes: string[] = []
  let quoteStart = 0
  let fence: string[] | null = null
  let fenceStart = 0

  const flushBullets = () => {
    if (bullets.length === 0) return
    const items = bullets
    const start = bulletStart
    const isTaskList = items.every((item) => item.checked !== null)
    blocks.push(
      <ul key={`ul-${start}`} className={`space-y-1 ${isTaskList ? 'pl-1' : 'list-disc pl-5'}`}>
        {items.map((item, i) => (
          <li key={i} className={item.checked !== null ? 'flex items-start gap-2 list-none' : undefined}>
            {item.checked !== null && (
              <input
                type="checkbox"
                checked={item.checked}
                readOnly
                disabled
                className="mt-1 flex-shrink-0 accent-orange-500"
              />
            )}
            <span className={item.checked ? 'line-through opacity-60' : undefined}>
              {renderInline(item.text, `li-${start}-${i}`)}
            </span>
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  const flushOrdered = () => {
    if (ordered.length === 0) return
    const items = ordered
    const start = orderedStart
    blocks.push(
      <ol key={`ol-${start}`} className="list-decimal pl-5 space-y-1">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item, `oli-${start}-${i}`)}</li>
        ))}
      </ol>,
    )
    ordered = []
  }

  const flushQuotes = () => {
    if (quotes.length === 0) return
    const items = quotes
    const start = quoteStart
    blocks.push(
      <blockquote
        key={`bq-${start}`}
        className="border-l-2 border-orange-500 pl-3 text-gray-600 dark:text-ink-300 space-y-1"
      >
        {items.map((item, i) => (
          <p key={i} className="whitespace-pre-wrap break-words">
            {renderInline(item, `q-${start}-${i}`)}
          </p>
        ))}
      </blockquote>,
    )
    quotes = []
  }

  const flushAll = () => {
    flushBullets()
    flushOrdered()
    flushQuotes()
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]

    if (fence !== null) {
      if (/^\s*```/.test(line)) {
        blocks.push(
          <pre
            key={`pre-${fenceStart}`}
            className="bg-gray-100 dark:bg-ink-900 p-3 overflow-x-auto text-[0.85em] leading-relaxed"
          >
            <code>{fence.join('\n')}</code>
          </pre>,
        )
        fence = null
        continue
      }
      fence.push(line)
      continue
    }

    if (/^\s*```/.test(line)) {
      flushAll()
      fence = []
      fenceStart = index
      continue
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      flushOrdered()
      flushQuotes()
      const task = bullet[1].match(/^\[([ xX])\]\s+(.*)$/)
      if (bullets.length === 0) bulletStart = index
      bullets.push(
        task
          ? { text: task[2], checked: task[1].toLowerCase() === 'x' }
          : { text: bullet[1], checked: null },
      )
      continue
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (numbered) {
      flushBullets()
      flushQuotes()
      if (ordered.length === 0) orderedStart = index
      ordered.push(numbered[1])
      continue
    }

    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      flushBullets()
      flushOrdered()
      if (quotes.length === 0) quoteStart = index
      quotes.push(quote[1])
      continue
    }

    flushAll()

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={index} className="border-gray-200 dark:border-ink-700" />)
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const size = level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm'
      blocks.push(
        <p key={index} className={`${size} font-bold uppercase tracking-wide`}>
          {renderInline(heading[2], `h-${index}`)}
        </p>,
      )
      continue
    }

    if (line.trim() === '') {
      blocks.push(<div key={index} className="h-2" />)
      continue
    }

    blocks.push(
      <p key={index} className="whitespace-pre-wrap break-words">
        {renderInline(line, `p-${index}`)}
      </p>,
    )
  }

  if (fence !== null && fence.length > 0) {
    blocks.push(
      <pre
        key={`pre-${fenceStart}`}
        className="bg-gray-100 dark:bg-ink-900 p-3 overflow-x-auto text-[0.85em] leading-relaxed"
      >
        <code>{fence.join('\n')}</code>
      </pre>,
    )
  }

  flushAll()
  return <div className="space-y-1.5">{blocks}</div>
}
