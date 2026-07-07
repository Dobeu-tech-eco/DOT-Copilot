import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { ArrowLeft, Building2, Users, Wrench } from 'lucide-react'
import type { Fleet, Profile, UserRole } from '../types/database'

type FleetUser = Pick<Profile, 'id' | 'email' | 'name' | 'role' | 'created_at'>

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  BRANCH_MANAGER: 'Branch Manager',
  SUPERVISOR: 'Supervisor',
  DRIVER_COACH: 'Driver Coach',
  DRIVER: 'Driver',
}

export function AdminFleetDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [fleet, setFleet] = useState<Fleet | null>(null)
  const [users, setUsers] = useState<FleetUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fleetId = id
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: fleetRow, error: fleetError } = await supabase
        .from('fleets')
        .select('*')
        .eq('id', fleetId)
        .maybeSingle() as { data: Fleet | null; error: { message: string } | null }

      if (fleetError) {
        if (!cancelled) {
          setError(fleetError.message)
          setLoading(false)
        }
        return
      }

      const { data: userRows, error: userError } = await supabase
        .from('profiles')
        .select('id, email, name, role, created_at')
        .eq('fleet_id', fleetId)
        .order('created_at', { ascending: false }) as { data: FleetUser[] | null; error: { message: string } | null }

      if (userError) {
        if (!cancelled) {
          setError(userError.message)
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setFleet(fleetRow)
        setUsers(userRows ?? [])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <LoadingSpinner />

  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        {error}
      </div>
    )
  }

  if (!fleet) {
    return (
      <EmptyState
        icon={<Building2 size={28} />}
        title="Fleet not found"
        description="This fleet does not exist or you no longer have access to it."
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <button
          onClick={() => navigate('/fleets')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={14} /> Back to Fleets
        </button>
        <p className="text-xs font-medium uppercase tracking-wider text-amber-600 mb-1">
          DOT-Copilot Platform Administration &middot; Dobeu Tech Solutions
        </p>
        <h1 className="text-2xl font-bold text-gray-900">{fleet.company_name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Building2 size={14} /> Fleet Info
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Cargo Type</dt>
              <dd className="text-gray-900 text-right">{fleet.cargo_type || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Operation Type</dt>
              <dd className="text-gray-900 text-right">{fleet.operation_type || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">States</dt>
              <dd className="text-gray-900 text-right">{fleet.states_of_operation || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Users size={14} /> Users
          </div>
          <p className="text-3xl font-bold text-gray-900">{users.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total profiles in this fleet</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Wrench size={14} /> Troubleshooting
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Fleet ID</dt>
              <dd className="text-gray-900 text-right font-mono text-xs break-all">{fleet.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-900 text-right">{new Date(fleet.created_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Onboarding</dt>
              <dd className={`text-right font-medium ${fleet.onboarding_completed ? 'text-green-600' : 'text-amber-600'}`}>
                {fleet.onboarding_completed ? 'Completed' : 'Incomplete'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Compliance Profile</dt>
              <dd className={`text-right font-medium ${fleet.compliance_profile_configured ? 'text-green-600' : 'text-amber-600'}`}>
                {fleet.compliance_profile_configured ? 'Configured' : 'Not configured'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Fleet Users</h3>
        </div>
        {users.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title="No users yet"
            description="No profiles have been created for this fleet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{u.name || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{u.email}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{roleLabels[u.role]}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
