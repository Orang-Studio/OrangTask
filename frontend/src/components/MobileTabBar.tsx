import { useNavigate, useLocation } from 'react-router-dom'
import { Sun, Layers, Plus, Search, Settings } from 'lucide-react'
import { useHaptics } from '../hooks/useHaptics'

interface Props {
  onAdd: () => void
  onSearch: () => void
}

export function MobileTabBar({ onAdd, onSearch }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const haptics = useHaptics()

  const isActive = (path: string) => location.pathname === path

  const tabClass = (active: boolean) =>
    `flex flex-col items-center justify-center flex-1 gap-0.5 h-full transition-colors ${
      active ? 'text-orange-500' : 'text-gray-400 dark:text-ink-400'
    }`

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white dark:bg-ink-850 border-t border-gray-200 dark:border-ink-700 flex items-center pb-safe">
      <button onClick={() => { haptics.tap(); navigate('/today') }} className={tabClass(isActive('/today'))}>
        <Sun size={22} />
        <span className="text-[10px] font-medium">Today</span>
      </button>
      <button onClick={() => { haptics.tap(); navigate('/lists') }} className={tabClass(location.pathname.startsWith('/list'))}>
        <Layers size={22} />
        <span className="text-[10px] font-medium">Lists</span>
      </button>

      {/* center add button */}
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={() => { haptics.tap(); onAdd() }}
          aria-label="Add task"
          className="w-14 h-14 -mt-6 bg-orange-500 text-white flex items-center justify-center shadow-lg active:bg-orange-600 transition-colors"
          style={{ borderRadius: 0 }}
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>

      <button onClick={() => { haptics.tap(); onSearch() }} className={tabClass(false)}>
        <Search size={22} />
        <span className="text-[10px] font-medium">Search</span>
      </button>
      <button onClick={() => { haptics.tap(); navigate('/settings') }} className={tabClass(isActive('/settings'))}>
        <Settings size={22} />
        <span className="text-[10px] font-medium">Settings</span>
      </button>
    </nav>
  )
}
