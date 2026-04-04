import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { AssignmentBadge, PriorityBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { TextInput, SelectInput, DateInput, TextArea, CheckboxInput } from '../components/FormFields'
import { BookOpen, Search, Clock, CheckCircle, Users, GraduationCap, Plus, Pencil } from 'lucide-react'
import type { TrainingProgram, Assignment, AssignmentPriority, AssignmentStatus } from '../types/database'

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
]

export function TrainingPage() {
  const { user } = useAuthStore()
  const {
    trainingPrograms, assignments, profiles, loading,
    fetchTrainingPrograms, fetchAssignments, fetchProfiles,
    addTrainingProgram, updateTrainingProgram, addAssignment, updateAssignment,
  } = useAppStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'programs' | 'assignments'>('programs')
  const [showProgramModal, setShowProgramModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)

  const [programForm, setProgramForm] = useState({
    program_name: '', description: '', template_category: '', estimated_duration: '',
    is_recommended: false, is_template: false, fleet_id: '',
    compliance_requirement_id: null as string | null,
  })

  const [assignForm, setAssignForm] = useState({
    user_id: '', training_program_id: '', priority: 'normal' as AssignmentPriority,
    due_date: '', status: 'pending' as AssignmentStatus,
  })

  useEffect(() => {
    if (user?.fleet_id) {
      fetchTrainingPrograms(user.fleet_id)
      fetchAssignments(user.fleet_id)
      fetchProfiles(user.fleet_id)
    }
  }, [user?.fleet_id, fetchTrainingPrograms, fetchAssignments, fetchProfiles])

  const driverOptions = profiles
    .filter(p => p.role === 'DRIVER' && p.is_active)
    .map(p => ({ value: p.id, label: p.name ?? p.email }))

  const programOptions = trainingPrograms.map(p => ({ value: p.id, label: p.program_name }))

  const openAddProgram = () => {
    setEditingProgram(null)
    setProgramForm({ program_name: '', description: '', template_category: '', estimated_duration: '', is_recommended: false, is_template: false, fleet_id: user?.fleet_id ?? '', compliance_requirement_id: null })
    setShowProgramModal(true)
  }

  const openEditProgram = (p: TrainingProgram) => {
    setEditingProgram(p)
    setProgramForm({
      program_name: p.program_name, description: p.description ?? '', template_category: p.template_category ?? '',
      estimated_duration: p.estimated_duration?.toString() ?? '', is_recommended: p.is_recommended,
      is_template: p.is_template, fleet_id: p.fleet_id, compliance_requirement_id: p.compliance_requirement_id,
    })
    setShowProgramModal(true)
  }

  const handleProgramSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      program_name: programForm.program_name,
      description: programForm.description || null,
      template_category: programForm.template_category || null,
      estimated_duration: programForm.estimated_duration ? parseInt(programForm.estimated_duration) : null,
      is_recommended: programForm.is_recommended,
      is_template: programForm.is_template,
      fleet_id: user?.fleet_id ?? '',
      compliance_requirement_id: programForm.compliance_requirement_id,
    }
    if (editingProgram) {
      updateTrainingProgram(editingProgram.id, data)
    } else {
      addTrainingProgram(data)
    }
    setShowProgramModal(false)
  }

  const openAddAssignment = () => {
    setEditingAssignment(null)
    setAssignForm({ user_id: '', training_program_id: '', priority: 'normal', due_date: '', status: 'pending' })
    setShowAssignModal(true)
  }

  const openEditAssignment = (a: Assignment) => {
    setEditingAssignment(a)
    setAssignForm({
      user_id: a.user_id, training_program_id: a.training_program_id ?? '',
      priority: a.priority, due_date: a.due_date ?? '', status: a.status,
    })
    setShowAssignModal(true)
  }

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingAssignment) {
      updateAssignment(editingAssignment.id, {
        status: assignForm.status,
        priority: assignForm.priority,
        due_date: assignForm.due_date || null,
      })
    } else {
      addAssignment({
        user_id: assignForm.user_id,
        fleet_id: user?.fleet_id ?? '',
        training_program_id: assignForm.training_program_id || null,
        module_id: null,
        assigned_by: user?.id ?? null,
        priority: assignForm.priority,
        due_date: assignForm.due_date || null,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        reminders_sent: 0,
      })
    }
    setShowAssignModal(false)
  }

  if (loading.trainingPrograms) return <LoadingSpinner />

  const filteredPrograms = trainingPrograms.filter(p =>
    !search || p.program_name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredAssignments = assignments.filter(a => {
    const name = a.training_programs?.program_name ?? a.modules?.module_name ?? ''
    const driverName = a.profiles?.name ?? ''
    return !search || name.toLowerCase().includes(search.toLowerCase()) || driverName.toLowerCase().includes(search.toLowerCase())
  })

  const completedCount = assignments.filter(a => a.status === 'completed').length
  const inProgressCount = assignments.filter(a => a.status === 'in_progress').length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Programs</h1>
          <p className="text-sm text-gray-500 mt-1">Manage driver training, track progress, and ensure completion</p>
        </div>
        <button
          onClick={tab === 'programs' ? openAddProgram : openAddAssignment}
          className="btn-primary"
        >
          <Plus size={16} /> {tab === 'programs' ? 'Create Program' : 'Assign Training'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-baldor-50 text-baldor-600"><GraduationCap size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{trainingPrograms.length}</p>
            <p className="text-xs text-gray-500">Programs</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Users size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
            <p className="text-xs text-gray-500">Assignments</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><Clock size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{inProgressCount}</p>
            <p className="text-xs text-gray-500">In Progress</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><CheckCircle size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTab('programs')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'programs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Programs</button>
            <button onClick={() => setTab('assignments')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'assignments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Assignments</button>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 w-48" />
          </div>
        </div>

        {tab === 'programs' ? (
          filteredPrograms.length === 0 ? (
            <EmptyState icon={<BookOpen size={28} />} title="No training programs" description="Training programs will appear here once created" action={<button onClick={openAddProgram} className="btn-primary text-sm"><Plus size={14} /> Create Program</button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {filteredPrograms.map(p => {
                const programAssignments = assignments.filter(a => a.training_program_id === p.id)
                const completed = programAssignments.filter(a => a.status === 'completed').length
                const total = programAssignments.length
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                return (
                  <div key={p.id} className="border border-gray-200 rounded-xl p-4 hover:border-baldor-300 hover:shadow-sm transition-all cursor-pointer" onClick={() => openEditProgram(p)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-lg bg-baldor-50 text-baldor-600"><BookOpen size={18} /></div>
                      <div className="flex items-center gap-1">
                        {p.is_recommended && <span className="badge badge-success">Recommended</span>}
                        <button onClick={(e) => { e.stopPropagation(); openEditProgram(p) }} className="p-1 text-gray-400 hover:text-baldor-600 rounded transition-colors"><Pencil size={13} /></button>
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mt-3">{p.program_name}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description ?? 'No description'}</p>
                    {p.template_category && <span className="badge badge-info mt-2">{p.template_category}</span>}
                    {p.estimated_duration && (
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><Clock size={12} />{p.estimated_duration} min</p>
                    )}
                    {total > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">{completed}/{total} completed</span>
                          <span className="font-medium text-gray-700">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-baldor-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
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
              <EmptyState icon={<BookOpen size={28} />} title="No assignments" description="Training assignments will appear here once created" action={<button onClick={openAddAssignment} className="btn-primary text-sm"><Plus size={14} /> Assign Training</button>} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Training</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Priority</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Due Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
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
                      <td className="px-5 py-3.5">
                        <button onClick={() => openEditAssignment(a)} className="p-1.5 text-gray-400 hover:text-baldor-600 hover:bg-baldor-50 rounded-lg transition-colors"><Pencil size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={showProgramModal} onClose={() => setShowProgramModal(false)} title={editingProgram ? 'Edit Training Program' : 'Create Training Program'} size="lg">
        <form onSubmit={handleProgramSubmit} className="space-y-4">
          <TextInput label="Program Name" value={programForm.program_name} onChange={v => setProgramForm(f => ({ ...f, program_name: v }))} placeholder="New Driver Orientation" required />
          <TextArea label="Description" value={programForm.description} onChange={v => setProgramForm(f => ({ ...f, description: v }))} placeholder="Describe the program goals and content..." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Category" value={programForm.template_category} onChange={v => setProgramForm(f => ({ ...f, template_category: v }))} placeholder="Safety, Compliance, Onboarding..." />
            <TextInput label="Estimated Duration (minutes)" value={programForm.estimated_duration} onChange={v => setProgramForm(f => ({ ...f, estimated_duration: v }))} type="number" placeholder="120" />
          </div>
          <CheckboxInput label="Recommended" checked={programForm.is_recommended} onChange={v => setProgramForm(f => ({ ...f, is_recommended: v }))} description="Mark as a recommended program for new drivers" />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowProgramModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingProgram ? 'Save Changes' : 'Create Program'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title={editingAssignment ? 'Edit Assignment' : 'Assign Training'} size="md">
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          {!editingAssignment && (
            <>
              <SelectInput label="Driver" value={assignForm.user_id} onChange={v => setAssignForm(f => ({ ...f, user_id: v }))} options={driverOptions} placeholder="Select driver..." required />
              <SelectInput label="Training Program" value={assignForm.training_program_id} onChange={v => setAssignForm(f => ({ ...f, training_program_id: v }))} options={programOptions} placeholder="Select program..." required />
            </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Priority" value={assignForm.priority} onChange={v => setAssignForm(f => ({ ...f, priority: v as AssignmentPriority }))} options={priorityOptions} required />
            <DateInput label="Due Date" value={assignForm.due_date} onChange={v => setAssignForm(f => ({ ...f, due_date: v }))} />
          </div>
          {editingAssignment && (
            <SelectInput label="Status" value={assignForm.status} onChange={v => setAssignForm(f => ({ ...f, status: v as AssignmentStatus }))} options={statusOptions} required />
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingAssignment ? 'Save Changes' : 'Assign Training'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
