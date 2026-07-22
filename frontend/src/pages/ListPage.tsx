import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Hash, MoreVertical, Users, Trash2, Palette, Pencil, Smile } from 'lucide-react'
import { TaskListView } from '../components/TaskListView'
import { useLists, useDeleteList, useUpdateList } from '../hooks/useLists'
import { ShareModal } from '../components/ShareModal'
import { useNavigate } from 'react-router-dom'
import { useHaptics } from '../hooks/useHaptics'
import { LIST_ICONS, LIST_ICON_KEYS } from '../lib/listIcons'

const COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

export function ListPage() {
  const { id } = useParams<{ id: string }>()
  const { data: lists } = useLists()
  const deleteList = useDeleteList()
  const updateList = useUpdateList()
  const navigate = useNavigate()
  const haptics = useHaptics()

  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const list = lists?.find((l) => l.id === id)
  if (!list) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        List not found
      </div>
    )
  }

  const isOwner = list.my_role === 'owner'
  const canEdit = list.my_role === 'owner' || list.my_role === 'editor'

  const commitRename = () => {
    const name = renameValue.trim()
    if (name && name !== list.name) updateList.mutate({ id: list.id, name })
    setRenaming(false)
    setMenuOpen(false)
  }

  const accessory = (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => { haptics.tap(); setShareOpen(true) }}
        className="p-2 text-gray-400 hover:text-orange-500"
        aria-label="Share list"
      >
        <Users size={18} />
      </button>
      <button
        onClick={() => { haptics.tap(); setMenuOpen(!menuOpen) }}
        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
        aria-label="List options"
      >
        <MoreVertical size={18} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-11 z-20 w-44 surface shadow-lg py-1 animate-slide-in">
            {canEdit && (renaming ? (
              <div className="px-2 py-1.5">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenaming(false)
                  }}
                  className="input-field w-full h-9 text-sm"
                  placeholder="List name..."
                />
              </div>
            ) : (
              <button
                onClick={() => { setRenameValue(list.name); setRenaming(true) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-ink-750"
              >
                <Pencil size={15} /> Rename
              </button>
            ))}
            {canEdit && (
              <>
                <button
                  onClick={() => { setIconOpen(!iconOpen); setColorOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-ink-750"
                >
                  <Smile size={15} /> Change icon
                </button>
                {iconOpen && (
                  <div className="grid grid-cols-6 gap-1 px-3 py-2 max-h-48 overflow-y-auto">
                    {LIST_ICON_KEYS.map((key) => {
                      const Icon = LIST_ICONS[key]
                      const active = (list.icon || '') === key
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            haptics.tap()
                            updateList.mutate({ id: list.id, icon: key })
                            setIconOpen(false)
                            setMenuOpen(false)
                          }}
                          className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
                            active
                              ? 'bg-orange-100 dark:bg-ink-700 text-orange-600 dark:text-orange-400'
                              : 'hover:bg-gray-100 dark:hover:bg-ink-750 text-gray-500 dark:text-ink-300'
                          }`}
                          aria-label={key}
                        >
                          <Icon size={16} style={{ color: active ? undefined : list.color || undefined }} />
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
            {canEdit && (
              <button
                onClick={() => { setColorOpen(!colorOpen); setIconOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-ink-750"
              >
                <Palette size={15} /> Change color
              </button>
            )}
            {colorOpen && (
              <div className="flex flex-wrap gap-1.5 px-3 py-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      updateList.mutate({ id: list.id, color: c })
                      setColorOpen(false)
                      setMenuOpen(false)
                    }}
                    className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
            {isOwner && (
              <button
                onClick={() => {
                  if (confirm(`Delete list "${list.name}" and all its tasks?`)) {
                    haptics.error()
                    deleteList.mutate(list.id)
                    navigate('/today')
                  }
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-ink-750"
              >
                <Trash2 size={15} /> Delete list
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      <TaskListView
        key={list.id}
        title={list.name}
        listId={list.id}
        emptyIcon={Hash}
        emptyTitle="No tasks in this list"
        emptyDescription="Add your first task using the box below."
        headerAccessory={accessory}
      />
      {shareOpen && <ShareModal listId={list.id} listName={list.name} isOwner={isOwner} onClose={() => setShareOpen(false)} />}
    </>
  )
}
