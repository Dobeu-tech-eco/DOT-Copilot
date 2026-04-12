import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../store/toastStore'
import { ComplianceBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormInput, FormSelect, FormTextarea, FormSection } from '../components/FormField'
import {
  driverDocumentSchema, complianceRecordSchema, complianceRequirementSchema,
  DOCUMENT_TYPES, COMPLIANCE_STATUSES,
  type DriverDocumentFormData, type ComplianceRecordFormData, type ComplianceRequirementFormData,
} from '../schemas/compliance.schema'
import { USER_ROLES } from '../schemas/profile.schema'
import {
  ShieldCheck, Search, Filter, FileText, AlertTriangle, CheckCircle,
  Plus, Pencil, Trash2, ClipboardList,
} from 'lucide-react'
import type { ComplianceStatus, DriverCompliance, DriverDocument, ComplianceRequirement } from '../types/database'

type Tab = 'compliance' | 'documents' | 'requirements'

export function CompliancePage() {
  const { user } = useAuthStore()
  const {
    complianceRecords, documents, complianceRequirements, profiles, loading,
    fetchComplianceRecords, fetchDocuments, fetchComplianceRequirements, fetchProfiles,
    updateComplianceRecord, createDocument, updateDocument, deleteDocument,
    createRequirement, updateRequirement,
  } = useAppStore()
  const { canManageCompliance, isAdmin } = usePermissions()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | ''>('')
  const [tab, setTab] = useState<Tab>('compliance')

  const [editingRecord, setEditingRecord] = useState<DriverCompliance | null>(null)
  const [showDocModal, setShowDocModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DriverDocument | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<DriverDocument | null>(null)
  const [showReqModal, setShowReqModal] = useState(false)
  const [editingReq, setEditingReq] = useState<ComplianceRequirement | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user?.fleet_id) {
      fetchComplianceRecords(user.fleet_id)
      fetchDocuments(user.fleet_id)
      fetchComplianceRequirements(user.fleet_id)
      fetchProfiles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchComplianceRecords, fetchDocuments, fetchComplianceRequirements, fetchProfiles])

  const recordForm = useForm<ComplianceRecordFormData>({
    resolver: zodResolver(complianceRecordSchema) as never,
  })
  const docForm = useForm<DriverDocumentFormData>({
    resolver: zodResolver(driverDocumentSchema) as never,
  })
  const reqForm = useForm<ComplianceRequirementFormData>({
    resolver: zodResolver(complianceRequirementSchema) as never,
  })

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

  const filteredReqs = complianceRequirements.filter(r => {
    return !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.regulatory_body.toLowerCase().includes(search.toLowerCase())
  })

  const now = new Date()
  const expiredDocs = documents.filter(d => new Date(d.expiration_date) <= now)
  const expiringDocs = documents.filter(d => {
    const exp = new Date(d.expiration_date)
    return exp > now && exp <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  })
  const validDocs = documents.filter(d => new Date(d.expiration_date) > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))

  const openEditRecord = (record: DriverCompliance) => {
    setEditingRecord(record)
    recordForm.reset({
      status: record.status,
      completed_date: record.completed_date ?? '',
      hours_completed: record.hours_completed ?? null,
      notes: record.notes ?? '',
    })
  }

  const handleRecordSubmit = recordForm.handleSubmit(async (data: ComplianceRecordFormData) => {
    if (!editingRecord) return
    setSubmitting(true)
    try {
      await updateComplianceRecord(editingRecord.id, data)
      toast.success('Compliance record updated')
      setEditingRecord(null)
    } catch { toast.error('Failed to update record') }
    finally { setSubmitting(false) }
  })

  const openCreateDoc = () => {
    setEditingDoc(null)
    docForm.reset({
      user_id: '', document_type: 'CDL' as never,
      document_number: '', issued_date: '', expiration_date: '',
      issuing_state: '', cdl_class: '', endorsements: [], restrictions: [],
    })
    setShowDocModal(true)
  }

  const openEditDoc = (doc: DriverDocument) => {
    setEditingDoc(doc)
    docForm.reset({
      user_id: doc.user_id,
      document_type: doc.document_type as never,
      document_number: doc.document_number ?? '',
      issued_date: doc.issued_date ?? '',
      expiration_date: doc.expiration_date,
      issuing_state: doc.issuing_state ?? '',
      cdl_class: doc.cdl_class ?? '',
      endorsements: doc.endorsements ?? [],
      restrictions: doc.restrictions ?? [],
    })
    setShowDocModal(true)
  }

  const handleDocSubmit = docForm.handleSubmit(async (data: DriverDocumentFormData) => {
    if (!user?.fleet_id) return
    setSubmitting(true)
    try {
      if (editingDoc) {
        await updateDocument(editingDoc.id, data)
        toast.success('Document updated')
      } else {
        await createDocument(user.fleet_id, data)
        toast.success('Document created')
      }
      setShowDocModal(false)
    } catch { toast.error('Failed to save document') }
    finally { setSubmitting(false) }
  })

  const handleDeleteDoc = async () => {
    if (!deletingDoc) return
    setSubmitting(true)
    try {
      await deleteDocument(deletingDoc.id)
      toast.success('Document deleted')
      setDeletingDoc(null)
    } catch { toast.error('Failed to delete document') }
    finally { setSubmitting(false) }
  }

  const openCreateReq = () => {
    setEditingReq(null)
    reqForm.reset({
      name: '', description: '', regulatory_body: '',
      required_hours: null, renewal_period: null,
      applies_to: [], is_active: true, alert_days: [30, 60, 90],
    })
    setShowReqModal(true)
  }

  const openEditReq = (req: ComplianceRequirement) => {
    setEditingReq(req)
    reqForm.reset({
      name: req.name, description: req.description ?? '',
      regulatory_body: req.regulatory_body,
      required_hours: req.required_hours ?? null,
      renewal_period: req.renewal_period ?? null,
      applies_to: req.applies_to ?? [],
      is_active: req.is_active,
      alert_days: req.alert_days ?? [30, 60, 90],
    })
    setShowReqModal(true)
  }

  const handleReqSubmit = reqForm.handleSubmit(async (data: ComplianceRequirementFormData) => {
    if (!user?.fleet_id) return
    setSubmitting(true)
    try {
      if (editingReq) {
        await updateRequirement(editingReq.id, data)
        toast.success('Requirement updated')
      } else {
        await createRequirement(user.fleet_id, data)
        toast.success('Requirement created')
      }
      setShowReqModal(false)
    } catch { toast.error('Failed to save requirement') }
    finally { setSubmitting(false) }
  })

  const drivers = profiles.filter(p => p.role === 'DRIVER')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'compliance', label: 'Compliance Records' },
    { key: 'documents', label: 'Driver Documents' },
    { key: 'requirements', label: 'Requirements' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance & Documents</h1>
          <p className="text-sm text-gray-500 mt-1">Track driver certifications, DOT compliance, and document expirations</p>
        </div>
        {canManageCompliance && tab === 'documents' && (
          <button onClick={openCreateDoc} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Document
          </button>
        )}
        {isAdmin && tab === 'requirements' && (
          <button onClick={openCreateReq} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Requirement
          </button>
        )}
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
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
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
                  {COMPLIANCE_STATUSES.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {tab === 'compliance' && (
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
                    {canManageCompliance && <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>}
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
                      {canManageCompliance && (
                        <td className="px-5 py-3.5 text-right">
                          <button onClick={() => openEditRecord(c)} className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors">
                            <Pencil size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'documents' && (
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
                    {canManageCompliance && <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>}
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
                        {canManageCompliance && (
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditDoc(d)} className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors">
                                <Pencil size={15} />
                              </button>
                              <button onClick={() => setDeletingDoc(d)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'requirements' && (
          <div className="overflow-x-auto">
            {filteredReqs.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={28} />}
                title="No requirements"
                description="Compliance requirements will appear here once created"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Regulatory Body</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Hours</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Renewal</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Active</th>
                    {isAdmin && <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredReqs.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{r.name}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{r.regulatory_body}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{r.required_hours ?? '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{r.renewal_period ? `${r.renewal_period} months` : '-'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${r.is_active ? 'badge-success' : 'badge-neutral'}`}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right">
                          <button onClick={() => openEditReq(r)} className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors">
                            <Pencil size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <Modal open={!!editingRecord} onClose={() => setEditingRecord(null)} title="Update Compliance Record">
        <form onSubmit={handleRecordSubmit} className="space-y-5">
          <FormSection title="Status Update">
            <FormSelect
              label="Status"
              required
              options={COMPLIANCE_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
              registration={recordForm.register('status')}
              error={recordForm.formState.errors.status?.message}
            />
            <FormInput
              label="Completed Date"
              type="date"
              registration={recordForm.register('completed_date')}
              error={recordForm.formState.errors.completed_date?.message}
            />
            <FormInput
              label="Hours Completed"
              type="number"
              registration={recordForm.register('hours_completed', { valueAsNumber: true })}
              error={recordForm.formState.errors.hours_completed?.message}
            />
          </FormSection>
          <FormTextarea
            label="Notes"
            registration={recordForm.register('notes')}
            error={recordForm.formState.errors.notes?.message}
            placeholder="Add any relevant notes..."
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setEditingRecord(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : 'Update Record'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showDocModal} onClose={() => setShowDocModal(false)} title={editingDoc ? 'Edit Document' : 'Add Document'} size="lg">
        <form onSubmit={handleDocSubmit} className="space-y-5">
          <FormSection title="Document Information">
            <FormSelect
              label="Driver"
              required
              options={drivers.map(d => ({ value: d.id, label: d.name ?? d.email }))}
              registration={docForm.register('user_id')}
              error={docForm.formState.errors.user_id?.message}
              placeholder="Select driver"
            />
            <FormSelect
              label="Document Type"
              required
              options={DOCUMENT_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))}
              registration={docForm.register('document_type')}
              error={docForm.formState.errors.document_type?.message}
            />
            <FormInput
              label="Document Number"
              registration={docForm.register('document_number')}
              error={docForm.formState.errors.document_number?.message}
              placeholder="e.g., D12345678"
            />
            <FormInput
              label="Issuing State"
              registration={docForm.register('issuing_state')}
              error={docForm.formState.errors.issuing_state?.message}
              placeholder="e.g., NY"
            />
          </FormSection>
          <FormSection title="Dates">
            <FormInput
              label="Issued Date"
              type="date"
              registration={docForm.register('issued_date')}
              error={docForm.formState.errors.issued_date?.message}
            />
            <FormInput
              label="Expiration Date"
              type="date"
              required
              registration={docForm.register('expiration_date')}
              error={docForm.formState.errors.expiration_date?.message}
            />
          </FormSection>
          <FormSection title="CDL Details">
            <FormInput
              label="CDL Class"
              registration={docForm.register('cdl_class')}
              error={docForm.formState.errors.cdl_class?.message}
              placeholder="e.g., A, B, C"
            />
          </FormSection>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowDocModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : editingDoc ? 'Update Document' : 'Add Document'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={handleDeleteDoc}
        title="Delete Document"
        message={`Are you sure you want to delete this ${deletingDoc?.document_type.replace(/_/g, ' ')} document? This action cannot be undone.`}
        loading={submitting}
      />

      <Modal open={showReqModal} onClose={() => setShowReqModal(false)} title={editingReq ? 'Edit Requirement' : 'Add Requirement'} size="lg">
        <form onSubmit={handleReqSubmit} className="space-y-5">
          <FormSection title="Requirement Details">
            <FormInput
              label="Name"
              required
              registration={reqForm.register('name')}
              error={reqForm.formState.errors.name?.message}
              placeholder="e.g., DOT Physical"
            />
            <FormInput
              label="Regulatory Body"
              required
              registration={reqForm.register('regulatory_body')}
              error={reqForm.formState.errors.regulatory_body?.message}
              placeholder="e.g., FMCSA"
            />
            <FormInput
              label="Required Hours"
              type="number"
              registration={reqForm.register('required_hours', { valueAsNumber: true })}
              error={reqForm.formState.errors.required_hours?.message}
            />
            <FormInput
              label="Renewal Period (months)"
              type="number"
              registration={reqForm.register('renewal_period', { valueAsNumber: true })}
              error={reqForm.formState.errors.renewal_period?.message}
            />
          </FormSection>
          <FormTextarea
            label="Description"
            registration={reqForm.register('description')}
            error={reqForm.formState.errors.description?.message}
            placeholder="Describe this compliance requirement..."
          />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="req-active" className="rounded border-gray-300" {...reqForm.register('is_active')} />
            <label htmlFor="req-active" className="text-sm text-gray-700">Active</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Applies To</label>
            <div className="flex flex-wrap gap-2">
              {USER_ROLES.map(role => (
                <label key={role} className="flex items-center gap-1.5 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={reqForm.watch('applies_to')?.includes(role) ?? false}
                    onChange={e => {
                      const current = reqForm.getValues('applies_to') ?? []
                      reqForm.setValue('applies_to', e.target.checked
                        ? [...current, role]
                        : current.filter(r => r !== role)
                      )
                    }}
                  />
                  {role.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowReqModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : editingReq ? 'Update Requirement' : 'Add Requirement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
