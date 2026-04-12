import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { useToast } from '../store/toastStore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Bell, CheckCheck, Trash2, Clock, AlertCircle, Info, CheckCircle } from 'lucide-react'
import type { Notification } from '../types/database'

type FilterType = 'all' | 'unread' | 'read'

const typeIcons: Record<string, React.ReactNode> = {
  compliance: <AlertCircle size={16} className="text-amber-500" />,
  training: <CheckCircle size={16} className="text-blue-500" />,
  system: <Info size={16} className="text-gray-500" />,
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function NotificationsPage() {
  const { user } = useAuthStore()
  const {
    notifications, loading,
    fetchNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification,
  } = useAppStore()
  const toast = useToast()

  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    if (user?.id) fetchNotifications(user.id)
  }, [user?.id, fetchNotifications])

  if (loading.notifications) return <LoadingSpinner />

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'read') return n.is_read
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  const handleMarkRead = async (n: Notification) => {
    if (n.is_read) return
    try { await markNotificationRead(n.id) }
    catch { toast.error('Failed to mark as read') }
  }

  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount === 0) return
    try {
      await markAllNotificationsRead(user.id)
      toast.success('All notifications marked as read')
    } catch { toast.error('Failed to mark all as read') }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id)
      toast.success('Notification deleted')
    } catch { toast.error('Failed to delete notification') }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-secondary flex items-center gap-2">
            <CheckCheck size={16} /> Mark All Read
          </button>
        )}
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['all', 'unread', 'read'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Bell size={28} />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            description={filter === 'unread' ? 'All caught up!' : 'Notifications will appear here as events occur'}
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(n => (
              <div
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-gray-50 ${!n.is_read ? 'bg-baldor-50/30' : ''}`}
              >
                <div className="shrink-0 mt-0.5">
                  {typeIcons[n.notification_type] ?? <Bell size={16} className="text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  {n.title && <p className="text-sm font-medium text-gray-900">{n.title}</p>}
                  <p className="text-sm text-gray-600 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Clock size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-baldor-500" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n)}
                      className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
