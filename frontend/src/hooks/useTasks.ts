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
    mutationFn: (items: { id: string; position: number }[]) => api.patch('/tasks/reorder', { items }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
