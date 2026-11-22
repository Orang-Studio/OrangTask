import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, fetchAllPages, Task } from '../lib/api'
import { useOfflineStore } from '../stores/offline'
import { usePendingTaskDeletionIds, useUndoableDeleteTask } from '../components/UndoableTaskDelete'

export type SmartView = 'today' | 'week' | 'overdue' | 'all' | 'assigned'

export function useTasks(opts: { listId?: string; smart?: SmartView; parentId?: string }) {
  const pendingDeletionIds = usePendingTaskDeletionIds()
  const params = new URLSearchParams()
  if (opts.listId) params.set('listId', opts.listId)
  if (opts.smart) params.set('smart', opts.smart)
  if (opts.parentId) params.set('parentId', opts.parentId)

  return useQuery({
    queryKey: ['tasks', opts],
    queryFn: () => fetchAllPages<Task>('/tasks', 'tasks', params),
    select: (tasks) => tasks.filter((task) => !pendingDeletionIds.has(task.id)),
  })
}

export function useCalendarTasks(from: Date, to: Date) {
  const pendingDeletionIds = usePendingTaskDeletionIds()
  const range = { smart: 'calendar', from: from.toISOString(), to: to.toISOString() }

  return useQuery({
    // under tasks so every task mutation refreshes the calendar too
    queryKey: ['tasks', range],
    queryFn: () => fetchAllPages<Task>('/tasks', 'tasks', new URLSearchParams(range)),
    select: (tasks) => tasks.filter((task) => !pendingDeletionIds.has(task.id)),
    placeholderData: (previous) => previous,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Task>) => api.post<{ task: Task }>('/tasks', body).then((d) => d.task),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['lists'] })
    },
    onError: (_e, body) => {

      if (!navigator.onLine) {
        useOfflineStore.getState().enqueue({ type: 'create', path: '/tasks', method: 'POST', body })
      }
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Task>) =>
      api.patch<{ task: Task }>(`/tasks/${id}`, body).then((d) => d.task),
    onMutate: async ({ id, ...body }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })
      qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...body } : t))
      )
      return { previous }
    },
    onError: (_e, vars, ctx) => {
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data))
      if (!navigator.onLine) {
        const { id, ...body } = vars
        useOfflineStore.getState().enqueue({ type: 'update', path: `/tasks/${id}`, method: 'PATCH', body })
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, complete }: { id: string; complete: boolean }) =>
      api.post<{ task: Task }>(`/tasks/${id}/${complete ? 'complete' : 'uncomplete'}`),
    onMutate: async ({ id, complete }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })
      qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) =>
        old?.map((t) =>
          t.id === id
            ? { ...t, status: complete ? 'done' : 'todo', completed_at: complete ? new Date().toISOString() : null }
            : t
        )
      )
      return { previous }
    },
    onError: (_e, vars, ctx) => {
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data))
      if (!navigator.onLine) {
        useOfflineStore.getState().enqueue({
          type: vars.complete ? 'complete' : 'uncomplete',
          path: `/tasks/${vars.id}/${vars.complete ? 'complete' : 'uncomplete'}`,
          method: 'POST',
        })
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

export function useDeleteTask() {
  return useUndoableDeleteTask()
}

export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.patch('/tasks/reorder', { items: ids.map((id, position) => ({ id, position })) }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData<Task[]>({ queryKey: ['tasks'] })
      const index = new Map(ids.map((id, i) => [id, i]))
      previous.forEach(([key, old]) => {
        if (!old?.some((t) => index.has(t.id))) return
        const moved = old.map((t) => (index.has(t.id) ? { ...t, position: index.get(t.id)! } : t))
        // smart views sort by date only list and subtask views follow positions
        const opts = key[1] as { listId?: string; smart?: string } | undefined
        if (opts?.listId && !opts.smart) moved.sort((a, b) => a.position - b.position)
        qc.setQueryData(key, moved)
      })
      return { previous }
    },
    onError: (_e, ids, ctx) => {
      // offline the new order stays on screen and is sent on reconnect
      if (!navigator.onLine) {
        useOfflineStore.getState().enqueue({
          type: 'update',
          path: '/tasks/reorder',
          method: 'PATCH',
          body: { items: ids.map((id, position) => ({ id, position })) },
        })
        return
      }
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      if (navigator.onLine) qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
