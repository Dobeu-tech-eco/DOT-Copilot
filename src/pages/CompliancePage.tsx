import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { ComplianceBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { TextInput, SelectInput, DateInput, TextArea } from '../components/FormFields'
import { ShieldCheck, Search, Filter, FileText, AlertTriangle, CheckCircle, Plus, Pencil } from 'lucide-react'
import type { ComplianceStatus, DocumentType, DriverCompliance, DriverDocument } from '../types/database'

const docTypeOptions = [
  { value: 'CDL', label: 'CDL' },
  { value: 'MEDICAL_CARD', label: 'Medical Card' },
  { value: 'HAZMAT_ENDORSEMENT', label: 'HazMat Endorsement' },
  { value: 'TWIC_CARD', label: 'TWIC Card' },
  { value: 'MVR', label: 'Motor Vehicle Record' },
  { value: 'DRUG_TEST', label: 'Drug Test' },
  { value: 'BACKGROUND_CHECK', label: 'Background Check' },
  { value: 'FOOD_HANDLER_CERT', label: 'Food Handler Cert' },
  { value: 'OTHER', label: 'Other' },
]

const statusOptions = [
  { value: 'COMPLIANT', label: 'Compliant' },
  { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'NOT_STARTED', label: 'Not Started' },
]

export function CompliancePage() {
  const { user } = useAuthStore()
  const {
    complianceRecords, documents, complianceRequirements, profiles, loading,
    fetchComplianceRecords, fetchDocuments, fetchComplianceRequirements, fetchProfiles,
    addComplianceRecord, updateComplianceRecord, addDocument, updateDocument,
  } = useAppStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | ''>('')
  const [tab, setTab] = useState<'compliance' | 'documents'>('compliance')
  const [showCompModal, setShowCompModal] = useState(false)
  const [showDocModal, setShowDocModal] = useState(false)
  const [editingComp, setEditingComp] = useState<DriverCompliance | null>(null)
  const [editingDoc, setEditingDoc] = useState<DriverDocument | null>(null)

  const [compForm, setCompForm] = useState({
    user_id: '', requirement_id: '', status: 'COMPLIANT' as ComplianceStatus,
    completed_date: '', expiration_date: '', hours_completed: '',
    notes: '', verified_by: '', verified_at: '',
    certificate_url: null as string | null,
  })

  const [docForm, setDocForm] = useState({
    user_id: '', document_type: 'CDL' as DocumentType, document_number: '',
    issued_date: '', expiration_date: '', issuing_state: '',
    cdl_class: '', status: 'valid',
  })

  useEffect(() => {
    if (user?.fleet_id) {
      fetchComplianceRecords(user.fleet_id)
      fetchDocuments(user.fleet_id)
      fetchComplianceRequirements(user.fleet_id)
      fetchProfiles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchComplianceRecords, fetchDocuments, fetchComplianceRequirements, fetchProfiles])

  const driverOptions = profiles
    .filter(p => p.role === 'DRIVER' && p.is_active)
    .map(p => ({ value: p.id, label: p.name ?? p.email }))

  const reqOptions = complianceRequirements.map(r => ({ value: r.id, label: r.name }))

  const openAddComp = () => {
    setEditingComp(null)
    setCompForm({ user_id: '', requirement_id: '', status: 'NOT_STARTED', completed_date: '', expiration_date: '', hours_completed: '', notes: '', verified_by: '', verified_at: '', certificate_url: null })
    setShowCompModal(true)
  }

  const openEditComp = (c: DriverCompliance) => {
    setEditingComp(c)
    setCompForm({
      user_id: c.user_id, requirement_id: c.requirement_id, status: c.status,
      completed_date: c.completed_date ?? '', expiration_date: c.expiration_date ?? '',
      hours_completed: c.hours_completed?.toString() ?? '', notes: c.notes ?? '',
      verified_by: c.verified_by ?? '', verified_at: c.verified_at ?? '',
      certificate_url: c.certificate_url,
    })
    setShowCompModal(true)
  }

  const handleCompSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      user_id: compForm.user_id,
      requirement_id: compForm.requirement_id,
      status: compForm.status,
      completed_date: compForm.completed_date || null,
      expiration_date: compForm.expiration_date || null,
      hours_completed: compForm.hours_completed ? parseFloat(compForm.hours_completed) : null,
      notes: compForm.notes || null,
      verified_by: compForm.verified_by || null,
      verified_at: compForm.verified_at || null,
      certificate_url: compForm.certificate_url,
    }
    if (editingComp) {
      updateComplianceRecord(editingComp.id, data)
    } else {
      addComplianceRecord(data)
    }
    setShowCompModal(false)
  }

  const openAddDoc = () => {
    setEditingDoc(null)
    setDocForm({ user_id: '', document_type: 'CDL', document_number: '', issued_date: '', expiration_date: '', issuing_state: '', cdl_class: '', status: 'valid' })
    setShowDocModal(true)
  }

  const openEditDoc = (d: DriverDocument) => {
    setEditingDoc(d)
    setDocForm({
      user_id: d.user_id, document_type: d.document_type, document_number: d.document_number ?? '',
      issued_date: d.issued_date ?? '', expiration_date: d.expiration_date,
      issuing_state: d.issuing_state ?? '', cdl_class: d.cdl_class ?? '', status: d.status,
    })
    setShowDocModal(true)
  }

  const handleDocSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      user_id: docForm.user_id,
      fleet_id: user?.fleet_id ?? '',
      document_type: docForm.document_type,
      document_number: docForm.document_number || null,
      issued_date: docForm.issued_date || null,
      expiration_date: docForm.expiration_date,
      issuing_state: docForm.issuing_state || null,
      cdl_class: docForm.cdl_class || null,
      endorsements: [] as string[],
      restrictions: [] as string[],
      status: docForm.status,
    }
    if (editingDoc) {
      updateDocument(editingDoc.id, data)
    } else {
      addDocument(data)
    }
    setShowDocModal(false)
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance & Documents</h1>
          <p className="text-sm text-gray-500 mt-1">Track driver certifications, DOT compliance, and document expirations</p>
        </div>
        <button
          onClick={tab === 'compliance' ? openAddComp : openAddDoc}
          className="btn-primary"
        >
          <Plus size={16} /> {tab === 'compliance' ? 'Add Record' : 'Add Document'}
        </button>
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
            <button onClick={() => setTab('compliance')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'compliance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Compliance Records
            </button>
            <button onClick={() => setTab('documents')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'documents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Driver Documents
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 w-48" />
            </div>
            {tab === 'compliance' && (
              <div className="relative">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ComplianceStatus | '')} className="input-field pl-9 w-40 appearance-none">
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
              <EmptyState icon={<ShieldCheck size={28} />} title="No compliance records" description="Compliance records will appear here once drivers are assigned requirements" action={<button onClick={openAddComp} className="btn-primary text-sm"><Plus size={14} /> Add Record</button>} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Requirement</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Expiration</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Verified</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCompliance.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{c.profiles?.name ?? 'Unknown'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{c.compliance_requirements?.name ?? '-'}</td>
                      <td className="px-5 py-3.5"><ComplianceBadge status={c.status} /></td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{c.expiration_date ? new Date(c.expiration_date).toLocaleDateString() : '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {c.verified_by ? profiles.find(p => p.id === c.verified_by)?.name ?? 'Verified' : 'Pending'}
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => openEditComp(c)} className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors"><Pencil size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredDocs.length === 0 ? (
              <EmptyState icon={<FileText size={28} />} title="No documents" description="Driver documents will appear here once uploaded" action={<button onClick={openAddDoc} className="btn-primary text-sm"><Plus size={14} /> Add Document</button>} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Document Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Number</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Expiration</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
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
                        <td className="px-5 py-3.5">
                          <button onClick={() => openEditDoc(d)} className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors"><Pencil size={15} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={showCompModal} onClose={() => setShowCompModal(false)} title={editingComp ? 'Edit Compliance Record' : 'Add Compliance Record'} size="lg">
        <form onSubmit={handleCompSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Driver" value={compForm.user_id} onChange={v => setCompForm(f => ({ ...f, user_id: v }))} options={driverOptions} placeholder="Select driver..." required />
            <SelectInput label="Requirement" value={compForm.requirement_id} onChange={v => setCompForm(f => ({ ...f, requirement_id: v }))} options={reqOptions} placeholder="Select requirement..." required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Status" value={compForm.status} onChange={v => setCompForm(f => ({ ...f, status: v as ComplianceStatus }))} options={statusOptions} required />
            <TextInput label="Hours Completed" value={compForm.hours_completed} onChange={v => setCompForm(f => ({ ...f, hours_completed: v }))} type="number" placeholder="0" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInput label="Completed Date" value={compForm.completed_date} onChange={v => setCompForm(f => ({ ...f, completed_date: v }))} />
            <DateInput label="Expiration Date" value={compForm.expiration_date} onChange={v => setCompForm(f => ({ ...f, expiration_date: v }))} />
          </div>
          <TextArea label="Notes" value={compForm.notes} onChange={v => setCompForm(f => ({ ...f, notes: v }))} placeholder="Additional notes..." />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowCompModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingComp ? 'Save Changes' : 'Add Record'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDocModal} onClose={() => setShowDocModal(false)} title={editingDoc ? 'Edit Document' : 'Add Document'} size="lg">
        <form onSubmit={handleDocSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Driver" value={docForm.user_id} onChange={v => setDocForm(f => ({ ...f, user_id: v }))} options={driverOptions} placeholder="Select driver..." required />
            <SelectInput label="Document Type" value={docForm.document_type} onChange={v => setDocForm(f => ({ ...f, document_type: v as DocumentType }))} options={docTypeOptions} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Document Number" value={docForm.document_number} onChange={v => setDocForm(f => ({ ...f, document_number: v }))} placeholder="CDL-NY-12345" />
            <TextInput label="Issuing State" value={docForm.issuing_state} onChange={v => setDocForm(f => ({ ...f, issuing_state: v }))} placeholder="NY" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInput label="Issued Date" value={docForm.issued_date} onChange={v => setDocForm(f => ({ ...f, issued_date: v }))} />
            <DateInput label="Expiration Date" value={docForm.expiration_date} onChange={v => setDocForm(f => ({ ...f, expiration_date: v }))} required />
          </div>
          {docForm.document_type === 'CDL' && (
            <TextInput label="CDL Class" value={docForm.cdl_class} onChange={v => setDocForm(f => ({ ...f, cdl_class: v }))} placeholder="A, B, or C" />
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowDocModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingDoc ? 'Save Changes' : 'Add Document'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
