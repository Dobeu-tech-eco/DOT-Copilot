import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { useToast } from '../../store/toastStore'
import { FormInput, FormSelect } from '../../components/FormField'
import { Save } from 'lucide-react'

const profileSettingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  employee_id: z.string().optional(),
  timezone: z.string().optional(),
  preferred_language: z.string().optional(),
})

type ProfileSettingsData = z.infer<typeof profileSettingsSchema>

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
]

export function ProfileTab() {
  const { user } = useAuthStore()
  const { updateProfile } = useAppStore()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ProfileSettingsData>({
    resolver: zodResolver(profileSettingsSchema) as never,
    defaultValues: {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
      employee_id: user?.employee_id ?? '',
      timezone: user?.timezone ?? 'America/New_York',
      preferred_language: user?.preferred_language ?? 'en',
    },
  })

  const handleSubmit = form.handleSubmit(async (data: ProfileSettingsData) => {
    if (!user?.id) return
    setSubmitting(true)
    try {
      await updateProfile(user.id, data)
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">My Profile</h3>
        <p className="text-sm text-gray-500 mt-1">Update your personal information and preferences</p>
      </div>

      <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-xl">
        <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-2xl font-semibold text-white flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{user?.name ?? 'No name set'}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">{user?.role}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Full Name"
            required
            registration={form.register('name')}
            error={form.formState.errors.name?.message}
          />
          <FormInput
            label="Phone Number"
            type="tel"
            registration={form.register('phone')}
            placeholder="+1 (555) 000-0000"
          />
          <FormInput
            label="Employee ID"
            registration={form.register('employee_id')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            label="Timezone"
            options={TIMEZONE_OPTIONS}
            registration={form.register('timezone')}
          />
          <FormSelect
            label="Preferred Language"
            options={LANGUAGE_OPTIONS}
            registration={form.register('preferred_language')}
          />
        </div>

        <div className="pt-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Save size={15} />Save Profile</>}
          </button>
        </div>
      </form>
    </div>
  )
}
