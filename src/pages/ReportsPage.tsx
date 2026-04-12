import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { AssignmentBadge } from '../components/StatusBadge'
import { ExportModal } from '../components/ExportModal'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, ShieldCheck, FileWarning, Users, GraduationCap, Download,
} from 'lucide-react'

const COMPLIANCE_COLORS: Record<string, string> = {
  Compliant: '#3a8b45',
  'In Progress': '#3b82f6',
  Expiring: '#f59e0b',
  Expired: '#ef4444',
  'Not Started': '#6b7280',
  Waived: '#9ca3af',
}

const DEFAULT_EXPORT_COLUMNS = [
  { key: 'name', label: 'Driver Name', enabled: true },
  { key: 'employee_id', label: 'Employee ID', enabled: true },
  { key: 'email', label: 'Email', enabled: true },
  { key: 'phone', label: 'Phone', enabled: true },
  { key: 'role', label: 'Role', enabled: false },
  { key: 'training_completed', label: 'Training Completed', enabled: true },
  { key: 'training_total', label: 'Total Assignments', enabled: true },
  { key: 'overdue_training', label: 'Overdue Training', enabled: true },
  { key: 'expired_docs', label: 'Expired Documents', enabled: true },
  { key: 'expiring_docs', label: 'Expiring Documents (30d)', enabled: true },
  { key: 'status', label: 'Compliance Status', enabled: true },
  { key: 'hire_date', label: 'Hire Date', enabled: false },
]

