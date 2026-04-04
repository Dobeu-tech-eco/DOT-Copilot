import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { TextInput, TextArea } from '../components/FormFields'
import { Building2, Save, CheckCircle } from 'lucide-react'

export function SettingsPage() {
  const { user } = useAuthStore()
  const { fleet, loading, fetchFleet, updateFleet } = useAppStore()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    cargo_type: '',
    operation_type: '',
    states_of_operation: '',
    locations: '',
    vehicle_types: '',
    key_risk_areas: '',
    cdl_status: '',
    default_language: 'en',
  })

  useEffect(() => {
    if (user?.fleet_id) {
      fetchFleet(user.fleet_id)
    }
  }, [user?.fleet_id, fetchFleet])

  useEffect(() => {
    if (fleet) {
      setForm({
        company_name: fleet.company_name,
        cargo_type: fleet.cargo_type ?? '',
        operation_type: fleet.operation_type ?? '',
        states_of_operation: fleet.states_of_operation ?? '',
        locations: fleet.locations ?? '',
        vehicle_types: fleet.vehicle_types ?? '',
        key_risk_areas: fleet.key_risk_areas ?? '',
        cdl_status: fleet.cdl_status ?? '',
        default_language: fleet.default_language,
      })
    }
  }, [fleet])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFleet({
      company_name: form.company_name,
      cargo_type: form.cargo_type || null,
      operation_type: form.operation_type || null,
      states_of_operation: form.states_of_operation || null,
      locations: form.locations || null,
      vehicle_types: form.vehicle_types || null,
      key_risk_areas: form.key_risk_areas || null,
      cdl_status: form.cdl_status || null,
      default_language: form.default_language,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading.fleet) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your fleet company profile and configuration</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="p-2 rounded-lg bg-baldor-50 text-baldor-600"><Building2 size={20} /></div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Company Information</h2>
              <p className="text-xs text-gray-500">Basic details about your fleet operation</p>
            </div>
          </div>

          <TextInput label="Company Name" value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="Baldor Food Company" required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Operation Type" value={form.operation_type} onChange={v => setForm(f => ({ ...f, operation_type: v }))} placeholder="Regional Distribution" />
            <TextInput label="Cargo Type" value={form.cargo_type} onChange={v => setForm(f => ({ ...f, cargo_type: v }))} placeholder="Perishable Foods (Refrigerated)" />
          </div>

          <TextInput label="States of Operation" value={form.states_of_operation} onChange={v => setForm(f => ({ ...f, states_of_operation: v }))} placeholder="NY, NJ, CT, MA, PA" />

          <TextArea label="Locations" value={form.locations} onChange={v => setForm(f => ({ ...f, locations: v }))} placeholder="Bronx, NY; Newark, NJ; Boston, MA" rows={2} />
        </div>

        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 pb-4 border-b border-gray-100">Fleet Configuration</h2>

          <TextInput label="CDL Requirements" value={form.cdl_status} onChange={v => setForm(f => ({ ...f, cdl_status: v }))} placeholder="Class A & B Required" />
          <TextInput label="Vehicle Types" value={form.vehicle_types} onChange={v => setForm(f => ({ ...f, vehicle_types: v }))} placeholder="Refrigerated Trucks, Delivery Vans, Box Trucks" />
          <TextArea label="Key Risk Areas" value={form.key_risk_areas} onChange={v => setForm(f => ({ ...f, key_risk_areas: v }))} placeholder="Temperature Control, Loading Dock Safety, Route Planning" rows={2} />
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 animate-fade-in">
              <CheckCircle size={16} /> Settings saved
            </span>
          )}
          <button type="submit" className="btn-primary">
            <Save size={16} /> Save Settings
          </button>
        </div>
      </form>
    </div>
  )
}
