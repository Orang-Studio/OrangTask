import { Fragment, type ReactNode } from 'react'

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`)/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`
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

export function renderRichText(content: string): ReactNode {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  let bulletStart = 0

  const flushBullets = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`ul-${bulletStart}`} className="list-disc pl-5 space-y-1">
        {bullets.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${bulletStart}-${i}`)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      if (bullets.length === 0) bulletStart = index
      bullets.push(bullet[1])
      return
    }
    flushBullets()

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const size = level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm'
      blocks.push(
        <p key={index} className={`${size} font-bold uppercase tracking-wide`}>
          {renderInline(heading[2], `h-${index}`)}
        </p>,
      )
      return
    }

    if (line.trim() === '') {
      blocks.push(<div key={index} className="h-2" />)
      return
    }

    blocks.push(
      <p key={index} className="whitespace-pre-wrap break-words">
        {renderInline(line, `p-${index}`)}
      </p>,
    )
  })

  flushBullets()
  return <div className="space-y-1.5">{blocks}</div>
}
