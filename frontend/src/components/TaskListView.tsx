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
  useTasks, useCreateTask, useCompleteTask, useDeleteTask, useUpdateTask, useReorderTasks, SmartView,
} from '../hooks/useTasks'
import { SortableList, SortableItem } from './Sortable'
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
  reorderable?: boolean
}

export function TaskListView({
  title, smart, listId, emptyIcon, emptyTitle, emptyDescription,
  showQuickAdd = true, headerAccessory, defaultPriority, reorderable = false,
}: Props) {
  const { data: tasks, isLoading } = useTasks({ smart, listId })
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const reorderTasks = useReorderTasks()
  const { registerQuickAdd } = useLayout()
  const haptics = useHaptics()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const quickAddRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showQuickAdd && listId) {
      registerQuickAdd(() => quickAddRef.current?.focus())
      return () => registerQuickAdd(null)
    }
    registerQuickAdd(null)
  }, [registerQuickAdd, showQuickAdd, listId])

  useEffect(() => {
    const taskId = searchParams.get('task')
    if (taskId && tasks) {
      const found = tasks.find((t) => t.id === taskId)
      if (found) setSelectedTask(found)
    }
  }, [searchParams, tasks])

  useEffect(() => {
    if (selectedTask && tasks) {
      const updated = tasks.find((t) => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }, [tasks])

  const handleAdd = (data: { title: string; due_date: string | null; priority: string; recurrence_rule: string | null }) => {
    if (!listId) {

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

        <div className="flex-1 overflow-y-auto group">
          {isLoading ? (
            <TaskListSkeleton />
          ) : tasks && tasks.length > 0 ? (
            <SortableList
              ids={tasks.map((t) => t.id)}
              onReorder={(ids) => reorderTasks.mutate(ids)}
              disabled={!reorderable || !listId || !!smart}
              immediate={Boolean(reorderable && listId && !smart)}
            >
              <AnimatePresence initial={false}>
                {tasks.map((task) => {
                  const canReorder = Boolean(reorderable && listId && !smart)
                  return (
                    <SortableItem key={task.id} id={task.id} useHandle={canReorder} className="animate-slide-in group">
                      {(dragging, handleProps) => (
                        <TaskItem
                          task={task}
                          selected={selectedTask?.id === task.id}
                          dragging={dragging}
                          reorderable={canReorder}
                          dragHandleProps={handleProps}
                          onToggleComplete={(t) => completeTask.mutate({ id: t.id, complete: t.status !== 'done' })}
                          onDelete={(t) => {
                            haptics.error()
                            deleteTask.mutate(t)
                            if (selectedTask?.id === t.id) closeDetail()
                          }}
                          onOpen={(t) => setSelectedTask(t)}
                        />
                      )}
                    </SortableItem>
                  )
                })}
              </AnimatePresence>
            </SortableList>
          ) : (
            <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
          )}
        </div>

        {showQuickAdd && listId && <QuickAdd ref={quickAddRef} onAdd={handleAdd} />}
      </div>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetail
            key="task-detail"
            task={selectedTask}
            onClose={closeDetail}
            onUpdate={(patch) => updateTask.mutate(patch)}
            onDelete={(t) => deleteTask.mutate(t)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}