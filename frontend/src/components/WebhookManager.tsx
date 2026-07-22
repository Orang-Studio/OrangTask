import { useState } from 'react'
import { Plus, Trash2, Send, Copy, ChevronDown, ChevronRight, Check, X, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import {
  useWebhooks, useCreateWebhook, useDeleteWebhook, useUpdateWebhook,
  useWebhookDeliveries, useTestWebhook,
} from '../hooks/useWebhooks'
import { Webhook } from '../lib/api'
import { formatDueDate } from '../lib/date'
import { useHaptics } from '../hooks/useHaptics'

const OUTGOING_EVENTS = ['task.created', 'task.updated', 'task.completed', 'task.deleted', 'task.due_soon', 'list.shared']

function DeliveryLog({ webhookId }: { webhookId: string }) {
  const { data: deliveries } = useWebhookDeliveries(webhookId)
  if (!deliveries || deliveries.length === 0) {
    return <p className="text-sm text-gray-400 py-2">No deliveries yet.</p>
  }
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {deliveries.map((d) => (
        <div key={d.id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 dark:border-ink-700">
          <span className={`px-1.5 py-0.5 rounded font-mono ${
            d.status_code && d.status_code < 400
              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
          }`}>
            {d.status_code || 'ERR'}
          </span>
          <span className="font-medium">{d.event}</span>
          <span className="text-gray-400 ml-auto">{formatDueDate(d.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

function WebhookCard({ webhook }: { webhook: Webhook }) {
  const deleteWebhook = useDeleteWebhook()
  const updateWebhook = useUpdateWebhook()
  const testWebhook = useTestWebhook()
  const haptics = useHaptics()
  const [expanded, setExpanded] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const incomingUrl = webhook.incoming_token
    ? `${window.location.origin}/api/hooks/${webhook.incoming_token}`
    : null

  const handleTest = async () => {
    haptics.tap()
    const result = await testWebhook.mutateAsync(webhook.id)
    setTestResult(result.error ? `Error: ${result.error}` : `${result.statusCode} OK`)
    setTimeout(() => setTestResult(null), 4000)
  }

  return (
    <div className="surface">
      <div className="flex items-center gap-3 px-4 py-3">
        {webhook.direction === 'incoming'
          ? <ArrowDownToLine size={18} className="text-blue-500 flex-shrink-0" />
          : <ArrowUpFromLine size={18} className="text-orange-500 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{webhook.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${webhook.enabled ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-gray-100 dark:bg-ink-700 text-gray-500'}`}>
              {webhook.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="text-xs text-gray-400 truncate">{webhook.url || incomingUrl}</div>
        </div>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={webhook.enabled}
            onChange={(e) => updateWebhook.mutate({ id: webhook.id, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-300 dark:bg-ink-600 peer-checked:bg-orange-500 rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:w-4 after:h-4 after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
        </label>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-ink-700 pt-3">
          {incomingUrl && (
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">Incoming URL</label>
              <div className="flex gap-2 mt-1">
                <code className="flex-1 text-xs bg-gray-100 dark:bg-ink-900 px-2 py-2 truncate rounded">{incomingUrl}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(incomingUrl)
                    setCopied(true)
                    haptics.success()
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="btn-secondary px-3"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {webhook.direction === 'outgoing' && (
            <>
              {webhook.events && webhook.events.length > 0 && (
                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-400">Events</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {webhook.events.map((e) => (
                      <span key={e} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-ink-700 rounded font-mono">{e}</span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleTest} disabled={testWebhook.isPending} className="btn-secondary">
                <Send size={14} className="mr-2" />
                {testWebhook.isPending ? 'Sending...' : 'Send test'}
              </button>
              {testResult && <span className="text-sm ml-2">{testResult}</span>}

              <div>
                <label className="text-xs uppercase tracking-wide text-gray-400">Delivery log</label>
                <DeliveryLog webhookId={webhook.id} />
              </div>
            </>
          )}

          <button
            onClick={() => {
              if (confirm('Delete this webhook?')) {
                haptics.error()
                deleteWebhook.mutate(webhook.id)
              }
            }}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600"
          >
            <Trash2 size={14} /> Delete webhook
          </button>
        </div>
      )}
    </div>
  )
}

export function WebhookManager() {
  const { data: webhooks } = useWebhooks()
  const createWebhook = useCreateWebhook()
  const haptics = useHaptics()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['task.completed'])

  const handleCreate = async () => {
    if (!name.trim()) return
    if (direction === 'outgoing' && !url.trim()) return
    haptics.success()
    await createWebhook.mutateAsync({
      name: name.trim(),
      url: direction === 'outgoing' ? url.trim() : undefined,
      direction,
      events: direction === 'outgoing' ? selectedEvents : undefined,
    })
    setName('')
    setUrl('')
    setSelectedEvents(['task.completed'])
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {webhooks?.map((w) => <WebhookCard key={w.id} webhook={w} />)}

      {showForm ? (
        <div className="surface p-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setDirection('outgoing')}
              className={`flex-1 px-3 h-10 text-sm font-medium border transition-colors ${direction === 'outgoing' ? 'border-orange-500 bg-orange-50 dark:bg-ink-700' : 'border-gray-300 dark:border-ink-600'}`}
            >
              Outgoing
            </button>
            <button
              onClick={() => setDirection('incoming')}
              className={`flex-1 px-3 h-10 text-sm font-medium border transition-colors ${direction === 'incoming' ? 'border-orange-500 bg-orange-50 dark:bg-ink-700' : 'border-gray-300 dark:border-ink-600'}`}
            >
              Incoming
            </button>
          </div>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Webhook name" className="input-field" />

          {direction === 'outgoing' && (
            <>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" className="input-field" />
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">Events</label>
                <div className="flex flex-wrap gap-1.5">
                  {OUTGOING_EVENTS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setSelectedEvents((s) => s.includes(e) ? s.filter((x) => x !== e) : [...s, e])}
                      className={`text-xs px-2 py-1 rounded font-mono transition-colors ${selectedEvents.includes(e) ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-ink-700'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {direction === 'incoming' && (
            <p className="text-sm text-gray-500 dark:text-ink-400">
              An incoming URL will be generated. POST a JSON task to it to create tasks from external tools.
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary flex-1">Create</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary px-4"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="btn-secondary w-full">
          <Plus size={16} className="mr-2" /> Add webhook
        </button>
      )}
    </div>
  )
}
