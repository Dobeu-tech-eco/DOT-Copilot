import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, UserPlus } from 'lucide-react'

interface FleetStepData {
  name: string
  dot_number: string
  address: string
  phone: string
}

interface AdminStepData {
  email: string
  full_name: string
}

type WizardStep = 'fleet' | 'admin' | 'success'

export function NewFleetWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>('fleet')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null)

  const [fleetData, setFleetData] = useState<FleetStepData>({
    name: '',
    dot_number: '',
    address: '',
    phone: '',
  })
  const [adminData, setAdminData] = useState<AdminStepData>({
    email: '',
    full_name: '',
  })

  const fleetValid = fleetData.name.trim().length > 0
  const adminValid = adminData.email.trim().length > 0 && adminData.full_name.trim().length > 0

  const handleNext = () => {
    if (!fleetValid) return
    setError(null)
    setStep('admin')
  }

  const handleBack = () => {
    setError(null)
    setStep('fleet')
  }

  const handleSubmit = async () => {
    if (!adminValid) return
    setSubmitting(true)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('provision-fleet', {
        body: {
          fleet: {
            name: fleetData.name.trim(),
            dot_number: fleetData.dot_number.trim() || undefined,
            address: fleetData.address.trim() || undefined,
            phone: fleetData.phone.trim() || undefined,
          },
          admin: {
            email: adminData.email.trim(),
            full_name: adminData.full_name.trim(),
          },
          redirect_origin: window.location.origin,
        },
      })

      if (invokeError) {
        let message = invokeError.message ?? 'Failed to provision fleet'
        const context = (invokeError as { context?: { json?: () => Promise<{ error?: string }> } }).context
        if (context?.json) {
          try {
            const body = await context.json()
            if (body?.error) message = body.error
          } catch {
            // fall back to invokeError.message
          }
        }
        setError(message)
        setSubmitting(false)
        return
      }

      if (data?.error) {
        setError(data.error)
        setSubmitting(false)
        return
      }

      setInvitedEmail(adminData.email.trim())
      setStep('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to provision fleet')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
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
        <h1 className="text-2xl font-bold text-gray-900">New Fleet</h1>
        <p className="text-sm text-gray-500 mt-1">Provision a new customer fleet and invite its first administrator</p>
      </div>

      {step !== 'success' && (
        <div className="flex items-center gap-3 text-sm">
          <div className={`flex items-center gap-2 ${step === 'fleet' ? 'text-brand-700 font-medium' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'fleet' ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
            Fleet Info
          </div>
          <div className="flex-1 h-px bg-gray-200" />
          <div className={`flex items-center gap-2 ${step === 'admin' ? 'text-brand-700 font-medium' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'admin' ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
            Initial Admin
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {step === 'fleet' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-900">
            <Building2 size={18} />
            <h3 className="text-sm font-semibold">Fleet Details</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fleet Name<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={fleetData.name}
              onChange={e => setFleetData(d => ({ ...d, name: e.target.value }))}
              placeholder="Acme Logistics"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number</label>
            <input
              type="text"
              value={fleetData.dot_number}
              onChange={e => setFleetData(d => ({ ...d, dot_number: e.target.value }))}
              placeholder="1234567"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={fleetData.address}
              onChange={e => setFleetData(d => ({ ...d, address: e.target.value }))}
              placeholder="123 Main St, Springfield, IL"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={fleetData.phone}
              onChange={e => setFleetData(d => ({ ...d, phone: e.target.value }))}
              placeholder="(555) 123-4567"
              className="input-field"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleNext} disabled={!fleetValid} className="btn-primary">
              Next <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 'admin' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-900">
            <UserPlus size={18} />
            <h3 className="text-sm font-semibold">Initial Admin User</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="email"
              value={adminData.email}
              onChange={e => setAdminData(d => ({ ...d, email: e.target.value }))}
              placeholder="admin@acmelogistics.com"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={adminData.full_name}
              onChange={e => setAdminData(d => ({ ...d, full_name: e.target.value }))}
              placeholder="Jane Smith"
              className="input-field"
            />
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={handleBack} className="btn-secondary" disabled={submitting}>
              <ArrowLeft size={16} /> Back
            </button>
            <button onClick={handleSubmit} disabled={!adminValid || submitting} className="btn-primary">
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Create Fleet & Send Invite'
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="card p-8 text-center space-y-4">
          <div className="inline-flex p-4 rounded-full bg-green-50 text-green-600">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Fleet created</h3>
            <p className="text-sm text-gray-500 mt-1">Invite sent to {invitedEmail}</p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={() => navigate('/fleets')} className="btn-primary">
              Back to Fleets
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
