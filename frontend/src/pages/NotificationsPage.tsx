import { ArrowLeft, Bell, Check, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, useMarkRead, useMarkAllRead } from '../hooks/useNotifications'
import { EmptyState } from '../components/EmptyState'
import { TaskListSkeleton } from '../components/Skeleton'
import { formatDueDate } from '../lib/date'
import { t, type MessageKey } from '../lib/i18n'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { data: notifications, isLoading } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const unread = notifications?.filter((n) => !n.read).length ?? 0

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-gray-200 dark:border-ink-700">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="md:hidden p-1 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold uppercase tracking-wide">{t('notifications.title' as MessageKey)}</h1>
          {unread > 0 && <span className="text-sm text-orange-500">{t('notifications.newCount' as MessageKey, { count: unread })}</span>}
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-500"
          >
            <CheckCheck size={16} /> {t('notifications.markAllRead' as MessageKey)}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <TaskListSkeleton />
        ) : notifications && notifications.length > 0 ? (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.read) markRead.mutate(n.id)
                const listId = (n.metadata as any)?.list_id
                if (listId) navigate(`/list/${listId}`)
              }}
              className={`w-full flex items-start gap-3 px-4 md:px-6 py-3 text-left border-b border-gray-200 dark:border-ink-700 transition-colors hover:bg-gray-50 dark:hover:bg-ink-750 ${
                !n.read ? 'bg-orange-50/50 dark:bg-ink-850' : ''
              }`}
            >
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-orange-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-sm text-gray-500 dark:text-ink-400 mt-0.5">{n.body}</div>}
                <div className="text-xs text-gray-400 mt-1">{formatDueDate(n.created_at)}</div>
              </div>
            </button>
          ))
        ) : (
          <EmptyState icon={Bell} title={t('notifications.emptyTitle' as MessageKey)} description={t('notifications.emptyDescription' as MessageKey)} pose="happy" />
        )}
      </div>
    </div>
  )
}
