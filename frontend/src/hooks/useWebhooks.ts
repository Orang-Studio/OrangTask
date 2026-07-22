import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Webhook, WebhookDelivery } from '../lib/api'

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get<{ webhooks: Webhook[] }>('/webhooks').then((d) => d.webhooks),
  })
}

export function useCreateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Webhook>) => api.post<{ webhook: Webhook }>('/webhooks', body).then((d) => d.webhook),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

export function useUpdateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Webhook>) =>
      api.patch<{ webhook: Webhook }>(`/webhooks/${id}`, body).then((d) => d.webhook),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

export function useDeleteWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

export function useWebhookDeliveries(id: string | undefined) {
  return useQuery({
    queryKey: ['webhook-deliveries', id],
    queryFn: () => api.get<{ deliveries: WebhookDelivery[] }>(`/webhooks/${id}/deliveries`).then((d) => d.deliveries),
    enabled: !!id,
  })
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ statusCode: number; responseBody: string; error: string }>(`/webhooks/${id}/test`),
  })
}
