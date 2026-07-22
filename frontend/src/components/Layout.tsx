import { useState, useRef, useEffect, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileTabBar } from './MobileTabBar'
import { CommandPalette } from './CommandPalette'
import { ShortcutsModal } from './ShortcutsModal'
import { NotificationBell } from './NotificationBell'
import { useGlobalKeyboard } from '../hooks/useKeyboard'
import { useWebSocket } from '../hooks/useWebSocket'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useOfflineStore } from '../stores/offline'
import { useAuthStore } from '../stores/auth'
import { WifiOff } from 'lucide-react'
import { Logo } from './Logo'
import { modKey } from '../lib/platform'

// shared context for child pages to trigger the QuickAdd focus / search
import { createContext, useContext } from 'react'

interface LayoutCtx {
  focusQuickAdd: () => void
  registerQuickAdd: (fn: (() => void) | null) => void
  openSearch: () => void
}
const LayoutContext = createContext<LayoutCtx | null>(null)
export const useLayout = () => {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout outside provider')
  return ctx
}

export function Layout() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const online = useOfflineStore((s) => s.online)
  const queueLen = useOfflineStore((s) => s.queue.length)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const quickAddFocusRef = useRef<(() => void) | null>(null)
  const pendingFocusRef = useRef(false)

  // real-time WebSocket sync (only when authenticated)
  useWebSocket(!!user)

  // pages register their quick-add input only while its actually on screen
  const registerQuickAdd = useCallback((fn: (() => void) | null) => {
    quickAddFocusRef.current = fn
    // if we navigated here specifically to add a task, focus the input on mount
    if (fn && pendingFocusRef.current) {
      pendingFocusRef.current = false
      setTimeout(fn, 0)
    }
  }, [])

  const focusQuickAdd = useCallback(() => {
    if (quickAddFocusRef.current) {
      quickAddFocusRef.current()
    } else {
      // current view has no inline quick-add
      pendingFocusRef.current = true
      navigate('/today')
    }
  }, [navigate])

  useGlobalKeyboard({
    onNewTask: focusQuickAdd,
    onSearch: () => setPaletteOpen(true),
    onCommandPalette: () => setPaletteOpen(true),
    onHelp: () => setShortcutsOpen(true),
  })

  // flush offline queue when reconnected
  useEffect(() => {
    if (online) useOfflineStore.getState().flush()
  }, [online])

  const ctxValue: LayoutCtx = {
    focusQuickAdd,
    registerQuickAdd,
    openSearch: () => setPaletteOpen(true),
  }

  return (
    <LayoutContext.Provider value={ctxValue}>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-ink-900">
        {!isMobile && <Sidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          {/* mobile header */}
          {isMobile && (
            <header className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-850 pt-safe">
              <div className="flex items-center gap-2">
                <Logo size={26} />
                <span className="font-bold uppercase tracking-wider text-sm">OrangTask</span>
              </div>
              <NotificationBell />
            </header>
          )}

          {/* desktop top bar with notification bell */}
          {!isMobile && (
            <header className="flex items-center justify-end px-4 h-14 border-b border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-850 gap-2">
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-2 px-3 h-9 text-sm text-gray-400 border border-gray-200 dark:border-ink-600 hover:border-orange-500 transition-colors"
              >
                Search
                <kbd className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-ink-700 rounded">{modKey === '⌘' ? '⌘K' : 'Ctrl+K'}</kbd>
              </button>
              <NotificationBell />
            </header>
          )}

          {/* offline / sync banner */}
          {(!online || queueLen > 0) && (
            <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-500 text-white text-xs font-medium">
              <WifiOff size={13} />
              {!online ? 'Offline - changes will sync when reconnected' : `Syncing ${queueLen} change${queueLen > 1 ? 's' : ''}...`}
            </div>
          )}

          <main className={`flex-1 overflow-hidden ${isMobile ? 'pb-16' : ''}`}>
            <Outlet />
          </main>
        </div>

        {isMobile && (
          <MobileTabBar onAdd={focusQuickAdd} onSearch={() => setPaletteOpen(true)} />
        )}

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </LayoutContext.Provider>
  )
}
