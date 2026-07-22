import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface SearchResult {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  list_id: string
  list_name: string
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () =>
      api.get<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`).then((d) => d.results),
    enabled: query.length >= 2,
  })
}
