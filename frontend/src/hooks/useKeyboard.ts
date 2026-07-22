import { useEffect } from 'react'

type Handlers = {
  onNewTask?: () => void
  onSearch?: () => void
  onHelp?: () => void
  onCommandPalette?: () => void
}

function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

export function useGlobalKeyboard(handlers: Handlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // cmd/Ctrl+K command palette works even while typing
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handlers.onCommandPalette?.()
        return
      }

      if (isTyping()) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handlers.onNewTask?.()
      } else if (e.key === '/') {
        e.preventDefault()
        handlers.onSearch?.()
      } else if (e.key === '?') {
        e.preventDefault()
        handlers.onHelp?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}
