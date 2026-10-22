import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { StatsCard } from '../components/StatsCard'
import { ComplianceBadge, AssignmentBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useTheme } from '../components/ThemeProvider'
import {
  Users,
  Truck,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  FileWarning,
  Clock,
  TrendingUp,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

export function DashboardPage() {
  const { user } = useAuthStore()
  const theme = useTheme()
  const {
    dashboardStats, assignments, complianceRecords, documents,
    loading, fetchDashboardStats, fetchAssignments, fetchComplianceRecords, fetchDocuments,
    fetchProfiles, fetchVehicles,
  } = useAppStore()

  useEffect(() => {
    if (user?.fleet_id) {
      const loadAll = async () => {
        await Promise.all([
          fetchProfiles(user.fleet_id!),
          fetchVehicles(user.fleet_id!),
          fetchAssignments(user.fleet_id!),
          fetchComplianceRecords(user.fleet_id!),
          fetchDocuments(user.fleet_id!),
        ])
        await fetchDashboardStats(user.fleet_id!)
      }
      loadAll()
    }
  }, [user?.fleet_id])

  if (loading.dashboard) return <LoadingSpinner />

  const stats = dashboardStats

  const complianceDistribution = [
    { name: 'Compliant', value: complianceRecords.filter(c => c.status === 'COMPLIANT').length },
    { name: 'Expiring', value: complianceRecords.filter(c => c.status === 'EXPIRING_SOON').length },
    { name: 'In Progress', value: complianceRecords.filter(c => c.status === 'IN_PROGRESS').length },
    { name: 'Expired', value: complianceRecords.filter(c => c.status === 'EXPIRED').length },
  ].filter(d => d.value > 0)

  const assignmentsByStatus = [
    { name: 'Pending', count: assignments.filter(a => a.status === 'pending').length },
    { name: 'In Progress', count: assignments.filter(a => a.status === 'in_progress').length },
    { name: 'Completed', count: assignments.filter(a => a.status === 'completed').length },
    { name: 'Overdue', count: assignments.filter(a => a.status === 'overdue').length },
  ]

  const recentAssignments = assignments.slice(0, 5)
  const now = new Date()
  const expiringDocs = documents
    .filter(d => {
      const exp = new Date(d.expiration_date)
      return exp > now && exp <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    })
    .slice(0, 5)
  const chartColors = [theme.colors[500], theme.colors[400], '#f59e0b', '#ef4444']

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fleet Overview</h1>
        <p className="text-sm text-gray-500 mt-1">{theme.displayName} - Fleet Management Dashboard</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Active Drivers"
          value={stats?.activeDrivers ?? 0}
          icon={<Users size={20} />}
          color="green"
        />
        <StatsCard
          label="Fleet Vehicles"
          value={stats?.totalVehicles ?? 0}
          icon={<Truck size={20} />}
          color="blue"
        />
        <StatsCard
          label="Compliance Rate"
          value={`${stats?.complianceRate ?? 0}%`}
          icon={<ShieldCheck size={20} />}
          color={stats && stats.complianceRate < 80 ? 'amber' : 'green'}
        />
        <StatsCard
          label="Overdue Assignments"
          value={stats?.overdueAssignments ?? 0}
          icon={<AlertTriangle size={20} />}
          color={stats && stats.overdueAssignments > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Trainings Completed"
          value={stats?.completedTrainings ?? 0}
          icon={<BookOpen size={20} />}
          color="blue"
        />
        <StatsCard
          label="Expiring Documents"
          value={stats?.expiringDocuments ?? 0}
          icon={<FileWarning size={20} />}
          color={stats && stats.expiringDocuments > 0 ? 'amber' : 'green'}
        />
        <StatsCard
          label="Total Drivers"
          value={stats?.totalDrivers ?? 0}
          icon={<Users size={20} />}
          color="slate"
        />
        <StatsCard
          label="Pending Reviews"
          value={assignments.filter(a => a.status === 'pending').length}
          icon={<Clock size={20} />}
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-brand-600" />
            Assignments by Status
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assignmentsByStatus} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill={theme.colors[500]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-brand-600" />
            Compliance Distribution
          </h3>
          {complianceDistribution.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-56 w-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={complianceDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {complianceDistribution.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {complianceDistribution.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors[i % chartColors.length] }} />
                    <span className="text-gray-600">{entry.name}</span>
                    <span className="font-semibold text-gray-900">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">No compliance data available</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Recent Assignments</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentAssignments.length === 0 ? (
              <p className="text-sm text-gray-500 p-5 text-center">No assignments yet</p>
            ) : (
              recentAssignments.map(a => (
                <div key={a.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {a.training_programs?.program_name ?? a.modules?.module_name ?? 'Training Assignment'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.profiles?.name ?? 'Unknown Driver'}
                      {a.due_date && ` - Due ${new Date(a.due_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <AssignmentBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Expiring Documents</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {expiringDocs.length === 0 ? (
              <p className="text-sm text-gray-500 p-5 text-center">No documents expiring soon</p>
            ) : (
              expiringDocs.map(d => {
                const daysLeft = Math.ceil((new Date(d.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={d.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {d.document_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {d.profiles?.name ?? 'Unknown'} - Expires {new Date(d.expiration_date).toLocaleDateString()}
                      </p>
                    </div>
                    <ComplianceBadge status={daysLeft <= 14 ? 'EXPIRING_SOON' : 'COMPLIANT'} />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