export function ReportsPage() {
  const { user } = useAuthStore()
  const {
    profiles, trainingPrograms, assignments, complianceRecords, documents,
    loading, fetchProfiles, fetchTrainingPrograms, fetchAssignments,
    fetchComplianceRecords, fetchDocuments,
  } = useAppStore()
  const [exportOpen, setExportOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'good' | 'warning' | 'critical'>('all')

  useEffect(() => {
    if (!user?.fleet_id) return
    fetchProfiles(user.fleet_id)
    fetchTrainingPrograms(user.fleet_id)
    fetchAssignments(user.fleet_id)
    fetchComplianceRecords(user.fleet_id)
    fetchDocuments(user.fleet_id)
  }, [user?.fleet_id, fetchProfiles, fetchTrainingPrograms, fetchAssignments, fetchComplianceRecords, fetchDocuments])

  if (loading.profiles || loading.trainingPrograms) return <LoadingSpinner />

  const now = new Date()
  const drivers = profiles.filter(p => p.role === 'DRIVER')

  const programStats = trainingPrograms
    .map(program => {
      const pa = assignments.filter(a => a.training_program_id === program.id)
      const completed = pa.filter(a => a.status === 'completed').length
      const total = pa.length
      return {
        name: program.program_name.length > 22 ? program.program_name.slice(0, 22) + '…' : program.program_name,
        completed,
        total,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      }
    })
    .filter(p => p.total > 0)
    .sort((a, b) => b.rate - a.rate)

  const complianceDist = [
    { name: 'Compliant', value: complianceRecords.filter(c => c.status === 'COMPLIANT').length },
    { name: 'In Progress', value: complianceRecords.filter(c => c.status === 'IN_PROGRESS').length },
    { name: 'Expiring', value: complianceRecords.filter(c => c.status === 'EXPIRING_SOON').length },
    { name: 'Expired', value: complianceRecords.filter(c => c.status === 'EXPIRED').length },
    { name: 'Not Started', value: complianceRecords.filter(c => c.status === 'NOT_STARTED').length },
    { name: 'Waived', value: complianceRecords.filter(c => c.status === 'WAIVED').length },
  ].filter(d => d.value > 0)

  const expiredDocs = documents.filter(d => new Date(d.expiration_date) < now)
  const expiring14 = documents.filter(d => {
    const days = Math.ceil((new Date(d.expiration_date).getTime() - now.getTime()) / 86400000)
    return days >= 0 && days <= 14
  })
  const expiring30 = documents.filter(d => {
    const days = Math.ceil((new Date(d.expiration_date).getTime() - now.getTime()) / 86400000)
    return days > 14 && days <= 30
  })
  const expiring60 = documents.filter(d => {
    const days = Math.ceil((new Date(d.expiration_date).getTime() - now.getTime()) / 86400000)
    return days > 30 && days <= 60
  })

  const driverRows = drivers.map(driver => {
    const da = assignments.filter(a => a.user_id === driver.id)
    const dc = complianceRecords.filter(c => c.user_id === driver.id)
    const dd = documents.filter(d => d.user_id === driver.id)
    const overdueTraining = da.filter(a => a.status === 'overdue').length
    const completedTraining = da.filter(a => a.status === 'completed').length
    const driverExpired = dd.filter(d => new Date(d.expiration_date) <= now).length
    const driverExpiring = dd.filter(d => {
      const days = Math.ceil((new Date(d.expiration_date).getTime() - now.getTime()) / 86400000)
      return days >= 0 && days <= 30
    }).length
    const compIssues = dc.filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON').length
    let status: 'good' | 'warning' | 'critical' = 'good'
    if (driverExpired > 0 || overdueTraining > 0 || compIssues > 0) status = 'warning'
    if (driverExpired >= 2 || overdueTraining >= 3) status = 'critical'
    return { driver, da, completedTraining, overdueTraining, driverExpired, driverExpiring, status }
  })

  const filteredDriverRows = driverRows.filter(r => statusFilter === 'all' || r.status === statusFilter)

  const toExportRow = (r: typeof driverRows[0]) => ({
    name: r.driver.name ?? 'Unnamed',
    employee_id: r.driver.employee_id ?? '',
    email: r.driver.email,
    phone: r.driver.phone ?? '',
    role: r.driver.role,
    training_completed: r.completedTraining,
    training_total: r.da.length,
    overdue_training: r.overdueTraining,
    expired_docs: r.driverExpired,
    expiring_docs: r.driverExpiring,
    status: r.status === 'good' ? 'Good' : r.status === 'warning' ? 'Needs Attention' : 'Critical',
    hire_date: r.driver.hire_date ? new Date(r.driver.hire_date).toLocaleDateString() : '',
  })

  const filteredExportRows = filteredDriverRows.map(toExportRow)
  const allExportRows = driverRows.map(toExportRow)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fleet Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Comprehensive analytics and compliance reporting</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Users size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{drivers.length}</p>
            <p className="text-xs text-gray-500">Total Drivers</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><GraduationCap size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{assignments.filter(a => a.status === 'completed').length}</p>
            <p className="text-xs text-gray-500">Trainings Completed</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><ShieldCheck size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {complianceRecords.filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON').length}
            </p>
            <p className="text-xs text-gray-500">Compliance Issues</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 text-red-600"><FileWarning size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{expiredDocs.length}</p>
            <p className="text-xs text-gray-500">Expired Documents</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-baldor-600" />
            Training Completion by Program
          </h3>
          {programStats.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">No training assignments yet</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={programStats} barSize={26}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Completion Rate']} />
                  <Bar dataKey="rate" fill="#3a8b45" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-baldor-600" />
            Compliance Distribution
          </h3>
          {complianceDist.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">No compliance records yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-52 w-52 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={complianceDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {complianceDist.map((entry, i) => (
                        <Cell key={i} fill={COMPLIANCE_COLORS[entry.name] ?? '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1">
                {complianceDist.map(entry => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COMPLIANCE_COLORS[entry.name] ?? '#6b7280' }} />
                      <span className="text-gray-600">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileWarning size={16} className="text-baldor-600" />
          Document Expiration Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-center">
            <p className="text-3xl font-bold text-red-700">{expiredDocs.length}</p>
            <p className="text-xs font-medium text-red-600 mt-1">Expired</p>
          </div>
          <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 text-center">
            <p className="text-3xl font-bold text-orange-700">{expiring14.length}</p>
            <p className="text-xs font-medium text-orange-600 mt-1">0 – 14 days</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-center">
            <p className="text-3xl font-bold text-amber-700">{expiring30.length}</p>
            <p className="text-xs font-medium text-amber-600 mt-1">15 – 30 days</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center">
            <p className="text-3xl font-bold text-blue-700">{expiring60.length}</p>
            <p className="text-xs font-medium text-blue-600 mt-1">31 – 60 days</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Driver Compliance Overview</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {filteredDriverRows.length} of {drivers.length} driver{drivers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="input-field w-40 text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="good">Good</option>
              <option value="warning">Needs Attention</option>
              <option value="critical">Critical</option>
            </select>
            <button
              onClick={() => setExportOpen(true)}
              className="btn-secondary"
              disabled={driverRows.length === 0}
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
        </div>
        {filteredDriverRows.length === 0 ? (
          <p className="text-sm text-gray-400 p-6 text-center">No drivers match the current filter</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Driver</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Training</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Overdue</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Expired Docs</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Expiring Docs</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDriverRows.map(({ driver, da, completedTraining, overdueTraining, driverExpired, driverExpiring, status }) => (
                  <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-baldor-100 text-baldor-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                          {driver.name?.[0]?.toUpperCase() ?? driver.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{driver.name ?? 'Unnamed'}</p>
                          <p className="text-xs text-gray-400">{driver.employee_id ?? driver.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{completedTraining} / {da.length}</td>
                    <td className="px-5 py-3.5">
                      {overdueTraining > 0
                        ? <span className="badge badge-danger">{overdueTraining}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {driverExpired > 0
                        ? <span className="badge badge-danger">{driverExpired} expired</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {driverExpiring > 0
                        ? <span className="badge badge-warning">{driverExpiring} expiring</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {status === 'good' && <span className="badge badge-success">Good</span>}
                      {status === 'warning' && <span className="badge badge-warning">Needs Attention</span>}
                      {status === 'critical' && <span className="badge badge-danger">Critical</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filteredRows={filteredExportRows}
        allRows={allExportRows}
        defaultColumns={DEFAULT_EXPORT_COLUMNS}
        filename={`driver-compliance-${new Date().toISOString().slice(0, 10)}.csv`}
      />

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent Training Assignments</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400 p-5 text-center">No assignments yet</p>
          ) : (
            assignments.slice(0, 8).map(a => (
              <div key={a.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {a.training_programs?.program_name ?? a.modules?.module_name ?? 'Training Assignment'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {a.profiles?.name ?? 'Unknown Driver'}
                    {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString()}`}
                  </p>
                </div>
                <AssignmentBadge status={a.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
