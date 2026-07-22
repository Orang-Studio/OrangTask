import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Notification } from '../lib/api'

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ notifications: Notification[] }>('/notifications').then((d) => d.notifications),
    refetchInterval: 60000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
