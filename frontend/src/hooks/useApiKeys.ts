import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiKey } from '../lib/api'

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<{ keys: ApiKey[] }>('/api-keys').then((d) => d.keys),
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    // raw_key is only ever present in this one response never refetched or cached
    mutationFn: (name: string) =>
      api.post<{ key: ApiKey & { raw_key: string } }>('/api-keys', { name }).then((d) => d.key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}
