import { X, Mail, Phone, CreditCard, CalendarDays, Truck, BookOpen, ShieldCheck, FileText } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ComplianceBadge, AssignmentBadge } from './StatusBadge'
import type { Profile, Assignment, DriverCompliance, DriverDocument, Vehicle, UserRole } from '../types/database'

interface Props {
  driver: Profile | null
  assignments: Assignment[]
  complianceRecords: DriverCompliance[]
  documents: DriverDocument[]
  vehicles: Vehicle[]
  onClose: () => void
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  BRANCH_MANAGER: 'Branch Manager',
  SUPERVISOR: 'Supervisor',
  DRIVER_COACH: 'Driver Coach',
  DRIVER: 'Driver',
}

const documentTypeLabels: Record<string, string> = {
  CDL: 'CDL',
  MEDICAL_CARD: 'Medical Card',
  HAZMAT_ENDORSEMENT: 'HazMat Endorsement',
  TWIC_CARD: 'TWIC Card',
  PASSPORT: 'Passport',
  MVR: 'MVR',
  DRUG_TEST: 'Drug Test',
  BACKGROUND_CHECK: 'Background Check',
  STATE_PERMIT: 'State Permit',
  FOOD_HANDLER_CERT: 'Food Handler Cert',
  REFRIGERATED_TRANSPORT_QUAL: 'Refrigerated Transport',
  OTHER: 'Other',
}

function DocExpiryBadge({ expirationDate }: { expirationDate: string }) {
  const days = differenceInDays(new Date(expirationDate), new Date())
  if (days < 0) return <span className="badge badge-danger">Expired</span>
  if (days <= 14) return <span className="badge badge-danger">Exp {days}d</span>
  if (days <= 30) return <span className="badge badge-warning">Exp {days}d</span>
  return <span className="badge badge-success">Valid</span>
}

export function DriverProfileDrawer({ driver, assignments, complianceRecords, documents, vehicles, onClose }: Props) {
  if (!driver) return null

  const driverAssignments = assignments.filter(a => a.user_id === driver.id)
  const driverCompliance = complianceRecords.filter(c => c.user_id === driver.id)
  const driverDocuments = documents.filter(d => d.user_id === driver.id)
  const assignedVehicle = vehicles.find(v => v.assigned_driver_id === driver.id)

  const completedCount = driverAssignments.filter(a => a.status === 'completed').length
  const inProgressCount = driverAssignments.filter(a => a.status === 'in_progress').length
  const overdueCount = driverAssignments.filter(a => a.status === 'overdue').length

  const initials = driver.name
    ? driver.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : driver.email[0].toUpperCase()

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Driver Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-baldor-100 text-baldor-700 flex items-center justify-center text-xl font-semibold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-gray-900 truncate">{driver.name ?? 'Unnamed'}</p>
                <p className="text-sm text-gray-500 truncate">{driver.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="badge badge-info">{roleLabels[driver.role]}</span>
                  {driver.is_active
                    ? <span className="badge badge-success">Active</span>
                    : <span className="badge badge-neutral">Inactive</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Info</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <Mail size={15} className="text-gray-400 shrink-0" />
                <span className="text-gray-700 truncate">{driver.email}</span>
              </div>
              {driver.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={15} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">{driver.phone}</span>
                </div>
              )}
              {driver.employee_id && (
                <div className="flex items-center gap-3 text-sm">
                  <CreditCard size={15} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">ID: {driver.employee_id}</span>
                </div>
              )}
              {driver.hire_date && (
                <div className="flex items-center gap-3 text-sm">
                  <CalendarDays size={15} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">Hired {format(new Date(driver.hire_date), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Assigned Vehicle</h3>
            {assignedVehicle ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Truck size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{assignedVehicle.vehicle_number}</p>
                  <p className="text-xs text-gray-500">
                    {[assignedVehicle.make, assignedVehicle.model, assignedVehicle.year].filter(Boolean).join(' ') || assignedVehicle.vehicle_type}
                    {assignedVehicle.license_plate && ` · ${assignedVehicle.license_plate}`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No vehicle assigned</p>
            )}
          </div>

          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              <BookOpen size={13} className="inline mr-1.5" />Training ({driverAssignments.length})
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-700">{completedCount}</p>
                <p className="text-xs text-green-600">Completed</p>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-700">{inProgressCount}</p>
                <p className="text-xs text-blue-600">In Progress</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <p className="text-lg font-bold text-red-700">{overdueCount}</p>
                <p className="text-xs text-red-600">Overdue</p>
              </div>
            </div>
            {driverAssignments.length > 0 ? (
              <div className="space-y-1.5">
                {driverAssignments.slice(0, 6).map(a => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                    <p className="text-sm text-gray-700 truncate flex-1 mr-2">
                      {a.training_programs?.program_name ?? a.modules?.module_name ?? 'Training'}
                    </p>
                    <AssignmentBadge status={a.status} />
                  </div>
                ))}
                {driverAssignments.length > 6 && (
                  <p className="text-xs text-gray-400 text-center pt-1">+{driverAssignments.length - 6} more</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No training assigned</p>
            )}
          </div>

          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              <ShieldCheck size={13} className="inline mr-1.5" />Compliance ({driverCompliance.length})
            </h3>
            {driverCompliance.length > 0 ? (
              <div className="space-y-1.5">
                {driverCompliance.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                    <p className="text-sm text-gray-700 truncate flex-1 mr-2">
                      {c.compliance_requirements?.name ?? 'Requirement'}
                    </p>
                    <ComplianceBadge status={c.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No compliance records</p>
            )}
          </div>

          <div className="px-5 py-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              <FileText size={13} className="inline mr-1.5" />Documents ({driverDocuments.length})
            </h3>
            {driverDocuments.length > 0 ? (
              <div className="space-y-1.5">
                {driverDocuments.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm text-gray-700 truncate">{documentTypeLabels[d.document_type] ?? d.document_type}</p>
                      <p className="text-xs text-gray-400">Exp {format(new Date(d.expiration_date), 'MMM d, yyyy')}</p>
                    </div>
                    <DocExpiryBadge expirationDate={d.expiration_date} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No documents on file</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
