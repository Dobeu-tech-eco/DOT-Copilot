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
import { FormInput, FormSelect, FormTextarea, FormSection } from '../components/FormField'
import { vehicleSchema, VEHICLE_TYPES } from '../schemas/vehicle.schema'
import type { VehicleFormData } from '../schemas/vehicle.schema'
import { Truck, Search, Plus, Pencil, Trash2, Thermometer, CalendarCheck } from 'lucide-react'
import type { Vehicle } from '../types/database'

const vehicleTypeLabels: Record<string, string> = {
  refrigerated_truck: 'Refrigerated Truck',
  delivery_van: 'Delivery Van',
  dry_goods_truck: 'Dry Goods Truck',
  box_truck: 'Box Truck',
  other: 'Other',
}

const typeOptions = VEHICLE_TYPES.map(t => ({ value: t, label: vehicleTypeLabels[t] }))

export function VehiclesPage() {
  const { user } = useAuthStore()
  const { vehicles, profiles, loading, fetchVehicles, fetchProfiles, createVehicle, updateVehicle, deleteVehicle } = useAppStore()
  const { canManageVehicles } = usePermissions()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema) as never,
    defaultValues: { has_temperature_monitoring: false },
  })

  useEffect(() => {
    if (user?.fleet_id) {
      fetchVehicles(user.fleet_id)
      fetchProfiles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchVehicles, fetchProfiles])

  const openCreate = () => {
    setEditing(null)
    form.reset({ has_temperature_monitoring: false, vehicle_type: 'refrigerated_truck' })
    setModalOpen(true)
  }

  const openEdit = (v: Vehicle) => {
    setEditing(v)
    form.reset({
      vehicle_number: v.vehicle_number,
      vehicle_type: v.vehicle_type,
      make: v.make ?? '',
      model: v.model ?? '',
      year: v.year ?? undefined,
      license_plate: v.license_plate ?? '',
      has_temperature_monitoring: v.has_temperature_monitoring,
      assigned_route: v.assigned_route ?? '',
      assigned_driver_id: v.assigned_driver_id ?? '',
      notes: v.notes ?? '',
      last_inspection_date: v.last_inspection_date ?? '',
      next_inspection_due: v.next_inspection_due ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = form.handleSubmit(async (data: VehicleFormData) => {
    if (!user?.fleet_id) return
    setSubmitting(true)
    try {
      if (editing) {
        await updateVehicle(editing.id, data)
        toast.success('Vehicle updated')
      } else {
        await createVehicle(user.fleet_id, data)
        toast.success('Vehicle created')
      }
      setModalOpen(false)
    } catch { toast.error('Failed to save vehicle') }
    finally { setSubmitting(false) }
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      await deleteVehicle(deleteTarget.id)
      toast.success('Vehicle deleted')
      setDeleteTarget(null)
    } catch { toast.error('Failed to delete vehicle') }
    finally { setSubmitting(false) }
  }

  if (loading.vehicles) return <LoadingSpinner />

  const filtered = vehicles.filter(v => {
    const matchSearch = !search || v.vehicle_number.toLowerCase().includes(search.toLowerCase()) || v.license_plate?.toLowerCase().includes(search.toLowerCase()) || v.profiles?.name?.toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || v.vehicle_type === typeFilter
    return matchSearch && matchType
  })

  const activeVehicles = vehicles.filter(v => v.is_active)
  const withTempMonitoring = vehicles.filter(v => v.has_temperature_monitoring)
  const refrigerated = vehicles.filter(v => v.vehicle_type === 'refrigerated_truck')

  const driverOptions = profiles.filter(p => p.role === 'DRIVER' && p.is_active).map(p => ({ value: p.id, label: p.name ?? p.email }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Vehicles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage delivery vehicles, temperature monitoring, and inspections</p>
        </div>
        {canManageVehicles && (
          <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Vehicle</button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Truck size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{activeVehicles.length}</p><p className="text-xs text-gray-500">Active Vehicles</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><Thermometer size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{withTempMonitoring.length}</p><p className="text-xs text-gray-500">Temp Monitored</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600"><Truck size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{refrigerated.length}</p><p className="text-xs text-gray-500">Refrigerated</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><CalendarCheck size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{vehicles.length}</p><p className="text-xs text-gray-500">Total Fleet</p></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search vehicles..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field sm:w-48">
          <option value="">All Types</option>
          {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Truck size={48} />} title="No vehicles found" description="Add a vehicle to get started" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Make/Model</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Plate</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Driver</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Temp</th>
                  {canManageVehicles && <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.vehicle_number}</td>
                    <td className="px-4 py-3"><span className="badge badge-info">{vehicleTypeLabels[v.vehicle_type]}</span></td>
                    <td className="px-4 py-3 text-gray-600">{[v.make, v.model, v.year].filter(Boolean).join(' ') || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{v.license_plate ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{v.profiles?.name ?? '-'}</td>
                    <td className="px-4 py-3">{v.has_temperature_monitoring ? <span className="badge badge-success">Yes</span> : <span className="badge badge-neutral">No</span>}</td>
                    {canManageVehicles && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(v)} className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteTarget(v)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Vehicle' : 'Add Vehicle'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection title="Vehicle Info">
            <FormInput label="Vehicle Number" required registration={form.register('vehicle_number')} error={form.formState.errors.vehicle_number?.message} />
            <FormSelect label="Vehicle Type" required options={typeOptions} registration={form.register('vehicle_type')} error={form.formState.errors.vehicle_type?.message} />
            <FormInput label="Make" registration={form.register('make')} />
            <FormInput label="Model" registration={form.register('model')} />
            <FormInput label="Year" type="number" registration={form.register('year', { valueAsNumber: true })} error={form.formState.errors.year?.message} />
            <FormInput label="License Plate" registration={form.register('license_plate')} />
          </FormSection>
          <FormSection title="Assignment & Monitoring">
            <FormSelect label="Assigned Driver" options={driverOptions} registration={form.register('assigned_driver_id')} placeholder="Unassigned" />
            <FormInput label="Route" registration={form.register('assigned_route')} />
            <FormInput label="Last Inspection" type="date" registration={form.register('last_inspection_date')} />
            <FormInput label="Next Inspection Due" type="date" registration={form.register('next_inspection_due')} />
          </FormSection>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="temp_mon" className="rounded border-gray-300 text-baldor-600 focus:ring-baldor-500" {...form.register('has_temperature_monitoring')} />
            <label htmlFor="temp_mon" className="text-sm text-gray-700">Has Temperature Monitoring</label>
          </div>
          <FormTextarea label="Notes" registration={form.register('notes')} />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editing ? 'Save Changes' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Vehicle"
        message={`Are you sure you want to delete vehicle ${deleteTarget?.vehicle_number}? This action cannot be undone.`}
        loading={submitting}
      />
    </div>
  )
}
