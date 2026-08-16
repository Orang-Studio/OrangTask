import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, fetchAllPages, Scratchpad } from '../lib/api'
export function useScratchpads() {
  return useQuery({
    queryKey: ['scratchpads'],
    queryFn: () => fetchAllPages<Scratchpad>('/scratchpads', 'scratchpads'),
  })
}

export function useCreateScratchpad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { title?: string; content?: string }) =>
      api.post<{ scratchpad: Scratchpad }>('/scratchpads', body).then((d) => d.scratchpad),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scratchpads'] }),
  })
}

export function useUpdateScratchpad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Pick<Scratchpad, 'title' | 'content' | 'position'>>) =>
      api.patch<{ scratchpad: Scratchpad }>(`/scratchpads/${id}`, body).then((d) => d.scratchpad),
    onSuccess: (updated) => {
      qc.setQueryData<Scratchpad[]>(['scratchpads'], (prev) =>
        prev?.map((p) => (p.id === updated.id ? updated : p)),
      )
    },
  })
}

export function useDeleteScratchpad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/scratchpads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scratchpads'] }),
  })
}