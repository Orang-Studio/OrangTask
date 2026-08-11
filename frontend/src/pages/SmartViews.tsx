import { Sun, CalendarDays, AlertCircle, Layers, UserCheck } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Task } from '../lib/api'
import { TaskItem } from '../components/TaskItem'
import { TaskDetail } from '../components/TaskDetail'
import { QuickAdd } from '../components/QuickAdd'
import { TaskListSkeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { MascotPose } from '../components/Mascot'
import { useTasks, useCreateTask, useCompleteTask, useDeleteTask, useUpdateTask, SmartView } from '../hooks/useTasks'
import { useLists } from '../hooks/useLists'
import { useLayout } from '../components/Layout'
import { useHaptics } from '../hooks/useHaptics'
import { t, type MessageKey } from '../lib/i18n'

interface SmartConfig {
  title: string
  smart: SmartView
  icon: typeof Sun
  emptyTitle: string
  emptyDescription: string
  allowAdd: boolean
  pose?: MascotPose
}

function SmartPage({ config }: { config: SmartConfig }) {
  const { data: tasks, isLoading } = useTasks({ smart: config.smart })
  const { data: lists } = useLists()
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const { registerQuickAdd } = useLayout()
  const haptics = useHaptics()

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const quickAddRef = useRef<HTMLInputElement>(null)

  const defaultList = lists?.[0]

  useEffect(() => {
    if (config.allowAdd && defaultList) {
      registerQuickAdd(() => quickAddRef.current?.focus())
      return () => registerQuickAdd(null)
    }
    registerQuickAdd(null)
  }, [registerQuickAdd, config.allowAdd, defaultList])

  useEffect(() => {
    if (selectedTask && tasks) {
      const updated = tasks.find((t) => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
    }
  }, [tasks])

  const handleAdd = (data: { title: string; due_date: string | null; priority: string; recurrence_rule: string | null }) => {
    if (!defaultList) return

    let due = data.due_date
    if (config.smart === 'today' && !due) {
      const now = new Date()
      now.setHours(23, 59, 0, 0)
      due = now.toISOString()
    }
    createTask.mutate({
      list_id: defaultList.id,
      title: data.title,
      due_date: due,
      priority: (data.priority as Task['priority']) || 'none',
      recurrence_rule: data.recurrence_rule,
    })
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-4 md:px-6 h-14 border-b border-gray-200 dark:border-ink-700 flex-shrink-0">
          <config.icon size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold uppercase tracking-wide">{config.title}</h1>
          {tasks && tasks.length > 0 && (
            <span className="text-sm text-gray-400 ml-1">{tasks.length}</span>
          )}
        </div>

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
                      deleteTask.mutate(t)
                      if (selectedTask?.id === t.id) setSelectedTask(null)
                    }}
                    onOpen={(t) => setSelectedTask(t)}
                  />
                </div>
              ))}
            </AnimatePresence>
          ) : (
            <EmptyState icon={config.icon} title={config.emptyTitle} description={config.emptyDescription} pose={config.pose} />
          )}
        </div>

        {config.allowAdd && defaultList && <QuickAdd ref={quickAddRef} onAdd={handleAdd} />}
      </div>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetail
            key={selectedTask.id}
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(patch) => updateTask.mutate(patch)}
            onDelete={(t) => deleteTask.mutate(t)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export const TodayPage = () => (
  <SmartPage config={{
    title: t('today.title' as MessageKey), smart: 'today', icon: Sun, allowAdd: true, pose: 'happy',
    emptyTitle: t('today.emptyTitle' as MessageKey), emptyDescription: t('today.emptyDescription' as MessageKey),
  }} />
)

export const UpcomingPage = () => (
  <SmartPage config={{
    title: t('upcoming.title' as MessageKey), smart: 'week', icon: CalendarDays, allowAdd: false, pose: 'sleeping',
    emptyTitle: t('upcoming.emptyTitle' as MessageKey), emptyDescription: t('upcoming.emptyDescription' as MessageKey),
  }} />
)

export const OverduePage = () => (
  <SmartPage config={{
    title: t('overdue.title' as MessageKey), smart: 'overdue', icon: AlertCircle, allowAdd: false, pose: 'happy',
    emptyTitle: t('overdue.emptyTitle' as MessageKey), emptyDescription: t('overdue.emptyDescription' as MessageKey),
  }} />
)

export const AssignedPage = () => (
  <SmartPage config={{
    title: t('assigned.title' as MessageKey), smart: 'assigned', icon: UserCheck, allowAdd: false, pose: 'happy',
    emptyTitle: t('assigned.emptyTitle' as MessageKey), emptyDescription: t('assigned.emptyDescription' as MessageKey),
  }} />
)

export const AllTasksPage = () => (
  <SmartPage config={{
    title: t('allTasks.title' as MessageKey), smart: 'all', icon: Layers, allowAdd: true,
    emptyTitle: t('allTasks.emptyTitle' as MessageKey), emptyDescription: t('allTasks.emptyDescription' as MessageKey),
  }} />
)
