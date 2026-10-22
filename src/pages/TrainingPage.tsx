import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../store/toastStore'
import { AssignmentBadge, PriorityBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormInput, FormTextarea, FormSelect } from '../components/FormField'
import { trainingProgramSchema, assignmentSchema } from '../schemas/training.schema'
import type { TrainingProgramFormData, AssignmentFormData } from '../schemas/training.schema'
import { ContentTab } from '../components/training/ContentTab'
import { BookOpen, Search, Clock, CircleCheck as CheckCircle, Users, GraduationCap, Plus, Pencil, Trash2 } from 'lucide-react'
import type { TrainingProgram } from '../types/database'

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export function TrainingPage() {
  const { user } = useAuthStore()
  const { trainingPrograms, assignments, profiles, loading, fetchTrainingPrograms, fetchAssignments, fetchProfiles, createTrainingProgram, updateTrainingProgram, deleteTrainingProgram, createAssignment, deleteAssignment } = useAppStore()
  const { canManageTraining, canAssignTraining } = usePermissions()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'programs' | 'assignments' | 'content'>('programs')
  const [programModal, setProgramModal] = useState(false)
  const [assignModal, setAssignModal] = useState(false)
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'program' | 'assignment'; id: string; name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const programForm = useForm<TrainingProgramFormData>({
    resolver: zodResolver(trainingProgramSchema) as never,
    defaultValues: { is_recommended: false },
  })

  const assignForm = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema) as never,
    defaultValues: { priority: 'normal' },
  })

  useEffect(() => {
    if (user?.fleet_id) {
      fetchTrainingPrograms(user.fleet_id)
      fetchAssignments(user.fleet_id)
      fetchProfiles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchTrainingPrograms, fetchAssignments, fetchProfiles])

  const openCreateProgram = () => {
    setEditingProgram(null)
    programForm.reset({ is_recommended: false })
    setProgramModal(true)
  }

  const openEditProgram = (p: TrainingProgram) => {
    setEditingProgram(p)
    programForm.reset({
      program_name: p.program_name,
      description: p.description ?? '',
      estimated_duration: p.estimated_duration ?? undefined,
      is_recommended: p.is_recommended,
      template_category: p.template_category ?? '',
    })
    setProgramModal(true)
  }

  const handleProgramSubmit = programForm.handleSubmit(async (data: TrainingProgramFormData) => {
    if (!user?.fleet_id) return
    setSubmitting(true)
    try {
      if (editingProgram) {
        await updateTrainingProgram(editingProgram.id, data)
        toast.success('Program updated')
      } else {
        await createTrainingProgram(user.fleet_id, data)
        toast.success('Program created')
      }
      setProgramModal(false)
    } catch { toast.error('Failed to save program') }
    finally { setSubmitting(false) }
  })

  const handleAssignSubmit = assignForm.handleSubmit(async (data: AssignmentFormData) => {
    if (!user?.fleet_id || !user?.id) return
    setSubmitting(true)
    try {
      await createAssignment(user.fleet_id, user.id, data)
      toast.success('Assignment created')
      setAssignModal(false)
      assignForm.reset({ priority: 'normal' })
    } catch { toast.error('Failed to create assignment') }
    finally { setSubmitting(false) }
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      if (deleteTarget.type === 'program') await deleteTrainingProgram(deleteTarget.id)
      else await deleteAssignment(deleteTarget.id)
      toast.success(`${deleteTarget.type === 'program' ? 'Program' : 'Assignment'} deleted`)
      setDeleteTarget(null)
    } catch { toast.error('Failed to delete') }
    finally { setSubmitting(false) }
  }

  if (loading.trainingPrograms) return <LoadingSpinner />

  const filteredPrograms = trainingPrograms.filter(p => !search || p.program_name.toLowerCase().includes(search.toLowerCase()))
  const filteredAssignments = assignments.filter(a => {
    const name = a.training_programs?.program_name ?? a.modules?.module_name ?? ''
    const driverName = a.profiles?.name ?? ''
    return !search || name.toLowerCase().includes(search.toLowerCase()) || driverName.toLowerCase().includes(search.toLowerCase())
  })

  const completedCount = assignments.filter(a => a.status === 'completed').length
  const inProgressCount = assignments.filter(a => a.status === 'in_progress').length
  const driverOptions = profiles.filter(p => p.role === 'DRIVER' && p.is_active).map(p => ({ value: p.id, label: p.name ?? p.email }))
  const programOptions = trainingPrograms.map(p => ({ value: p.id, label: p.program_name }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Programs</h1>
          <p className="text-sm text-gray-500 mt-1">Manage driver training, track progress, and ensure completion</p>
        </div>
        <div className="flex gap-2">
          {canAssignTraining && (
            <button onClick={() => { assignForm.reset({ priority: 'normal' }); setAssignModal(true) }} className="btn-secondary"><Users size={16} /> Assign</button>
          )}
          {canManageTraining && (
            <button onClick={openCreateProgram} className="btn-primary"><Plus size={16} /> New Program</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-50 text-brand-600"><GraduationCap size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{trainingPrograms.length}</p><p className="text-xs text-gray-500">Programs</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Users size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{assignments.length}</p><p className="text-xs text-gray-500">Assignments</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><Clock size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{inProgressCount}</p><p className="text-xs text-gray-500">In Progress</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><CheckCircle size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{completedCount}</p><p className="text-xs text-gray-500">Completed</p></div>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTab('programs')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'programs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Programs</button>
            <button onClick={() => setTab('assignments')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'assignments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Assignments</button>
            <button onClick={() => setTab('content')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'content' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Content</button>
          </div>
          <div className="flex-1" />
          {tab !== 'content' && (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 w-48" />
            </div>
          )}
        </div>

        {tab === 'content' ? (
          <ContentTab
            trainingPrograms={trainingPrograms}
            fleetId={user?.fleet_id ?? ''}
            canManage={canManageTraining}
          />
        ) : tab === 'programs' ? (
          filteredPrograms.length === 0 ? (
            <EmptyState icon={<BookOpen size={28} />} title="No training programs" description="Create a program to get started" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {filteredPrograms.map(p => {
                const pa = assignments.filter(a => a.training_program_id === p.id)
                const completed = pa.filter(a => a.status === 'completed').length
                const total = pa.length
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                return (
                  <div key={p.id} className="border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-lg bg-brand-50 text-brand-600"><BookOpen size={18} /></div>
                      <div className="flex items-center gap-1">
                        {p.is_recommended && <span className="badge badge-success">Recommended</span>}
                        {canManageTraining && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button onClick={() => openEditProgram(p)} className="p-1 text-gray-400 hover:text-brand-600"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteTarget({ type: 'program', id: p.id, name: p.program_name })} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mt-3">{p.program_name}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description ?? 'No description'}</p>
                    {p.template_category && <span className="badge badge-info mt-2">{p.template_category}</span>}
                    {p.estimated_duration && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><Clock size={12} />{p.estimated_duration} min</p>}
                    {total > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">{completed}/{total} completed</span><span className="font-medium text-gray-700">{pct}%</span></div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            {filteredAssignments.length === 0 ? (
              <EmptyState icon={<BookOpen size={28} />} title="No assignments" description="Assign training to drivers to get started" />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Training</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Priority</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Due Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                    {canManageTraining && <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAssignments.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{a.profiles?.name ?? 'Unknown'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{a.training_programs?.program_name ?? a.modules?.module_name ?? '-'}</td>
                      <td className="px-5 py-3.5"><PriorityBadge priority={a.priority} /></td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{a.due_date ? new Date(a.due_date).toLocaleDateString() : '-'}</td>
                      <td className="px-5 py-3.5"><AssignmentBadge status={a.status} /></td>
                      {canManageTraining && (
                        <td className="px-5 py-3.5 text-right">
                          <button onClick={() => setDeleteTarget({ type: 'assignment', id: a.id, name: a.profiles?.name ?? 'assignment' })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
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

      <Modal open={programModal} onClose={() => setProgramModal(false)} title={editingProgram ? 'Edit Program' : 'New Program'}>
        <form onSubmit={handleProgramSubmit} className="space-y-4">
          <FormInput label="Program Name" required registration={programForm.register('program_name')} error={programForm.formState.errors.program_name?.message} />
          <FormTextarea label="Description" registration={programForm.register('description')} />
          <FormInput label="Estimated Duration (min)" type="number" registration={programForm.register('estimated_duration', { valueAsNumber: true })} />
          <FormInput label="Category" registration={programForm.register('template_category')} placeholder="e.g. Safety, Compliance" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_rec" className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" {...programForm.register('is_recommended')} />
            <label htmlFor="is_rec" className="text-sm text-gray-700">Recommended Program</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setProgramModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editingProgram ? 'Save Changes' : 'Create Program'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign Training">
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <FormSelect label="Driver" required options={driverOptions} registration={assignForm.register('user_id')} error={assignForm.formState.errors.user_id?.message} placeholder="Select driver" />
          <FormSelect label="Program" required options={programOptions} registration={assignForm.register('training_program_id')} error={assignForm.formState.errors.training_program_id?.message} placeholder="Select program" />
          <FormSelect label="Priority" options={priorityOptions} registration={assignForm.register('priority')} />
          <FormInput label="Due Date" type="date" registration={assignForm.register('due_date')} />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setAssignModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Assign Training'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type === 'program' ? 'Program' : 'Assignment'}`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={submitting}
      />
    </div>
  )
}
