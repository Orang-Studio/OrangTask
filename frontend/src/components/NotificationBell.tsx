import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { useHaptics } from '../hooks/useHaptics'
import { t, type MessageKey } from '../lib/i18n'

export function NotificationBell() {
  const navigate = useNavigate()
  const haptics = useHaptics()
  const { data: notifications } = useNotifications()
  const unread = notifications?.filter((n) => !n.read).length ?? 0

  return (
    <button
      onClick={() => {
        haptics.tap()
        navigate('/notifications')
      }}
      aria-label={t('notifBell.notifications' as MessageKey)}
      className="relative p-2 text-gray-500 dark:text-ink-300 hover:text-orange-500 transition-colors"
    >
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-orange-500 text-white text-[10px] font-bold rounded-full">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
