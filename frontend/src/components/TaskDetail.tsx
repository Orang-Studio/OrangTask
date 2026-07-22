import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Flag, Tag as TagIcon, Trash2, Plus, Check, UserCircle2, ChevronDown } from 'lucide-react'
import { Task, Tag } from '../lib/api'
import { Avatar } from './Avatar'
import { PRIORITY_LABELS, PRIORITY_COLORS } from './PriorityDot'
import { toDateTimeLocal } from '../lib/date'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useHaptics } from '../hooks/useHaptics'
import {
  useTags,
  useCreateTag,
  useAddTagToTask,
  useRemoveTagFromTask,
  useListMembers,
} from '../hooks/useLists'
import { useTasks, useCreateTask, useCompleteTask, useDeleteTask } from '../hooks/useTasks'

interface Props {
  task: Task | null
  onClose: () => void
  onUpdate: (patch: Partial<Task> & { id: string }) => void
  onDelete: (task: Task) => void
}

const PRIORITIES = ['none', 'low', 'medium', 'high'] as const

export function TaskDetail({ task, onClose, onUpdate, onDelete }: Props) {
  const isMobile = useIsMobile()
  const haptics = useHaptics()
  const { data: allTags } = useTags()
  const createTag = useCreateTag()
  const addTag = useAddTagToTask()
  const removeTag = useRemoveTagFromTask()
  const createSubtask = useCreateTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()

  const { data: subtasks } = useTasks({ listId: task?.list_id, parentId: task?.id })
  const { data: members } = useListMembers(task?.list_id)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  // desktop panel is resizable by dragging its left edge; width persists
  const MIN_W = 320
  const maxW = () => Math.min(900, Math.round(window.innerWidth * 0.7))
  const [width, setWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('task-panel-width') || '', 10)
      if (!isNaN(saved)) return saved
    } catch {}
    return 384 // matches the old w-96 default
  })
  const widthRef = useRef(width)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = widthRef.current
    const onMove = (ev: MouseEvent) => {
      // panel is on the right, so dragging left (smaller clientX) widens it
      const next = Math.max(MIN_W, Math.min(startW + (startX - ev.clientX), maxW()))
      widthRef.current = next
      setWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      try { localStorage.setItem('task-panel-width', String(widthRef.current)) } catch {}
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
  }

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setNotes(task.notes || '')
    }
  }, [task?.id])

  if (!task) return null

  const saveTitle = () => {
    if (title.trim() && title !== task.title) {
      onUpdate({ id: task.id, title: title.trim() })
    }
  }
  const saveNotes = () => {
    if (notes !== (task.notes || '')) {
      onUpdate({ id: task.id, notes })
    }
  }

  const taskTagIds = task.tag_ids || []

  const content = (
    <div className="flex flex-col h-full">
      {}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-ink-700">
        <button
          onClick={() => {
            haptics.tap()
            completeTask.mutate({ id: task.id, complete: task.status !== 'done' })
          }}
          className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wide px-3 h-9 transition-colors
            ${task.status === 'done' ? 'bg-orange-500 text-white' : 'border border-gray-300 dark:border-ink-500'}`}
        >
          <Check size={15} strokeWidth={3} />
          {task.status === 'done' ? 'Completed' : 'Complete'}
        </button>
        <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full bg-transparent text-xl font-semibold outline-none"
          placeholder="Task title"
        />

        {/* due date */}
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-gray-400 flex-shrink-0" />
          <input
            type="datetime-local"
            value={toDateTimeLocal(task.due_date)}
            onChange={(e) =>
              onUpdate({ id: task.id, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
            className="input-field flex-1"
          />
        </div>

        {/* priority */}
        <div className="flex items-center gap-3">
          <Flag size={18} className="text-gray-400 flex-shrink-0" />
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => {
                  haptics.tap()
                  onUpdate({ id: task.id, priority: p })
                }}
                className={`px-3 h-9 text-sm font-medium border transition-colors ${
                  task.priority === p
                    ? 'border-orange-500 bg-orange-50 dark:bg-ink-700'
                    : 'border-gray-300 dark:border-ink-600'
                }`}
                style={task.priority === p && p !== 'none' ? { color: PRIORITY_COLORS[p] } : {}}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* assignee only shown when the list is shared with someone */}
        {members && members.length > 1 && (() => {
          const assignee = members.find((m) => m.id === task.assigned_to)
          return (
            <div className="flex items-start gap-3">
              <UserCircle2 size={18} className="text-gray-400 flex-shrink-0 mt-2" />
              <div className="flex-1">
                <button
                  onClick={() => {
                    haptics.tap()
                    setShowAssignPicker(!showAssignPicker)
                  }}
                  className="flex items-center gap-2 px-3 h-9 text-sm font-medium border border-gray-300 dark:border-ink-600 hover:border-orange-500 transition-colors"
                >
                  {assignee ? (
                    <>
                      <Avatar name={assignee.name} url={assignee.avatar_url} size={20} />
                      <span>{assignee.name}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Assign to...</span>
                  )}
                  <ChevronDown size={14} className="text-gray-400" />
                </button>

                {showAssignPicker && (
                  <div className="mt-2 p-1 surface rounded animate-slide-in">
                    <button
                      onClick={() => {
                        onUpdate({ id: task.id, assigned_to: null })
                        setShowAssignPicker(false)
                      }}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-ink-700 ${
                        !task.assigned_to ? 'text-orange-500 font-medium' : ''
                      }`}
                    >
                      <UserCircle2 size={20} className="text-gray-400" />
                      Unassigned
                    </button>
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          haptics.tap()
                          onUpdate({ id: task.id, assigned_to: m.id })
                          setShowAssignPicker(false)
                        }}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-ink-700 ${
                          task.assigned_to === m.id ? 'text-orange-500 font-medium' : ''
                        }`}
                      >
                        <Avatar name={m.name} url={m.avatar_url} size={20} />
                        <span className="truncate">{m.name}</span>
                        {task.assigned_to === m.id && <Check size={14} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {}
        <div className="flex items-start gap-3">
          <TagIcon size={18} className="text-gray-400 flex-shrink-0 mt-2" />
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 items-center">
              {allTags
                ?.filter((t) => taskTagIds.includes(t.id))
                .map((tag) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1 text-sm px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 rounded"
                  >
                    {tag.name}
                    <button
                      onClick={() => removeTag.mutate({ taskId: task.id, tagId: tag.id })}
                      className="hover:text-red-500"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="flex items-center gap-1 text-sm px-2 py-1 border border-dashed border-gray-300 dark:border-ink-500 rounded hover:border-orange-500"
              >
                <Plus size={12} /> Tag
              </button>
            </div>

            {showTagPicker && (
              <div className="mt-2 p-2 surface rounded space-y-2 animate-slide-in">
                <div className="flex flex-wrap gap-1">
                  {allTags
                    ?.filter((t) => !taskTagIds.includes(t.id))
                    .map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          addTag.mutate({ taskId: task.id, tagId: tag.id })
                          setShowTagPicker(false)
                        }}
                        className="text-sm px-2 py-1 bg-gray-100 dark:bg-ink-700 rounded hover:bg-orange-100 dark:hover:bg-ink-600"
                      >
                        {tag.name}
                      </button>
                    ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && newTagName.trim()) {
                        const tag = await createTag.mutateAsync({ name: newTagName.trim() })
                        addTag.mutate({ taskId: task.id, tagId: tag.id })
                        setNewTagName('')
                        setShowTagPicker(false)
                      }
                    }}
                    placeholder="New tag..."
                    className="input-field flex-1 h-9"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* notes */}
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={4}
            placeholder="Add notes (markdown supported)..."
            className="input-field w-full h-auto py-2 resize-y"
          />
        </div>

        {/* subtasks */}
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-400 mb-2 block">Subtasks</label>
          <div className="space-y-1">
            {subtasks?.map((st) => (
              <div key={st.id} className="flex items-center gap-2 py-1">
                <button
                  onClick={() => completeTask.mutate({ id: st.id, complete: st.status !== 'done' })}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    st.status === 'done' ? 'bg-orange-500 border-orange-500' : 'border-gray-400 dark:border-ink-400'
                  }`}
                >
                  {st.status === 'done' && <Check size={11} className="text-white" strokeWidth={3} />}
                </button>
                <span className={`text-sm flex-1 ${st.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                  {st.title}
                </span>
                <button
                  onClick={() => deleteTask.mutate(st.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Plus size={16} className="text-gray-400" />
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSubtask.trim()) {
                  createSubtask.mutate({ list_id: task.list_id, parent_id: task.id, title: newSubtask.trim() })
                  setNewSubtask('')
                }
              }}
              placeholder="Add subtask..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="border-t border-gray-200 dark:border-ink-700 p-3">
        <button
          onClick={() => {
            haptics.error()
            onDelete(task)
            onClose()
          }}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 px-3 h-9 font-medium"
        >
          <Trash2 size={16} /> Delete task
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute bottom-0 inset-x-0 h-[90vh] bg-white dark:bg-ink-850 rounded-t-2xl overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 dark:bg-ink-500 rounded-full mx-auto mt-2" />
            {content}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      style={{ width }}
      className="relative border-l border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-850 h-full flex-shrink-0"
    >
      {/* drag handle - resize the panel by dragging this left edge */}
      <div
        onMouseDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        className="absolute left-0 top-0 h-full w-2 -ml-1 z-20 cursor-ew-resize group"
      >
        <div className="absolute inset-y-0 left-1 w-px bg-transparent group-hover:bg-orange-400 transition-colors" />
      </div>
      {content}
    </motion.div>
  )
}
