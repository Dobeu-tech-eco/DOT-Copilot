import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { useToast } from '../../store/toastStore'
import { Mail, MessageSquare, Bell, BellOff, TriangleAlert as AlertTriangle } from 'lucide-react'
import {
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  getPushPermission,
} from '../../services/push.service'

interface ChannelCardProps {
  icon: React.ReactNode
  title: string
  description: string
  detail?: string
  enabled: boolean
  onChange: (val: boolean) => Promise<void>
  disabled?: boolean
  disabledReason?: string
}

function ChannelCard({ icon, title, description, detail, enabled, onChange, disabled, disabledReason }: ChannelCardProps) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    if (disabled || loading) return
    setLoading(true)
    try {
      await onChange(!enabled)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`rounded-xl border p-5 transition-all ${enabled ? 'border-baldor-200 bg-baldor-50/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl ${enabled ? 'bg-baldor-100 text-baldor-600' : 'bg-gray-100 text-gray-400'}`}>
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            {detail && <p className="text-xs text-gray-400 mt-1.5 font-medium">{detail}</p>}
            {disabled && disabledReason && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <AlertTriangle size={11} />
                {disabledReason}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={disabled || loading}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-baldor-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${enabled ? 'bg-baldor-600' : 'bg-gray-200'}`}
          role="switch"
          aria-checked={enabled}
        >
          {loading
            ? <span className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </span>
            : <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />}
        </button>
      </div>
    </div>
  )
}

export function NotificationsTab() {
  const { user } = useAuthStore()
  const { updateNotificationPreferences } = useAppStore()
  const toast = useToast()
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const pushSupported = isPushSupported()

  useEffect(() => {
    setPushPermission(getPushPermission())
  }, [])

  const updatePref = async (field: 'prefer_email' | 'prefer_sms' | 'prefer_push', value: boolean) => {
    if (!user?.id) return
    try {
      await updateNotificationPreferences(user.id, { [field]: value })
      toast.success('Notification preference saved')
    } catch {
      toast.error('Failed to save preference')
    }
  }

  const handlePushToggle = async (value: boolean) => {
    if (!user?.id) return
    try {
      if (value) {
        const success = await subscribeToPush()
        if (!success) {
          const perm = getPushPermission()
          setPushPermission(perm)
          if (perm === 'denied') {
            toast.error('Push notifications blocked. Please allow them in your browser settings.')
            return
          }
          toast.error('Failed to enable push notifications')
          return
        }
        setPushPermission('granted')
        await updateNotificationPreferences(user.id, { prefer_push: true })
        toast.success('Push notifications enabled')
      } else {
        await unsubscribeFromPush()
        await updateNotificationPreferences(user.id, { prefer_push: false })
        toast.success('Push notifications disabled')
      }
    } catch {
      toast.error('Failed to update push notifications')
    }
  }

  const hasPhone = !!user?.phone

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Notification Preferences</h3>
        <p className="text-sm text-gray-500 mt-1">Choose how you receive alerts, reminders, and updates</p>
      </div>

      <div className="space-y-3">
        <ChannelCard
          icon={<Mail size={18} />}
          title="Email Notifications"
          description="Receive compliance alerts, training reminders, and updates via email"
          detail={`Sent to: ${user?.email}`}
          enabled={user?.prefer_email ?? true}
          onChange={val => updatePref('prefer_email', val)}
        />

        <ChannelCard
          icon={<MessageSquare size={18} />}
          title="SMS Notifications"
          description="Receive urgent alerts and reminders via text message"
          detail={hasPhone ? `Sent to: ${user?.phone}` : undefined}
          enabled={user?.prefer_sms ?? false}
          onChange={val => updatePref('prefer_sms', val)}
          disabled={!hasPhone}
          disabledReason={!hasPhone ? 'Add a phone number in My Profile to enable SMS' : undefined}
        />

        <ChannelCard
          icon={pushPermission === 'denied' ? <BellOff size={18} /> : <Bell size={18} />}
          title="Browser Push Notifications"
          description="Receive real-time alerts directly in your browser, even when the app is closed"
          enabled={user?.prefer_push ?? false}
          onChange={handlePushToggle}
          disabled={!pushSupported || pushPermission === 'denied'}
          disabledReason={
            !pushSupported
              ? 'Your browser does not support push notifications'
              : pushPermission === 'denied'
              ? 'Push notifications blocked in browser settings. Click the lock icon in your address bar to allow them.'
              : undefined
          }
        />
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
        <p className="text-xs text-blue-700">
          <span className="font-medium">Note: </span>
          You will always receive in-app notifications regardless of these settings.
          SMS and push delivery depend on your fleet administrator enabling those channels.
        </p>
      </div>
    </div>
  )
}
