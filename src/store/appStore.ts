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
import {
  isDemoMode,
  demoFleet,
  demoProfiles,
  demoVehicles,
  demoComplianceRequirements,
  demoComplianceRecords,
  demoDocuments,
  demoTrainingPrograms,
  demoAssignments,
  demoNotifications,
  demoCompletionRecords,
  demoDriverStats,
} from './demoData'

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

  addProfile: (profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) => void
  updateProfile: (id: string, updates: Partial<Profile>) => void
  deleteProfile: (id: string) => void

  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'created_at'>) => void
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void
  deleteVehicle: (id: string) => void

  updateFleet: (updates: Partial<Fleet>) => void

  addComplianceRecord: (record: Omit<DriverCompliance, 'id' | 'created_at'>) => void
  updateComplianceRecord: (id: string, updates: Partial<DriverCompliance>) => void

  addDocument: (doc: Omit<DriverDocument, 'id' | 'created_at'>) => void
  updateDocument: (id: string, updates: Partial<DriverDocument>) => void

  addTrainingProgram: (program: Omit<TrainingProgram, 'id' | 'created_at' | 'updated_at'>) => void
  updateTrainingProgram: (id: string, updates: Partial<TrainingProgram>) => void

  addAssignment: (assignment: Omit<Assignment, 'id' | 'created_at'>) => void
  updateAssignment: (id: string, updates: Partial<Assignment>) => void
}

