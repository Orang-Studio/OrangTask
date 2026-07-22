import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

// offline queue: when the network is down, task creates/updates/completes are queued in localStorage

export interface QueuedAction {
  id: string
  type: 'create' | 'update' | 'complete' | 'uncomplete' | 'delete'
  path: string
  method: 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  createdAt: number
}

interface OfflineState {
  online: boolean
  queue: QueuedAction[]
  setOnline: (v: boolean) => void
  enqueue: (action: Omit<QueuedAction, 'id' | 'createdAt'>) => void
  flush: () => Promise<void>
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      queue: [],

      setOnline: (online) => {
        set({ online })
        if (online) get().flush()
      },

      enqueue: (action) => {
        const queued: QueuedAction = {
          ...action,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        }
        set({ queue: [...get().queue, queued] })
      },

      flush: async () => {
        const { queue } = get()
        if (queue.length === 0) return

        const remaining: QueuedAction[] = []
        for (const action of queue) {
          try {
            if (action.method === 'POST') await api.post(action.path, action.body)
            else if (action.method === 'PATCH') await api.patch(action.path, action.body)
            else if (action.method === 'DELETE') await api.delete(action.path)
          } catch {
            remaining.push(action)
          }
        }
        set({ queue: remaining })
      },
    }),
    { name: 'orangtask-offline-queue', partialize: (s) => ({ queue: s.queue }) }
  )
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useOfflineStore.getState().setOnline(true))
  window.addEventListener('offline', () => useOfflineStore.getState().setOnline(false))
}
