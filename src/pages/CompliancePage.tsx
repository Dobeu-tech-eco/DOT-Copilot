import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { ComplianceBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { ShieldCheck, Search, Filter, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import type { ComplianceStatus } from '../types/database'

export function CompliancePage() {
  const { user } = useAuthStore()
  const { complianceRecords, documents, loading, fetchComplianceRecords, fetchDocuments } = useAppStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | ''>('')
  const [tab, setTab] = useState<'compliance' | 'documents'>('compliance')

  useEffect(() => {
    if (user?.fleet_id) {
      fetchComplianceRecords(user.fleet_id)
      fetchDocuments(user.fleet_id)
    }
  }, [user?.fleet_id, fetchComplianceRecords, fetchDocuments])

  if (loading.compliance) return <LoadingSpinner />

  const filteredCompliance = complianceRecords.filter(c => {
    const matchesSearch = !search ||
      c.compliance_requirements?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.profiles?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredDocs = documents.filter(d => {
    const matchesSearch = !search ||
      d.document_type.toLowerCase().includes(search.toLowerCase()) ||
      d.profiles?.name?.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  const now = new Date()
  const expiredDocs = documents.filter(d => new Date(d.expiration_date) <= now)
  const expiringDocs = documents.filter(d => {
    const exp = new Date(d.expiration_date)
    return exp > now && exp <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  })
  const validDocs = documents.filter(d => new Date(d.expiration_date) > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance & Documents</h1>
          <p className="text-sm text-gray-500 mt-1">Track driver certifications, DOT compliance, and document expirations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><CheckCircle size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{validDocs.length}</p>
            <p className="text-xs text-gray-500">Valid Documents</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><AlertTriangle size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{expiringDocs.length}</p>
            <p className="text-xs text-gray-500">Expiring (30 days)</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 text-red-600"><FileText size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{expiredDocs.length}</p>
            <p className="text-xs text-gray-500">Expired</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab('compliance')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'compliance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Compliance Records
            </button>
            <button
              onClick={() => setTab('documents')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'documents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Driver Documents
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 w-48"
              />
            </div>
            {tab === 'compliance' && (
              <div className="relative">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as ComplianceStatus | '')}
                  className="input-field pl-9 w-40 appearance-none"
                >
                  <option value="">All Status</option>
                  <option value="COMPLIANT">Compliant</option>
                  <option value="EXPIRING_SOON">Expiring Soon</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="NOT_STARTED">Not Started</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {tab === 'compliance' ? (
          <div className="overflow-x-auto">
            {filteredCompliance.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={28} />}
                title="No compliance records"
                description="Compliance records will appear here once drivers are assigned requirements"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Requirement</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Expiration</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCompliance.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{c.profiles?.name ?? 'Unknown'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{c.compliance_requirements?.name ?? '-'}</td>
                      <td className="px-5 py-3.5"><ComplianceBadge status={c.status} /></td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{c.expiration_date ? new Date(c.expiration_date).toLocaleDateString() : '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{c.verified_by ?? 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredDocs.length === 0 ? (
              <EmptyState
                icon={<FileText size={28} />}
                title="No documents"
                description="Driver documents will appear here once uploaded"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Document Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Number</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Expiration</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDocs.map(d => {
                    const daysLeft = Math.ceil((new Date(d.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    const docStatus: 'COMPLIANT' | 'EXPIRING_SOON' | 'EXPIRED' = daysLeft <= 0 ? 'EXPIRED' : daysLeft <= 30 ? 'EXPIRING_SOON' : 'COMPLIANT'
                    return (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{d.profiles?.name ?? 'Unknown'}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{d.document_type.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{d.document_number ?? '-'}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{new Date(d.expiration_date).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5"><ComplianceBadge status={docStatus} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
