import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { EmptyState } from '../../components/EmptyState'
import { Building2, Plus, Users } from 'lucide-react'
import type { Fleet } from '../../types/database'

interface FleetWithCount extends Fleet {
  profile_count: number
}

export function AdminFleetsPage() {
  const navigate = useNavigate()
  const [fleets, setFleets] = useState<FleetWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: fleetRows, error: fleetError } = await supabase
        .from('fleets')
        .select('*')
        .order('created_at', { ascending: false }) as { data: Fleet[] | null; error: { message: string } | null }

      if (fleetError) {
        if (!cancelled) {
          setError(fleetError.message)
          setLoading(false)
        }
        return
      }

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('fleet_id') as { data: { fleet_id: string | null }[] | null; error: { message: string } | null }

      if (profileError) {
        if (!cancelled) {
          setError(profileError.message)
          setLoading(false)
        }
        return
      }

      const counts = new Map<string, number>()
      for (const p of profileRows ?? []) {
        if (!p.fleet_id) continue
        counts.set(p.fleet_id, (counts.get(p.fleet_id) ?? 0) + 1)
      }

      if (!cancelled) {
        setFleets(
          (fleetRows ?? []).map(f => ({ ...f, profile_count: counts.get(f.id) ?? 0 }))
        )
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-amber-600 mb-1">
            DOT-Copilot Platform Admin &middot; Dobeu Tech Solutions
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Fleets</h1>
          <p className="text-sm text-gray-500 mt-1">All customer fleets provisioned on DOT-Copilot</p>
        </div>
        <button onClick={() => navigate('/admin/fleets/new')} className="btn-primary">
          <Plus size={16} /> New Fleet
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="card">
        {fleets.length === 0 ? (
          <EmptyState
            icon={<Building2 size={28} />}
            title="No fleets yet"
            description="Create the first customer fleet to get started"
            action={
              <button onClick={() => navigate('/admin/fleets/new')} className="btn-primary">
                <Plus size={16} /> New Fleet
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Fleet</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Users</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fleets.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                          <Building2 size={16} />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{f.company_name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Users size={14} className="text-gray-400" />
                        {f.profile_count}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
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
