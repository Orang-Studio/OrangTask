import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QueryKey, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, X } from 'lucide-react'
import { api, Task } from '../lib/api'
import { scheduleDelete } from '../lib/undoableDelete'
import { useOfflineStore } from '../stores/offline'

interface RestorePoint {
  key: QueryKey
  index: number
}

interface PendingDeletion {
  task: Task
  restorePoints: RestorePoint[]
  timer: ReturnType<typeof setTimeout>
}

interface DeleteTaskContextValue {
  mutate: (task: Task) => void
  pendingIds: ReadonlySet<string>
}

const DeleteTaskContext = createContext<DeleteTaskContextValue | null>(null)

export function useUndoableDeleteTask() {
  const context = useContext(DeleteTaskContext)
  if (!context) throw new Error('useUndoableDeleteTask outside provider')
  return { mutate: context.mutate }
}

export function usePendingTaskDeletionIds() {
  const context = useContext(DeleteTaskContext)
  if (!context) throw new Error('usePendingTaskDeletionIds outside provider')
  return context.pendingIds
}

export function UndoableTaskDeleteProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const pendingRef = useRef(new Map<string, PendingDeletion>())
  const operationChain = useRef(Promise.resolve())
  const [pending, setPending] = useState<PendingDeletion[]>([])
  const [error, setError] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const restoreTask = useCallback((deletion: PendingDeletion) => {
    for (const { key, index } of deletion.restorePoints) {
      queryClient.setQueryData<Task[]>(key, (tasks) => {
        if (!tasks || tasks.some((task) => task.id === deletion.task.id)) return tasks
        const restored = [...tasks]
        restored.splice(Math.min(index, restored.length), 0, deletion.task)
        return restored
      })
    }
  }, [queryClient])

  const showError = useCallback((message: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    setError(message)
    errorTimerRef.current = setTimeout(() => setError(null), 5000)
  }, [])

  const sendDelete = useCallback(async (deletion: PendingDeletion) => {
    if (!useOfflineStore.getState().online) {
      useOfflineStore.getState().enqueue({
        type: 'delete',
        path: `/tasks/${deletion.task.id}`,
        method: 'DELETE',
      })
      return
    }

    try {
      await api.delete(`/tasks/${deletion.task.id}`)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    } catch {
      if (!navigator.onLine) {
        useOfflineStore.getState().enqueue({
          type: 'delete',
          path: `/tasks/${deletion.task.id}`,
          method: 'DELETE',
        })
        return
      }
      restoreTask(deletion)
      showError('Could not delete task')
    }
  }, [queryClient, restoreTask, showError])

  const commit = useCallback((deletion: PendingDeletion) => {
    clearTimeout(deletion.timer)
    if (pendingRef.current.get(deletion.task.id) === deletion) {
      pendingRef.current.delete(deletion.task.id)
      setPending((current) => current.filter((item) => item !== deletion))
    }
    void sendDelete(deletion)
  }, [sendDelete])

  const stageDelete = useCallback(async (task: Task) => {
    if (pendingRef.current.has(task.id)) return

    await queryClient.cancelQueries({ queryKey: ['tasks'] })
    const restorePoints: RestorePoint[] = []
    const cachedQueries = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] })

    for (const [key, tasks] of cachedQueries) {
      const index = tasks?.findIndex((cachedTask) => cachedTask.id === task.id) ?? -1
      if (index >= 0) restorePoints.push({ key, index })
      queryClient.setQueryData<Task[]>(key, (current) =>
        current?.filter((cachedTask) => cachedTask.id !== task.id)
      )
    }

    const deletion: PendingDeletion = {
      task,
      restorePoints,
      timer: scheduleDelete(() => {
        const current = pendingRef.current.get(task.id)
        if (current) commit(current)
      }),
    }
    pendingRef.current.set(task.id, deletion)
    setPending((current) => [...current, deletion])
  }, [commit, queryClient])

  const mutate = useCallback((task: Task) => {
    operationChain.current = operationChain.current.then(() => stageDelete(task))
  }, [stageDelete])

  const undo = useCallback((deletion: PendingDeletion) => {
    if (pendingRef.current.get(deletion.task.id) !== deletion) return
    clearTimeout(deletion.timer)
    pendingRef.current.delete(deletion.task.id)
    setPending((current) => current.filter((item) => item !== deletion))
    restoreTask(deletion)
  }, [restoreTask])

  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
  }, [])

  const pendingIds = useMemo(
    () => new Set(pending.map((deletion) => deletion.task.id)),
    [pending]
  )
  const contextValue = useMemo(() => ({ mutate, pendingIds }), [mutate, pendingIds])

  return (
    <DeleteTaskContext.Provider value={contextValue}>
      {children}
      <div
        className="fixed z-[100] left-4 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:left-auto md:right-6 md:bottom-6 md:w-96"
        aria-live="polite"
      >
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {pending.map((deletion) => (
              <motion.div
                key={deletion.task.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                role="status"
                className="flex items-center gap-3 bg-ink-900 dark:bg-white text-white dark:text-ink-900 px-4 py-3 shadow-xl"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  Deleted “{deletion.task.title}”
                </span>
                <button
                  type="button"
                  onClick={() => undo(deletion)}
                  className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-orange-400 hover:text-orange-300"
                >
                  <RotateCcw size={15} /> Undo
                </button>
              </motion.div>
            ))}
            {error && (
              <motion.div
                key="delete-error"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                role="alert"
                className="flex items-center gap-3 bg-red-600 text-white px-4 py-3 shadow-xl"
              >
                <span className="flex-1 text-sm">{error}</span>
                <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                  <X size={17} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DeleteTaskContext.Provider>
  )
}
