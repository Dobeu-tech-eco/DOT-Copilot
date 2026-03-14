import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { usePermissions } from '../hooks/usePermissions'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ProfileTab } from './settings/ProfileTab'
import { NotificationsTab } from './settings/NotificationsTab'
import { TeamTab } from './settings/TeamTab'
import { User, Bell, Users } from 'lucide-react'

type SettingsTab = 'profile' | 'notifications' | 'team'

export function SettingsPage() {
  const { user } = useAuthStore()
  const { fetchProfiles, fetchFleet, loading } = useAppStore()
  const { canManageUsers } = usePermissions()
  const [tab, setTab] = useState<SettingsTab>('profile')

  useEffect(() => {
    if (user?.fleet_id) {
      fetchFleet(user.fleet_id)
      if (canManageUsers) {
        fetchProfiles(user.fleet_id)
      }
    }
  }, [user?.fleet_id, canManageUsers])

  if (loading.fleet) return <LoadingSpinner />

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'profile', label: 'My Profile', icon: <User size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    ...(canManageUsers ? [{ id: 'team' as SettingsTab, label: 'Team', icon: <Users size={16} />, adminOnly: true }] : []),
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, notifications, and team preferences</p>
      </div>

      <div className="flex gap-6">
        <aside className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  tab === t.id
                    ? 'bg-baldor-50 text-baldor-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className={tab === t.id ? 'text-baldor-600' : 'text-gray-400'}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 card p-6">
          {tab === 'profile' && <ProfileTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'team' && canManageUsers && <TeamTab />}
        </div>
      </div>
    </div>
  )
}
