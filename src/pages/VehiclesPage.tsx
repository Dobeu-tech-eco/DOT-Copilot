import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { TextInput, SelectInput, DateInput, CheckboxInput } from '../components/FormFields'
import { Truck, Search, Thermometer, CalendarCheck, MapPin, Plus, Pencil } from 'lucide-react'
import type { Vehicle, VehicleType } from '../types/database'

const vehicleTypeLabels: Record<string, string> = {
  refrigerated_truck: 'Refrigerated Truck',
  delivery_van: 'Delivery Van',
  dry_goods_truck: 'Dry Goods Truck',
  box_truck: 'Box Truck',
  other: 'Other',
}

const vehicleTypeOptions = [
  { value: 'refrigerated_truck', label: 'Refrigerated Truck' },
  { value: 'delivery_van', label: 'Delivery Van' },
  { value: 'dry_goods_truck', label: 'Dry Goods Truck' },
  { value: 'box_truck', label: 'Box Truck' },
  { value: 'other', label: 'Other' },
]

const emptyForm = {
  vehicle_number: '',
  vehicle_type: 'refrigerated_truck' as VehicleType,
  make: '',
  model: '',
  year: '',
  license_plate: '',
  has_temperature_monitoring: false,
  last_inspection_date: '',
  next_inspection_due: '',
  assigned_route: '',
  assigned_driver_id: '',
  is_active: true,
  notes: '',
}

export function VehiclesPage() {
  const { user } = useAuthStore()
  const { vehicles, profiles, loading, fetchVehicles, fetchProfiles, addVehicle, updateVehicle } = useAppStore()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (user?.fleet_id) {
      fetchVehicles(user.fleet_id)
      fetchProfiles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchVehicles, fetchProfiles])

  const driverOptions = profiles
    .filter(p => p.role === 'DRIVER' && p.is_active)
    .map(p => ({ value: p.id, label: p.name ?? p.email }))

  const openAdd = () => {
    setEditingVehicle(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (v: Vehicle) => {
    setEditingVehicle(v)
    setForm({
      vehicle_number: v.vehicle_number,
      vehicle_type: v.vehicle_type,
      make: v.make ?? '',
      model: v.model ?? '',
      year: v.year?.toString() ?? '',
      license_plate: v.license_plate ?? '',
      has_temperature_monitoring: v.has_temperature_monitoring,
      last_inspection_date: v.last_inspection_date ?? '',
      next_inspection_due: v.next_inspection_due ?? '',
      assigned_route: v.assigned_route ?? '',
      assigned_driver_id: v.assigned_driver_id ?? '',
      is_active: v.is_active,
      notes: v.notes ?? '',
    })
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      vehicle_number: form.vehicle_number,
      vehicle_type: form.vehicle_type,
      make: form.make || null,
      model: form.model || null,
      year: form.year ? parseInt(form.year) : null,
      license_plate: form.license_plate || null,
      has_temperature_monitoring: form.has_temperature_monitoring,
      last_inspection_date: form.last_inspection_date || null,
      next_inspection_due: form.next_inspection_due || null,
      assigned_route: form.assigned_route || null,
      assigned_driver_id: form.assigned_driver_id || null,
      is_active: form.is_active,
      notes: form.notes || null,
      fleet_id: user?.fleet_id ?? '',
    }
    if (editingVehicle) {
      updateVehicle(editingVehicle.id, data)
    } else {
      addVehicle(data)
    }
    setShowModal(false)
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Vehicles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage delivery vehicles, temperature monitoring, and inspections</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add Vehicle
        </button>
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
            action={<button onClick={openAdd} className="btn-primary text-sm"><Plus size={14} /> Add First Vehicle</button>}
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
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
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
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => openEdit(v)}
                        className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors"
                        title="Edit vehicle"
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
        title={editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Vehicle Number" value={form.vehicle_number} onChange={v => setForm(f => ({ ...f, vehicle_number: v }))} placeholder="BFC-R101" required />
            <SelectInput label="Vehicle Type" value={form.vehicle_type} onChange={v => setForm(f => ({ ...f, vehicle_type: v as VehicleType }))} options={vehicleTypeOptions} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextInput label="Make" value={form.make} onChange={v => setForm(f => ({ ...f, make: v }))} placeholder="Freightliner" />
            <TextInput label="Model" value={form.model} onChange={v => setForm(f => ({ ...f, model: v }))} placeholder="M2 106" />
            <TextInput label="Year" value={form.year} onChange={v => setForm(f => ({ ...f, year: v }))} type="number" placeholder="2024" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="License Plate" value={form.license_plate} onChange={v => setForm(f => ({ ...f, license_plate: v }))} placeholder="NY-TRK-1234" />
            <SelectInput label="Assigned Driver" value={form.assigned_driver_id} onChange={v => setForm(f => ({ ...f, assigned_driver_id: v }))} options={driverOptions} placeholder="Select driver..." />
          </div>
          <TextInput label="Assigned Route" value={form.assigned_route} onChange={v => setForm(f => ({ ...f, assigned_route: v }))} placeholder="Bronx → Manhattan → Brooklyn" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInput label="Last Inspection" value={form.last_inspection_date} onChange={v => setForm(f => ({ ...f, last_inspection_date: v }))} />
            <DateInput label="Next Inspection Due" value={form.next_inspection_due} onChange={v => setForm(f => ({ ...f, next_inspection_due: v }))} />
          </div>
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <CheckboxInput label="Temperature Monitoring" checked={form.has_temperature_monitoring} onChange={v => setForm(f => ({ ...f, has_temperature_monitoring: v }))} description="Vehicle has active temperature monitoring equipment" />
            <CheckboxInput label="Active Vehicle" checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} description="Inactive vehicles are not available for assignment" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingVehicle ? 'Save Changes' : 'Add Vehicle'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
