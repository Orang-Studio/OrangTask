import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Layers, ChevronRight, Hash, CalendarDays, AlertCircle,
} from 'lucide-react'
import { useLists, useCreateList } from '../hooks/useLists'
import { useHaptics } from '../hooks/useHaptics'
import { EmptyState } from '../components/EmptyState'
import { ListIcon, DEFAULT_LIST_ICON } from '../lib/listIcons'

// mobile-first index of all lists
export function ListsPage() {
  const { data: lists } = useLists()
  const createList = useCreateList()
  const navigate = useNavigate()
  const haptics = useHaptics()

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) { setAdding(false); return }
    const list = await createList.mutateAsync({ name, color: '#f97316', icon: DEFAULT_LIST_ICON })
    setNewName('')
    setAdding(false)
    // jump straight into the new list so you can add tasks / share right away
    if (list?.id) navigate(`/list/${list.id}`)
  }

  const rowClass =
    'flex items-center gap-3 px-4 md:px-6 h-14 border-b border-gray-100 dark:border-ink-800 ' +
    'active:bg-gray-50 dark:active:bg-ink-800 transition-colors w-full text-left'

  return (
    <div className="flex flex-col h-full">
      {}
      <div className="flex items-center gap-2 px-4 md:px-6 h-14 border-b border-gray-200 dark:border-ink-700 flex-shrink-0">
        <Layers size={20} className="text-orange-500" />
        <h1 className="text-lg font-bold uppercase tracking-wide">Lists</h1>
        <button
          onClick={() => { haptics.tap(); setAdding(true) }}
          className="ml-auto flex items-center gap-1.5 px-3 h-9 bg-orange-500 text-white text-sm font-bold uppercase tracking-wide active:bg-orange-600"
          aria-label="New list"
        >
          <Plus size={16} strokeWidth={2.5} /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* inline create row */}
        {adding && (
          <div className="flex items-center gap-3 px-4 md:px-6 h-14 border-b border-gray-100 dark:border-ink-800">
            <Hash size={18} className="text-gray-400" />
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setNewName(''); setAdding(false) }
              }}
              placeholder="List name..."
              className="input-field flex-1 h-9 text-sm"
            />
          </div>
        )}

        {/* smart views (no other mobile entry point for these) */}
        <p className="px-4 md:px-6 pt-4 pb-1 text-xs uppercase tracking-wider text-gray-400 font-semibold">Views</p>
        {[
          { to: '/upcoming', label: 'Upcoming', Icon: CalendarDays },
          { to: '/overdue', label: 'Overdue', Icon: AlertCircle },
          { to: '/all', label: 'All Tasks', Icon: Layers },
        ].map(({ to, label, Icon }) => (
          <button key={to} className={rowClass} onClick={() => { haptics.tap(); navigate(to) }}>
            <Icon size={18} className="text-gray-400" />
            <span className="font-medium">{label}</span>
            <ChevronRight size={18} className="ml-auto text-gray-300 dark:text-ink-600" />
          </button>
        ))}

        {/* the lists */}
        <p className="px-4 md:px-6 pt-4 pb-1 text-xs uppercase tracking-wider text-gray-400 font-semibold">Lists</p>
        {lists?.map((list) => (
          <button key={list.id} className={rowClass} onClick={() => { haptics.tap(); navigate(`/list/${list.id}`) }}>
            <ListIcon icon={list.icon} color={list.color} />
            <span className="font-medium truncate">{list.name}</span>
            {list.my_role && list.my_role !== 'owner' && (
              <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-gray-200 dark:border-ink-600 px-1.5 py-0.5">
                {list.my_role}
              </span>
            )}
            {(list.task_count ?? 0) > 0 && (
              <span className="ml-auto text-xs text-gray-400">{list.task_count}</span>
            )}
            <ChevronRight size={18} className={`${(list.task_count ?? 0) > 0 ? 'ml-2' : 'ml-auto'} text-gray-300 dark:text-ink-600`} />
          </button>
        ))}

        {lists && lists.length === 0 && !adding && (
          <EmptyState
            icon={Layers}
            title="No lists yet"
            description='Tap "New" above to create your first list, then share it or add tasks.'
            pose="idle"
          />
        )}
      </div>
    </div>
  )
}
