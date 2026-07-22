import { NavLink, useNavigate } from 'react-router-dom'
import {
  Sun, CalendarDays, AlertCircle, Layers, Plus, Settings, LogOut,
  PanelLeftClose, PanelLeftOpen, UserCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useLists, useCreateList } from '../hooks/useLists'
import { useTasks } from '../hooks/useTasks'
import { useAuthStore } from '../stores/auth'
import { Logo } from './Logo'
import { ListIcon, DEFAULT_LIST_ICON } from '../lib/listIcons'
import { useHaptics } from '../hooks/useHaptics'

const SMART_VIEWS = [
  { to: '/today', label: 'Today', icon: Sun, smart: 'today' as const },
  { to: '/upcoming', label: 'Upcoming', icon: CalendarDays, smart: 'week' as const },
  { to: '/overdue', label: 'Overdue', icon: AlertCircle, smart: 'overdue' as const },
  { to: '/all', label: 'All Tasks', icon: Layers, smart: 'all' as const },
]

function SmartBadge({ smart }: { smart: 'today' | 'overdue' | 'assigned' }) {
  const { data: tasks } = useTasks({ smart })
  const count = tasks?.length ?? 0
  if (count === 0) return null
  return (
    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium ${
      smart === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-gray-100 dark:bg-ink-700 text-gray-500 dark:text-ink-300'
    }`}>
      {count}
    </span>
  )
}

export function Sidebar() {
  const { data: lists } = useLists()
  // show the Assigned view for anyone in a collaborative list: invited members, or owners whose list has
  const hasSharedLists = lists?.some((l) => l.is_shared || (l.my_role && l.my_role !== 'owner')) ?? false
  const createList = useCreateList()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const haptics = useHaptics()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === '1' } catch { return false }
  })

  const toggleCollapsed = () => {
    haptics.tap()
    setCollapsed((v) => {
      const next = !v
      try { localStorage.setItem('sidebar-collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center h-10 text-sm font-medium transition-colors ${
      collapsed ? 'justify-center px-0' : 'gap-3 px-3'
    } ${
      isActive
        ? 'bg-orange-50 dark:bg-ink-750 text-orange-600 dark:text-orange-400 border-l-2 border-orange-500'
        : 'text-gray-700 dark:text-ink-300 hover:bg-gray-50 dark:hover:bg-ink-750 border-l-2 border-transparent'
    }`

  const handleCreate = async () => {
    if (!newName.trim()) {
      setAdding(false)
      return
    }
    await createList.mutateAsync({ name: newName.trim(), color: '#f97316', icon: DEFAULT_LIST_ICON })
    setNewName('')
    setAdding(false)
  }

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 border-r border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-850 flex flex-col h-full transition-[width] duration-200`}>
      {/* brand + collapse toggle */}
      <div className={`flex items-center h-14 border-b border-gray-200 dark:border-ink-700 ${collapsed ? 'justify-center px-0' : 'gap-2 px-4'}`}>
        {collapsed ? (
          <button onClick={toggleCollapsed} className="p-1" aria-label="Expand sidebar" title="Expand sidebar">
            <Logo size={28} />
          </button>
        ) : (
          <>
            <Logo size={28} />
            <span className="font-bold uppercase tracking-wider text-[15px] flex-1 truncate">OrangTask</span>
            <button onClick={toggleCollapsed} className="p-1.5 text-gray-400 hover:text-orange-500" aria-label="Collapse sidebar" title="Collapse sidebar">
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 no-scrollbar">
        {/* smart views */}
        <div className="px-2 space-y-0.5">
          {SMART_VIEWS.map((v) => (
            <NavLink key={v.to} to={v.to} className={navClass} onClick={() => haptics.tap()} title={collapsed ? v.label : undefined}>
              <v.icon size={17} className="flex-shrink-0" />
              {!collapsed && <span>{v.label}</span>}
              {!collapsed && v.smart === 'today' && <SmartBadge smart="today" />}
              {!collapsed && v.smart === 'overdue' && <SmartBadge smart="overdue" />}
            </NavLink>
          ))}
          {/* shown only for users who collaborate on a shared list */}
          {hasSharedLists && (
            <NavLink to="/assigned" className={navClass} onClick={() => haptics.tap()} title={collapsed ? 'Assigned to Me' : undefined}>
              <UserCheck size={17} className="flex-shrink-0" />
              {!collapsed && <span>Assigned to Me</span>}
              {!collapsed && <SmartBadge smart="assigned" />}
            </NavLink>
          )}
        </div>

        {/* lists */}
        <div className={`mt-6 mb-1 flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {!collapsed && <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Lists</span>}
          <button
            onClick={() => { if (collapsed) toggleCollapsed(); setAdding(true) }}
            className="text-gray-400 hover:text-orange-500"
            aria-label="New list"
            title="New list"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="px-2 space-y-0.5">
          {lists?.map((list) => (
            <NavLink key={list.id} to={`/list/${list.id}`} className={navClass} onClick={() => haptics.tap()} title={collapsed ? list.name : undefined}>
              <ListIcon icon={list.icon} color={list.color} size={17} />
              {!collapsed && <span className="truncate">{list.name}</span>}
              {!collapsed && (list.task_count ?? 0) > 0 && (
                <span className="ml-auto text-xs text-gray-400">{list.task_count}</span>
              )}
            </NavLink>
          ))}
          {!collapsed && adding && (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setNewName('')
                  setAdding(false)
                }
              }}
              placeholder="List name..."
              className="input-field mx-1 h-9 text-sm"
              style={{ width: 'calc(100% - 8px)' }}
            />
          )}
        </div>
      </nav>

      {/* user footer */}
      <div className="border-t border-gray-200 dark:border-ink-700 p-2">
        <div className={`flex ${collapsed ? 'flex-col items-center gap-1' : 'items-center gap-2'}`}>
          <button
            onClick={() => navigate('/settings')}
            className={`flex items-center hover:bg-gray-50 dark:hover:bg-ink-750 transition-colors min-w-0 ${
              collapsed ? 'justify-center w-10 h-10' : 'gap-2 flex-1 px-2 h-10'
            }`}
            aria-label="Account"
            title={collapsed ? user?.name : undefined}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            {!collapsed && <span className="text-sm truncate">{user?.name}</span>}
          </button>
          {!collapsed && (
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-gray-400 hover:text-orange-500"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
          )}
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="p-2 text-gray-400 hover:text-red-500"
            aria-label="Log out"
            title={collapsed ? 'Log out' : undefined}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}
