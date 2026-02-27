import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Truck, Search, Thermometer, CalendarCheck, MapPin } from 'lucide-react'

const vehicleTypeLabels: Record<string, string> = {
  refrigerated_truck: 'Refrigerated Truck',
  delivery_van: 'Delivery Van',
  dry_goods_truck: 'Dry Goods Truck',
  box_truck: 'Box Truck',
  other: 'Other',
}

export function VehiclesPage() {
  const { user } = useAuthStore()
  const { vehicles, loading, fetchVehicles } = useAppStore()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    if (user?.fleet_id) {
      fetchVehicles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchVehicles])

  if (loading.vehicles) return <LoadingSpinner />

  const filtered = vehicles.filter(v => {
    const matchesSearch = !search ||
      v.vehicle_number.toLowerCase().includes(search.toLowerCase()) ||
      v.license_plate?.toLowerCase().includes(search.toLowerCase()) ||
      v.profiles?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesType = !typeFilter || v.vehicle_type === typeFilter
    return matchesSearch && matchesType
  })

  const activeVehicles = vehicles.filter(v => v.is_active)
  const withTempMonitoring = vehicles.filter(v => v.has_temperature_monitoring)
  const refrigerated = vehicles.filter(v => v.vehicle_type === 'refrigerated_truck')

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fleet Vehicles</h1>
        <p className="text-sm text-gray-500 mt-1">Manage delivery vehicles, temperature monitoring, and inspections</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Truck size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeVehicles.length}</p>
            <p className="text-xs text-gray-500">Active Vehicles</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600"><Thermometer size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{refrigerated.length}</p>
            <p className="text-xs text-gray-500">Refrigerated</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><CalendarCheck size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{withTempMonitoring.length}</p>
            <p className="text-xs text-gray-500">Temp Monitored</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-600"><MapPin size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{vehicles.filter(v => v.assigned_route).length}</p>
            <p className="text-xs text-gray-500">Route Assigned</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">All Vehicles</h3>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search vehicles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 w-48"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="input-field w-44 appearance-none"
            >
              <option value="">All Types</option>
              <option value="refrigerated_truck">Refrigerated Truck</option>
              <option value="delivery_van">Delivery Van</option>
              <option value="dry_goods_truck">Dry Goods Truck</option>
              <option value="box_truck">Box Truck</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Truck size={28} />}
            title="No vehicles found"
            description="Fleet vehicles will appear here once added"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Vehicle</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Assigned Driver</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Route</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Temp Monitor</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Next Inspection</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{v.vehicle_number}</p>
                        <p className="text-xs text-gray-500">{v.license_plate ?? ''} {v.year ? `- ${v.year}` : ''} {v.make ?? ''} {v.model ?? ''}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{vehicleTypeLabels[v.vehicle_type] ?? v.vehicle_type}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{v.profiles?.name ?? 'Unassigned'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{v.assigned_route ?? '-'}</td>
                    <td className="px-5 py-3.5">
                      {v.has_temperature_monitoring
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-neutral">None</span>
                      }
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {v.next_inspection_due ? new Date(v.next_inspection_due).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      {v.is_active
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-neutral">Inactive</span>
                      }
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
