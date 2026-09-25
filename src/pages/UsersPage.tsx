import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../store/toastStore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormInput, FormSelect, FormSection } from '../components/FormField'
import { DriverProfileDrawer } from '../components/DriverProfileDrawer'
import { profileSchema, createUserSchema, USER_ROLES } from '../schemas/profile.schema'
import type { ProfileFormData, CreateUserFormData } from '../schemas/profile.schema'
import { Users, Search, UserCheck, UserX, Shield, UserPlus, Pencil, Power, Eye } from 'lucide-react'
import type { Profile, UserRole } from '../types/database'

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

const roleOptions = USER_ROLES.map(r => ({ value: r, label: roleLabels[r] }))

export function UsersPage() {
  const { user } = useAuthStore()
  const { profiles, assignments, complianceRecords, documents, vehicles, loading, fetchProfiles, fetchAssignments, fetchComplianceRecords, fetchDocuments, fetchVehicles, updateProfile, toggleUserActive, createUser } = useAppStore()
  const { canManageUsers } = usePermissions()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('')
  const [editModal, setEditModal] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null)
  const [viewingDriver, setViewingDriver] = useState<Profile | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const editForm = useForm<ProfileFormData>({ resolver: zodResolver(profileSchema) as never })
  const createForm = useForm<CreateUserFormData>({ resolver: zodResolver(createUserSchema) as never })

  useEffect(() => {
    if (user?.fleet_id) {
      fetchProfiles(user.fleet_id)
      fetchAssignments(user.fleet_id)
      fetchComplianceRecords(user.fleet_id)
      fetchDocuments(user.fleet_id)
      fetchVehicles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchProfiles, fetchAssignments, fetchComplianceRecords, fetchDocuments, fetchVehicles])

  const openEdit = (p: Profile) => {
    setEditing(p)
    editForm.reset({
      name: p.name ?? '',
      role: p.role,
      phone: p.phone ?? '',
      employee_id: p.employee_id ?? '',
      hire_date: p.hire_date ?? '',
    })
    setEditModal(true)
  }

  const handleEdit = editForm.handleSubmit(async (data: ProfileFormData) => {
    if (!editing) return
    setSubmitting(true)
    try {
      await updateProfile(editing.id, data)
      toast.success('User updated')
      setEditModal(false)
    } catch { toast.error('Failed to update user') }
    finally { setSubmitting(false) }
  })

  const handleCreate = createForm.handleSubmit(async (data: CreateUserFormData) => {
    if (!user?.fleet_id) return
    setSubmitting(true)
    try {
      await createUser(user.fleet_id, data)
      await fetchProfiles(user.fleet_id)
      toast.success('User created')
      setCreateModal(false)
      createForm.reset()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create user') }
    finally { setSubmitting(false) }
  })

  const handleToggle = async () => {
    if (!toggleTarget) return
    setSubmitting(true)
    try {
      await toggleUserActive(toggleTarget.id, !toggleTarget.is_active)
      toast.success(toggleTarget.is_active ? 'User deactivated' : 'User activated')
      setToggleTarget(null)
    } catch { toast.error('Failed to update status') }
    finally { setSubmitting(false) }
  }

  if (loading.profiles) return <LoadingSpinner />

  const filtered = profiles.filter(p => {
    const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase()) || p.employee_id?.toLowerCase().includes(search.toLowerCase())
    const matchesRole = !roleFilter || p.role === roleFilter
    const matchesStatus = !statusFilter || (statusFilter === 'active' && p.is_active) || (statusFilter === 'inactive' && !p.is_active)
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
        {canManageUsers && (
          <button onClick={() => { createForm.reset(); setCreateModal(true) }} className="btn-primary">
            <UserPlus size={16} /> Add User
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Users size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{profiles.length}</p><p className="text-xs text-gray-500">Total Users</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><UserCheck size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{activeCount}</p><p className="text-xs text-gray-500">Active</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-600"><UserX size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{driverCount}</p><p className="text-xs text-gray-500">Drivers</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><Shield size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{adminCount}</p><p className="text-xs text-gray-500">Managers/Admins</p></div>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">All Users</h3>
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 w-48" />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as UserRole | '')} className="input-field w-40">
              <option value="">All Roles</option>
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'active' | 'inactive' | '')} className="input-field w-32">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Users size={28} />} title="No users found" description="Users will appear here once accounts are created" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">User</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Employee ID</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Last Login</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-medium">
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
                    <td className="px-5 py-3.5 text-sm text-gray-600">{p.last_login_at ? new Date(p.last_login_at).toLocaleDateString() : 'Never'}</td>
                    <td className="px-5 py-3.5">{p.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewingDriver(p)} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="View profile">
                          <Eye size={14} />
                        </button>
                        {canManageUsers && (
                          <>
                            <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setToggleTarget(p)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title={p.is_active ? 'Deactivate' : 'Activate'}>
                              <Power size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit User">
        <form onSubmit={handleEdit} className="space-y-5">
          <FormSection title="User Details">
            <FormInput label="Name" required registration={editForm.register('name')} error={editForm.formState.errors.name?.message} />
            <FormSelect label="Role" required options={roleOptions} registration={editForm.register('role')} error={editForm.formState.errors.role?.message} />
            <FormInput label="Phone" registration={editForm.register('phone')} />
            <FormInput label="Employee ID" registration={editForm.register('employee_id')} />
            <FormInput label="Hire Date" type="date" registration={editForm.register('hire_date')} />
          </FormSection>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setEditModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

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
        onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${toggleTarget?.is_active ? 'deactivate' : 'activate'} ${toggleTarget?.name ?? 'this user'}?`}
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
        loading={submitting}
      />

      <DriverProfileDrawer
        driver={viewingDriver}
        assignments={assignments}
        complianceRecords={complianceRecords}
        documents={documents}
        vehicles={vehicles}
        onClose={() => setViewingDriver(null)}
      />
    </div>
  )
}
