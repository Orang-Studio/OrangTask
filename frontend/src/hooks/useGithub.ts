import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, fetchAllPages, GithubConnection, GithubItem, GithubItemKind, GithubStatus } from '../lib/api'
export function useGithubStatus() {
  return useQuery({
    queryKey: ['github-status'],
    queryFn: () => api.get<GithubStatus>('/github/status'),
  })
}

export function useGithubItems(kind?: GithubItemKind) {
  return useQuery({
    queryKey: ['github-items', kind ?? 'all'],
    queryFn: () =>
      fetchAllPages<GithubItem>('/github/items', 'items', kind ? new URLSearchParams({ kind }) : undefined),
  })
}
export function useSyncGithub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ items: number; list_id: string }>('/github/sync'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-status'] })
      qc.invalidateQueries({ queryKey: ['github-items'] })
      qc.invalidateQueries({ queryKey: ['lists'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useUpdateGithubSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, boolean>) =>
      api.patch<{ connection: GithubConnection }>('/github/settings', body).then((d) => d.connection),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github-status'] }),
  })
}

export function useDisconnectGithub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deleteTasks: boolean) => api.post('/github/disconnect', { deleteTasks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-status'] })
      qc.invalidateQueries({ queryKey: ['github-items'] })
      qc.invalidateQueries({ queryKey: ['lists'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}