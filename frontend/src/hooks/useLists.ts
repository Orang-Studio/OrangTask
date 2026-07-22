import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, List, Member, Tag } from '../lib/api'

export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: () => api.get<{ lists: List[] }>('/lists').then((d) => d.lists),
  })
}

export function useCreateList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<List>) => api.post<{ list: List }>('/lists', body).then((d) => d.list),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  })
}

export function useUpdateList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<List>) =>
      api.patch<{ list: List }>(`/lists/${id}`, body).then((d) => d.list),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  })
}

export function useDeleteList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/lists/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useListMembers(listId: string | undefined) {
  return useQuery({
    queryKey: ['list-members', listId],
    queryFn: () => api.get<{ members: Member[] }>(`/lists/${listId}/members`).then((d) => d.members),
    enabled: !!listId,
  })
}

export function useInviteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, email, role }: { listId: string; email: string; role?: string }) =>
      api.post(`/lists/${listId}/members`, { email, role }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['list-members', vars.listId] }),
  })
}

export function useUpdateMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, userId, role }: { listId: string; userId: string; role: string }) =>
      api.patch(`/lists/${listId}/members/${userId}`, { role }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['list-members', vars.listId] }),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: string }) =>
      api.delete(`/lists/${listId}/members/${userId}`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['list-members', vars.listId] }),
  })
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get<{ tags: Tag[] }>('/tags').then((d) => d.tags),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; color?: string }) => api.post<{ tag: Tag }>('/tags', body).then((d) => d.tag),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useAddTagToTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) =>
      api.post(`/tasks/${taskId}/tags/${tagId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useRemoveTagFromTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) =>
      api.delete(`/tasks/${taskId}/tags/${tagId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
