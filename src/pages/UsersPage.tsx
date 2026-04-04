import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { TextInput, SelectInput, DateInput, CheckboxInput } from '../components/FormFields'
import { Users, Search, UserCheck, UserX, Shield, Plus, Pencil } from 'lucide-react'
import type { UserRole, Profile } from '../types/database'

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  BRANCH_MANAGER: 'Branch Manager',
  SUPERVISOR: 'Supervisor',
  DRIVER_COACH: 'Driver Coach',
  DRIVER: 'Driver',
}

const roleColors: Record<UserRole, string> = {
  ADMIN: 'badge-danger',
  BRANCH_MANAGER: 'badge-warning',
  SUPERVISOR: 'badge-info',
  DRIVER_COACH: 'badge-info',
  DRIVER: 'badge-neutral',
}

const roleOptions = [
  { value: 'DRIVER', label: 'Driver' },
  { value: 'DRIVER_COACH', label: 'Driver Coach' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'BRANCH_MANAGER', label: 'Branch Manager' },
  { value: 'ADMIN', label: 'Administrator' },
]

const emptyForm = {
  name: '',
  email: '',
  role: 'DRIVER' as UserRole,
  phone: '',
  employee_id: '',
  hire_date: '',
  is_active: true,
  preferred_language: 'en',
  timezone: 'America/New_York',
  prefer_email: true,
  prefer_sms: false,
  prefer_push: false,
  fleet_id: '',
  location_id: null as string | null,
  last_login_at: null as string | null,
}

export function UsersPage() {
  const { user } = useAuthStore()
  const { profiles, loading, fetchProfiles, addProfile, updateProfile } = useAppStore()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (user?.fleet_id) {
      fetchProfiles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchProfiles])

  const openAdd = () => {
    setEditingUser(null)
    setForm({ ...emptyForm, fleet_id: user?.fleet_id ?? '' })
    setShowModal(true)
  }

  const openEdit = (p: Profile) => {
    setEditingUser(p)
    setForm({
      name: p.name ?? '',
      email: p.email,
      role: p.role,
      phone: p.phone ?? '',
      employee_id: p.employee_id ?? '',
      hire_date: p.hire_date ?? '',
      is_active: p.is_active,
      preferred_language: p.preferred_language,
      timezone: p.timezone,
      prefer_email: p.prefer_email,
      prefer_sms: p.prefer_sms,
      prefer_push: p.prefer_push,
      fleet_id: p.fleet_id ?? '',
      location_id: p.location_id,
      last_login_at: p.last_login_at,
    })
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingUser) {
      updateProfile(editingUser.id, {
        name: form.name || null,
        email: form.email,
        role: form.role,
        phone: form.phone || null,
        employee_id: form.employee_id || null,
        hire_date: form.hire_date || null,
        is_active: form.is_active,
      })
    } else {
      addProfile({
        name: form.name || null,
        email: form.email,
        role: form.role,
        phone: form.phone || null,
        employee_id: form.employee_id || null,
        hire_date: form.hire_date || null,
        is_active: form.is_active,
        fleet_id: user?.fleet_id ?? null,
        location_id: null,
        preferred_language: 'en',
        timezone: 'America/New_York',
        prefer_email: form.prefer_email,
        prefer_sms: form.prefer_sms,
        prefer_push: form.prefer_push,
        last_login_at: null,
      })
    }
    setShowModal(false)
  }

  if (loading.profiles) return <LoadingSpinner />

  const filtered = profiles.filter(p => {
    const matchesSearch = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      p.employee_id?.toLowerCase().includes(search.toLowerCase())
    const matchesRole = !roleFilter || p.role === roleFilter
    const matchesStatus = !statusFilter ||
      (statusFilter === 'active' && p.is_active) ||
      (statusFilter === 'inactive' && !p.is_active)
    return matchesSearch && matchesRole && matchesStatus
  })

  const activeCount = profiles.filter(p => p.is_active).length
  const driverCount = profiles.filter(p => p.role === 'DRIVER').length
  const adminCount = profiles.filter(p => ['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR'].includes(p.role)).length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage drivers, supervisors, and administrator accounts</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Users size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{profiles.length}</p>
            <p className="text-xs text-gray-500">Total Users</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><UserCheck size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            <p className="text-xs text-gray-500">Active</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-600"><UserX size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{driverCount}</p>
            <p className="text-xs text-gray-500">Drivers</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><Shield size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{adminCount}</p>
            <p className="text-xs text-gray-500">Managers/Admins</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">All Users</h3>
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 w-48"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as UserRole | '')}
              className="input-field w-40 appearance-none"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Administrator</option>
              <option value="BRANCH_MANAGER">Branch Manager</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="DRIVER_COACH">Driver Coach</option>
              <option value="DRIVER">Driver</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'active' | 'inactive' | '')}
              className="input-field w-32 appearance-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title="No users found"
            description="Users will appear here once accounts are created"
            action={<button onClick={openAdd} className="btn-primary text-sm"><Plus size={14} /> Add First User</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">User</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Employee ID</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Phone</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Last Login</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-baldor-100 text-baldor-700 flex items-center justify-center text-sm font-medium">
                          {p.name?.[0]?.toUpperCase() ?? p.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.name ?? 'Unnamed'}</p>
                          <p className="text-xs text-gray-500">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className={`badge ${roleColors[p.role]}`}>{roleLabels[p.role]}</span></td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{p.employee_id ?? '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{p.phone ?? '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {p.last_login_at ? new Date(p.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-5 py-3.5">
                      {p.is_active
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-neutral">Inactive</span>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors"
                        title="Edit user"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit User' : 'Add New User'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Full Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="John Doe" required />
            <TextInput label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" placeholder="john@company.com" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Role" value={form.role} onChange={v => setForm(f => ({ ...f, role: v as UserRole }))} options={roleOptions} required />
            <TextInput label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} type="tel" placeholder="(555) 123-4567" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Employee ID" value={form.employee_id} onChange={v => setForm(f => ({ ...f, employee_id: v }))} placeholder="EMP-001" />
            <DateInput label="Hire Date" value={form.hire_date} onChange={v => setForm(f => ({ ...f, hire_date: v }))} />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <CheckboxInput
              label="Active Account"
              checked={form.is_active}
              onChange={v => setForm(f => ({ ...f, is_active: v }))}
              description="Inactive accounts cannot log in"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingUser ? 'Save Changes' : 'Add User'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
