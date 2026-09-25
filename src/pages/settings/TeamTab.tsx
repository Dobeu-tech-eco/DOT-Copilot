import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { useToast } from '../../store/toastStore'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FormInput, FormSelect, FormSection } from '../../components/FormField'
import { createUserSchema, USER_ROLES } from '../../schemas/profile.schema'
import type { CreateUserFormData } from '../../schemas/profile.schema'
import type { Profile, UserRole } from '../../types/database'
import { Mail, MessageSquare, Bell, UserPlus, Power, Search, Settings2 } from 'lucide-react'

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  BRANCH_MANAGER: 'Branch Manager',
  SUPERVISOR: 'Supervisor',
  DRIVER_COACH: 'Driver Coach',
  DRIVER: 'Driver',
}
const roleOptions = USER_ROLES.map(r => ({ value: r, label: roleLabels[r] }))

function NotifToggle({ enabled, onChange, icon, label }: { enabled: boolean; onChange: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onChange}
      title={label}
      className={`p-1.5 rounded-lg transition-colors ${enabled ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
    >
      {icon}
    </button>
  )
}

interface UserNotifRowProps {
  profile: Profile
  onToggle: (id: string, field: 'prefer_email' | 'prefer_sms' | 'prefer_push', val: boolean) => void
  onToggleActive: (p: Profile) => void
}

function UserNotifRow({ profile, onToggle, onToggleActive }: UserNotifRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
            {profile.name?.[0]?.toUpperCase() ?? profile.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{profile.name ?? 'Unnamed'}</p>
            <p className="text-xs text-gray-500">{profile.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-xs text-gray-500">{roleLabels[profile.role]}</span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1">
          <NotifToggle
            enabled={profile.prefer_email}
            onChange={() => onToggle(profile.id, 'prefer_email', !profile.prefer_email)}
            icon={<Mail size={14} />}
            label="Email notifications"
          />
          <NotifToggle
            enabled={profile.prefer_sms}
            onChange={() => onToggle(profile.id, 'prefer_sms', !profile.prefer_sms)}
            icon={<MessageSquare size={14} />}
            label="SMS notifications"
          />
          <NotifToggle
            enabled={profile.prefer_push}
            onChange={() => onToggle(profile.id, 'prefer_push', !profile.prefer_push)}
            icon={<Bell size={14} />}
            label="Push notifications"
          />
        </div>
      </td>
      <td className="px-5 py-3.5">
        {profile.is_active
          ? <span className="badge badge-success">Active</span>
          : <span className="badge badge-neutral">Inactive</span>}
      </td>
      <td className="px-5 py-3.5 text-right">
        <button
          onClick={() => onToggleActive(profile)}
          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
          title={profile.is_active ? 'Deactivate user' : 'Activate user'}
        >
          <Power size={14} />
        </button>
      </td>
    </tr>
  )
}

export function TeamTab() {
  const { user } = useAuthStore()
  const { profiles, fleet, updateNotificationPreferences, toggleUserActive, createUser, fetchProfiles, updateFleetNotificationSettings } = useAppStore()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const createForm = useForm<CreateUserFormData>({ resolver: zodResolver(createUserSchema) as never })

  const filtered = profiles.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggleNotif = async (id: string, field: 'prefer_email' | 'prefer_sms' | 'prefer_push', val: boolean) => {
    try {
      await updateNotificationPreferences(id, { [field]: val })
    } catch {
      toast.error('Failed to update preference')
    }
  }

  const handleToggleActive = async () => {
    if (!toggleTarget) return
    setSubmitting(true)
    try {
      await toggleUserActive(toggleTarget.id, !toggleTarget.is_active)
      toast.success(toggleTarget.is_active ? 'User deactivated' : 'User activated')
      setToggleTarget(null)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreate = createForm.handleSubmit(async (data: CreateUserFormData) => {
    if (!user?.fleet_id) return
    setSubmitting(true)
    try {
      await createUser(user.fleet_id, data)
      await fetchProfiles(user.fleet_id)
      toast.success('User created')
      setCreateModal(false)
      createForm.reset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  })

  const handleFleetToggle = async (field: 'enable_sms_notifications' | 'enable_push_notifications', val: boolean) => {
    if (!fleet?.id) return
    try {
      await updateFleetNotificationSettings(fleet.id, { [field]: val })
      toast.success('Fleet settings updated')
    } catch {
      toast.error('Failed to update fleet settings')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-500 mt-1">Manage notification preferences and account status for all users</p>
        </div>
        <button onClick={() => { createForm.reset(); setCreateModal(true) }} className="btn-primary">
          <UserPlus size={15} />
          Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <p className="text-xs text-gray-500 ml-auto">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">User</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Notifications</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <UserNotifRow
                  key={p.id}
                  profile={p}
                  onToggle={handleToggleNotif}
                  onToggleActive={setToggleTarget}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {fleet && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Settings2 size={16} className="text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">Fleet Notification Defaults</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Enable or disable notification channels for the entire fleet</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`rounded-xl border p-5 transition-all ${fleet.enable_sms_notifications ? 'border-brand-200 bg-brand-50/30' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${fleet.enable_sms_notifications ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">SMS Notifications</p>
                    <p className="text-xs text-gray-500">Allow SMS delivery for the fleet</p>
                  </div>
                </div>
                <button
                  onClick={() => handleFleetToggle('enable_sms_notifications', !fleet.enable_sms_notifications)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${fleet.enable_sms_notifications ? 'bg-brand-600' : 'bg-gray-200'}`}
                  role="switch"
                  aria-checked={fleet.enable_sms_notifications}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${fleet.enable_sms_notifications ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            <div className={`rounded-xl border p-5 transition-all ${fleet.enable_push_notifications ? 'border-brand-200 bg-brand-50/30' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${fleet.enable_push_notifications ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Bell size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Push Notifications</p>
                    <p className="text-xs text-gray-500">Allow browser push delivery for the fleet</p>
                  </div>
                </div>
                <button
                  onClick={() => handleFleetToggle('enable_push_notifications', !fleet.enable_push_notifications)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${fleet.enable_push_notifications ? 'bg-brand-600' : 'bg-gray-200'}`}
                  role="switch"
                  aria-checked={fleet.enable_push_notifications}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${fleet.enable_push_notifications ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Add New User">
        <form onSubmit={handleCreate} className="space-y-5">
          <FormSection title="Account Details">
            <FormInput label="Full Name" required registration={createForm.register('name')} error={createForm.formState.errors.name?.message} />
            <FormInput label="Email" type="email" required registration={createForm.register('email')} error={createForm.formState.errors.email?.message} />
            <FormSelect label="Role" required options={roleOptions} registration={createForm.register('role')} error={createForm.formState.errors.role?.message} />
            <FormInput label="Password" type="password" required registration={createForm.register('password')} error={createForm.formState.errors.password?.message} />
          </FormSection>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleActive}
        title={toggleTarget?.is_active ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${toggleTarget?.is_active ? 'deactivate' : 'activate'} ${toggleTarget?.name ?? 'this user'}?`}
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
        loading={submitting}
      />
    </div>
  )
}
