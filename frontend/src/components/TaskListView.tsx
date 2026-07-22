import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { Task } from '../lib/api'
import { TaskItem } from './TaskItem'
import { TaskDetail } from './TaskDetail'
import { QuickAdd } from './QuickAdd'
import { TaskListSkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import {
  useTasks, useCreateTask, useCompleteTask, useDeleteTask, useUpdateTask, SmartView,
} from '../hooks/useTasks'
import { useLayout } from './Layout'
import { useHaptics } from '../hooks/useHaptics'

interface Props {
  title: string
  smart?: SmartView
  listId?: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  showQuickAdd?: boolean
  headerAccessory?: React.ReactNode
  defaultPriority?: string
}

export function TaskListView({
  title, smart, listId, emptyIcon, emptyTitle, emptyDescription,
  showQuickAdd = true, headerAccessory, defaultPriority,
}: Props) {
  const { data: tasks, isLoading } = useTasks({ smart, listId })
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const { registerQuickAdd } = useLayout()
  const haptics = useHaptics()

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const quickAddRef = useRef<HTMLInputElement>(null)

  // register quick-add focus (for global "N" / mobile FAB) only while the input is actually rendered
  useEffect(() => {
    if (showQuickAdd && listId) {
      registerQuickAdd(() => quickAddRef.current?.focus())
      return () => registerQuickAdd(null)
    }
    registerQuickAdd(null)
  }, [registerQuickAdd, showQuickAdd, listId])

  // open task from ?task= deep link (e.g from search)
  useEffect(() => {
    const taskId = searchParams.get('task')
    if (taskId && tasks) {
      const found = tasks.find((t) => t.id === taskId)
      if (found) setSelectedTask(found)
    }
  }, [searchParams, tasks])

  // keep selectedTask in sync with the latest task data
  useEffect(() => {
    if (selectedTask && tasks) {
      const updated = tasks.find((t) => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }, [tasks])

  const handleAdd = (data: { title: string; due_date: string | null; priority: string; recurrence_rule: string | null }) => {
    if (!listId) {
      // for smart views without a specific list, create in the first list
      return
    }
    createTask.mutate({
      list_id: listId,
      title: data.title,
      due_date: data.due_date,
      priority: (data.priority as Task['priority']) || (defaultPriority as Task['priority']) || 'none',
      recurrence_rule: data.recurrence_rule,
    })
  }

  const closeDetail = () => {
    setSelectedTask(null)
    if (searchParams.get('task')) {
      searchParams.delete('task')
      setSearchParams(searchParams, { replace: true })
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {}
        <div className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-gray-200 dark:border-ink-700 flex-shrink-0">
          <h1 className="text-lg font-bold uppercase tracking-wide truncate">{title}</h1>
          {headerAccessory}
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto group">
          {isLoading ? (
            <TaskListSkeleton />
          ) : tasks && tasks.length > 0 ? (
            <AnimatePresence initial={false}>
              {tasks.map((task) => (
                <div key={task.id} className="animate-slide-in group">
                  <TaskItem
                    task={task}
                    selected={selectedTask?.id === task.id}
                    onToggleComplete={(t) => completeTask.mutate({ id: t.id, complete: t.status !== 'done' })}
                    onDelete={(t) => {
                      haptics.error()
                      deleteTask.mutate(t.id)
                      if (selectedTask?.id === t.id) closeDetail()
                    }}
                    onOpen={(t) => setSelectedTask(t)}
                  />
                </div>
              ))}
            </AnimatePresence>
          ) : (
            <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
          )}
        </div>

        {/* quick add */}
        {showQuickAdd && listId && <QuickAdd ref={quickAddRef} onAdd={handleAdd} />}
      </div>

      {/* task detail panel */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetail
            key={selectedTask.id}
            task={selectedTask}
            onClose={closeDetail}
            onUpdate={(patch) => updateTask.mutate(patch)}
            onDelete={(t) => deleteTask.mutate(t.id)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
