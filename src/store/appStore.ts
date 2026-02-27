import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  Profile,
  Fleet,
  TrainingProgram,
  Assignment,
  DriverCompliance,
  DriverDocument,
  Vehicle,
  Notification,
  CompletionRecord,
  DriverStats,
  ComplianceRequirement,
} from '../types/database'

interface DashboardStats {
  totalDrivers: number
  activeDrivers: number
  totalVehicles: number
  complianceRate: number
  overdueAssignments: number
  completedTrainings: number
  expiringDocuments: number
  upcomingExpirations: DriverDocument[]
}

interface AppState {
  fleet: Fleet | null
  profiles: Profile[]
  trainingPrograms: TrainingProgram[]
  assignments: Assignment[]
  complianceRecords: DriverCompliance[]
  documents: DriverDocument[]
  vehicles: Vehicle[]
  notifications: Notification[]
  completionRecords: CompletionRecord[]
  driverStats: DriverStats[]
  complianceRequirements: ComplianceRequirement[]
  dashboardStats: DashboardStats | null
  loading: Record<string, boolean>

  fetchFleet: (fleetId: string) => Promise<void>
  fetchProfiles: (fleetId: string) => Promise<void>
  fetchTrainingPrograms: (fleetId: string) => Promise<void>
  fetchAssignments: (fleetId: string) => Promise<void>
  fetchComplianceRecords: (fleetId: string) => Promise<void>
  fetchDocuments: (fleetId: string) => Promise<void>
  fetchVehicles: (fleetId: string) => Promise<void>
  fetchNotifications: (userId: string) => Promise<void>
  fetchDashboardStats: (fleetId: string) => Promise<void>
  fetchComplianceRequirements: (fleetId: string) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  fleet: null,
  profiles: [],
  trainingPrograms: [],
  assignments: [],
  complianceRecords: [],
  documents: [],
  vehicles: [],
  notifications: [],
  completionRecords: [],
  driverStats: [],
  complianceRequirements: [],
  dashboardStats: null,
  loading: {},

  fetchFleet: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, fleet: true } }))
    const { data } = await supabase.from('fleets').select('*').eq('id', fleetId).maybeSingle()
    set(s => ({ fleet: data, loading: { ...s.loading, fleet: false } }))
  },

  fetchProfiles: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, profiles: true } }))
    const { data } = await supabase.from('profiles').select('*').eq('fleet_id', fleetId).order('name')
    set(s => ({ profiles: data ?? [], loading: { ...s.loading, profiles: false } }))
  },

  fetchTrainingPrograms: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, trainingPrograms: true } }))
    const { data } = await supabase.from('training_programs').select('*').eq('fleet_id', fleetId).order('program_name')
    set(s => ({ trainingPrograms: data ?? [], loading: { ...s.loading, trainingPrograms: false } }))
  },

  fetchAssignments: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, assignments: true } }))
    const { data } = await supabase
      .from('assignments')
      .select('*, profiles(*), training_programs(*), modules(*)')
      .eq('fleet_id', fleetId)
      .order('created_at', { ascending: false })
    set(s => ({ assignments: data ?? [], loading: { ...s.loading, assignments: false } }))
  },

  fetchComplianceRecords: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, compliance: true } }))
    const { data } = await supabase
      .from('driver_compliance')
      .select('*, compliance_requirements(*), profiles!inner(*)')
      .eq('profiles.fleet_id', fleetId)
    set(s => ({ complianceRecords: data ?? [], loading: { ...s.loading, compliance: false } }))
  },

  fetchDocuments: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, documents: true } }))
    const { data } = await supabase
      .from('driver_documents')
      .select('*, profiles(*)')
      .eq('fleet_id', fleetId)
      .order('expiration_date')
    set(s => ({ documents: data ?? [], loading: { ...s.loading, documents: false } }))
  },

  fetchVehicles: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, vehicles: true } }))
    const { data } = await supabase
      .from('vehicles')
      .select('*, profiles(*)')
      .eq('fleet_id', fleetId)
      .order('vehicle_number')
    set(s => ({ vehicles: data ?? [], loading: { ...s.loading, vehicles: false } }))
  },

  fetchNotifications: async (userId: string) => {
    set(s => ({ loading: { ...s.loading, notifications: true } }))
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    set(s => ({ notifications: data ?? [], loading: { ...s.loading, notifications: false } }))
  },

  fetchComplianceRequirements: async (fleetId: string) => {
    const { data } = await supabase
      .from('compliance_requirements')
      .select('*')
      .eq('fleet_id', fleetId)
      .eq('is_active', true)
    set({ complianceRequirements: data ?? [] })
  },

  fetchDashboardStats: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, dashboard: true } }))
    const store = get()

    const [profilesRes, vehiclesRes, assignmentsRes, docsRes, completionsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('fleet_id', fleetId),
      supabase.from('vehicles').select('*').eq('fleet_id', fleetId),
      supabase.from('assignments').select('*').eq('fleet_id', fleetId),
      supabase.from('driver_documents').select('*').eq('fleet_id', fleetId).order('expiration_date'),
      supabase.from('completion_records').select('*').eq('fleet_id', fleetId),
    ])

    const allProfiles = (profilesRes.data ?? []) as Profile[]
    const allVehicles = (vehiclesRes.data ?? []) as Vehicle[]
    const allAssignments = (assignmentsRes.data ?? []) as Assignment[]
    const docs = (docsRes.data ?? []) as DriverDocument[]

    const drivers = allProfiles.filter(p => p.role === 'DRIVER')
    const activeDrivers = drivers.filter(p => p.is_active)
    const overdueAssignments = allAssignments.filter(a => a.status === 'overdue')

    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expiringDocs = docs.filter(d => {
      const exp = new Date(d.expiration_date)
      return exp > now && exp <= thirtyDays
    })
    const expiredDocs = docs.filter(d => new Date(d.expiration_date) <= now)

    const issueCount = store.complianceRecords.filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON').length
    const complianceRate = drivers.length > 0
      ? Math.round(((drivers.length - (issueCount > 0 ? expiredDocs.length : 0)) / Math.max(drivers.length, 1)) * 100)
      : 100

    set(s => ({
      dashboardStats: {
        totalDrivers: drivers.length,
        activeDrivers: activeDrivers.length,
        totalVehicles: allVehicles.filter(v => v.is_active).length,
        complianceRate: Math.min(complianceRate, 100),
        overdueAssignments: overdueAssignments.length,
        completedTrainings: completionsRes.data?.length ?? 0,
        expiringDocuments: expiringDocs.length + expiredDocs.length,
        upcomingExpirations: expiringDocs.slice(0, 5),
      },
      loading: { ...s.loading, dashboard: false },
    }))
  },

  markNotificationRead: async (id: string) => {
    await supabase.from('notifications').update({ is_read: true } as never).eq('id', id)
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
    }))
  },
}))
