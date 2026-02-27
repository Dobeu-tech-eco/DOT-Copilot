import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { AssignmentBadge, PriorityBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { BookOpen, Search, Clock, CheckCircle, Users, GraduationCap } from 'lucide-react'

export function TrainingPage() {
  const { user } = useAuthStore()
  const { trainingPrograms, assignments, loading, fetchTrainingPrograms, fetchAssignments } = useAppStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'programs' | 'assignments'>('programs')

  useEffect(() => {
    if (user?.fleet_id) {
      fetchTrainingPrograms(user.fleet_id)
      fetchAssignments(user.fleet_id)
    }
  }, [user?.fleet_id, fetchTrainingPrograms, fetchAssignments])

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Programs</h1>
          <p className="text-sm text-gray-500 mt-1">Manage driver training, track progress, and ensure completion</p>
        </div>
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
            <button
              onClick={() => setTab('programs')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'programs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Programs
            </button>
            <button
              onClick={() => setTab('assignments')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'assignments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Assignments
            </button>
          </div>
          <div className="flex-1" />
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
        </div>

        {tab === 'programs' ? (
          filteredPrograms.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={28} />}
              title="No training programs"
              description="Training programs will appear here once created"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {filteredPrograms.map(p => {
                const programAssignments = assignments.filter(a => a.training_program_id === p.id)
                const completed = programAssignments.filter(a => a.status === 'completed').length
                const total = programAssignments.length
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                return (
                  <div key={p.id} className="border border-gray-200 rounded-xl p-4 hover:border-baldor-300 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-lg bg-baldor-50 text-baldor-600">
                        <BookOpen size={18} />
                      </div>
                      {p.is_recommended && <span className="badge badge-success">Recommended</span>}
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mt-3">{p.program_name}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description ?? 'No description'}</p>
                    {p.template_category && (
                      <span className="badge badge-info mt-2">{p.template_category}</span>
                    )}
                    {p.estimated_duration && (
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <Clock size={12} />
                        {p.estimated_duration} min
                      </p>
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
              <EmptyState
                icon={<BookOpen size={28} />}
                title="No assignments"
                description="Training assignments will appear here once created"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Training</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Priority</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Due Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