let idCounter = 1000
function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${idCounter++}`
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
    if (isDemoMode()) {
      set(s => ({ fleet: demoFleet, loading: { ...s.loading, fleet: false } }))
      return
    }
    const { data } = await supabase.from('fleets').select('*').eq('id', fleetId).maybeSingle()
    set(s => ({ fleet: data, loading: { ...s.loading, fleet: false } }))
  },

  fetchProfiles: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, profiles: true } }))
    if (isDemoMode()) {
      set(s => ({ profiles: [...demoProfiles], loading: { ...s.loading, profiles: false } }))
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('fleet_id', fleetId).order('name')
    set(s => ({ profiles: data ?? [], loading: { ...s.loading, profiles: false } }))
  },

  fetchTrainingPrograms: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, trainingPrograms: true } }))
    if (isDemoMode()) {
      set(s => ({ trainingPrograms: [...demoTrainingPrograms], loading: { ...s.loading, trainingPrograms: false } }))
      return
    }
    const { data } = await supabase.from('training_programs').select('*').eq('fleet_id', fleetId).order('program_name')
    set(s => ({ trainingPrograms: data ?? [], loading: { ...s.loading, trainingPrograms: false } }))
  },

  fetchAssignments: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, assignments: true } }))
    if (isDemoMode()) {
      set(s => ({ assignments: [...demoAssignments], loading: { ...s.loading, assignments: false } }))
      return
    }
    const { data } = await supabase
      .from('assignments')
      .select('*, profiles(*), training_programs(*), modules(*)')
      .eq('fleet_id', fleetId)
      .order('created_at', { ascending: false })
    set(s => ({ assignments: data ?? [], loading: { ...s.loading, assignments: false } }))
  },

  fetchComplianceRecords: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, compliance: true } }))
    if (isDemoMode()) {
      set(s => ({ complianceRecords: [...demoComplianceRecords], loading: { ...s.loading, compliance: false } }))
      return
    }
    const { data } = await supabase
      .from('driver_compliance')
      .select('*, compliance_requirements(*), profiles!inner(*)')
      .eq('profiles.fleet_id', fleetId)
    set(s => ({ complianceRecords: data ?? [], loading: { ...s.loading, compliance: false } }))
  },

  fetchDocuments: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, documents: true } }))
    if (isDemoMode()) {
      set(s => ({ documents: [...demoDocuments], loading: { ...s.loading, documents: false } }))
      return
    }
    const { data } = await supabase
      .from('driver_documents')
      .select('*, profiles(*)')
      .eq('fleet_id', fleetId)
      .order('expiration_date')
    set(s => ({ documents: data ?? [], loading: { ...s.loading, documents: false } }))
  },

  fetchVehicles: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, vehicles: true } }))
    if (isDemoMode()) {
      set(s => ({ vehicles: [...demoVehicles], loading: { ...s.loading, vehicles: false } }))
      return
    }
    const { data } = await supabase
      .from('vehicles')
      .select('*, profiles(*)')
      .eq('fleet_id', fleetId)
      .order('vehicle_number')
    set(s => ({ vehicles: data ?? [], loading: { ...s.loading, vehicles: false } }))
  },

  fetchNotifications: async (userId: string) => {
    set(s => ({ loading: { ...s.loading, notifications: true } }))
    if (isDemoMode()) {
      set(s => ({ notifications: [...demoNotifications], loading: { ...s.loading, notifications: false } }))
      return
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    set(s => ({ notifications: data ?? [], loading: { ...s.loading, notifications: false } }))
  },

  fetchComplianceRequirements: async (fleetId: string) => {
    if (isDemoMode()) {
      set({ complianceRequirements: [...demoComplianceRequirements] })
      return
    }
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

    if (isDemoMode()) {
      if (store.completionRecords.length === 0) {
        set({ completionRecords: [...demoCompletionRecords], driverStats: [...demoDriverStats] })
      }
      const drivers = store.profiles.filter(p => p.role === 'DRIVER')
      const activeDrivers = drivers.filter(p => p.is_active)
      const overdueAssignments = store.assignments.filter(a => a.status === 'overdue')
      const now = new Date()
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const expiringDocs = store.documents.filter(d => {
        const exp = new Date(d.expiration_date)
        return exp > now && exp <= thirtyDays
      })
      const expiredDocs = store.documents.filter(d => new Date(d.expiration_date) <= now)
      const issueCount = store.complianceRecords.filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON').length
      const complianceRate = drivers.length > 0
        ? Math.round(((drivers.length - (issueCount > 0 ? expiredDocs.length : 0)) / Math.max(drivers.length, 1)) * 100)
        : 100

      set(s => ({
        dashboardStats: {
          totalDrivers: drivers.length,
          activeDrivers: activeDrivers.length,
          totalVehicles: store.vehicles.filter(v => v.is_active).length,
          complianceRate: Math.min(complianceRate, 100),
          overdueAssignments: overdueAssignments.length,
          completedTrainings: store.completionRecords.length,
          expiringDocuments: expiringDocs.length + expiredDocs.length,
          upcomingExpirations: expiringDocs.slice(0, 5),
        },
        loading: { ...s.loading, dashboard: false },
      }))
      return
    }

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
    if (!isDemoMode()) {
      await supabase.from('notifications').update({ is_read: true } as never).eq('id', id)
    }
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
    }))
  },

  addProfile: (profile) => {
    const newProfile: Profile = {
      ...profile,
      id: genId('user'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    set(s => ({ profiles: [...s.profiles, newProfile] }))
  },

  updateProfile: (id, updates) => {
    set(s => ({
      profiles: s.profiles.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p),
    }))
  },

  deleteProfile: (id) => {
    set(s => ({ profiles: s.profiles.filter(p => p.id !== id) }))
  },

  addVehicle: (vehicle) => {
    const store = get()
    const assignedDriver = vehicle.assigned_driver_id
      ? store.profiles.find(p => p.id === vehicle.assigned_driver_id)
      : undefined
    const newVehicle: Vehicle = {
      ...vehicle,
      id: genId('veh'),
      created_at: new Date().toISOString(),
      profiles: assignedDriver,
    }
    set(s => ({ vehicles: [...s.vehicles, newVehicle] }))
  },

  updateVehicle: (id, updates) => {
    const store = get()
    set(s => ({
      vehicles: s.vehicles.map(v => {
        if (v.id !== id) return v
        const updated = { ...v, ...updates }
        if (updates.assigned_driver_id !== undefined) {
          updated.profiles = updates.assigned_driver_id
            ? store.profiles.find(p => p.id === updates.assigned_driver_id)
            : undefined
        }
        return updated
      }),
    }))
  },

  deleteVehicle: (id) => {
    set(s => ({ vehicles: s.vehicles.filter(v => v.id !== id) }))
  },

  updateFleet: (updates) => {
    set(s => ({
      fleet: s.fleet ? { ...s.fleet, ...updates, updated_at: new Date().toISOString() } : null,
    }))
  },

  addComplianceRecord: (record) => {
    const store = get()
    const newRecord: DriverCompliance = {
      ...record,
      id: genId('comp'),
      created_at: new Date().toISOString(),
      profiles: store.profiles.find(p => p.id === record.user_id),
      compliance_requirements: store.complianceRequirements.find(r => r.id === record.requirement_id),
    }
    set(s => ({ complianceRecords: [...s.complianceRecords, newRecord] }))
  },

  updateComplianceRecord: (id, updates) => {
    set(s => ({
      complianceRecords: s.complianceRecords.map(r => r.id === id ? { ...r, ...updates } : r),
    }))
  },

  addDocument: (doc) => {
    const store = get()
    const newDoc: DriverDocument = {
      ...doc,
      id: genId('doc'),
      created_at: new Date().toISOString(),
      profiles: store.profiles.find(p => p.id === doc.user_id),
    }
    set(s => ({ documents: [...s.documents, newDoc] }))
  },

  updateDocument: (id, updates) => {
    set(s => ({
      documents: s.documents.map(d => d.id === id ? { ...d, ...updates } : d),
    }))
  },

  addTrainingProgram: (program) => {
    const newProgram: TrainingProgram = {
      ...program,
      id: genId('tp'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    set(s => ({ trainingPrograms: [...s.trainingPrograms, newProgram] }))
  },

  updateTrainingProgram: (id, updates) => {
    set(s => ({
      trainingPrograms: s.trainingPrograms.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p),
    }))
  },

  addAssignment: (assignment) => {
    const store = get()
    const newAssignment: Assignment = {
      ...assignment,
      id: genId('asgn'),
      created_at: new Date().toISOString(),
      profiles: store.profiles.find(p => p.id === assignment.user_id),
      training_programs: assignment.training_program_id
        ? store.trainingPrograms.find(t => t.id === assignment.training_program_id)
        : undefined,
    }
    set(s => ({ assignments: [...s.assignments, newAssignment] }))
  },

  updateAssignment: (id, updates) => {
    set(s => ({
      assignments: s.assignments.map(a => a.id === id ? { ...a, ...updates } : a),
    }))
  },
}))
