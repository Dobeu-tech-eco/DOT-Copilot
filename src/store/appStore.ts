import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import * as vehiclesSvc from '../services/vehicles.service'
import * as trainingsSvc from '../services/training.service'
import * as complianceSvc from '../services/compliance.service'
import * as profilesSvc from '../services/profiles.service'
import * as notificationsSvc from '../services/notifications.service'
import * as modulesSvc from '../services/modules.service'
import type {
  Profile, Fleet, TrainingProgram, Assignment,
  DriverCompliance, DriverDocument, Vehicle, Notification,
  CompletionRecord, DriverStats, ComplianceRequirement,
  Module, Lesson,
} from '../types/database'
import type { VehicleFormData } from '../schemas/vehicle.schema'
import type { TrainingProgramFormData, AssignmentFormData } from '../schemas/training.schema'
import type { DriverDocumentFormData, ComplianceRecordFormData, ComplianceRequirementFormData } from '../schemas/compliance.schema'
import type { ProfileFormData, CreateUserFormData } from '../schemas/profile.schema'
import type { ModuleFormData, LessonFormData } from '../schemas/module.schema'

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
  modules: Module[]
  lessons: Record<string, Lesson[]>
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
  fetchModules: (programId: string) => Promise<void>
  fetchLessons: (moduleId: string) => Promise<void>

  createVehicle: (fleetId: string, data: VehicleFormData) => Promise<void>
  updateVehicle: (id: string, data: Partial<VehicleFormData>) => Promise<void>
  deleteVehicle: (id: string) => Promise<void>

  createTrainingProgram: (fleetId: string, data: TrainingProgramFormData) => Promise<void>
  updateTrainingProgram: (id: string, data: Partial<TrainingProgramFormData>) => Promise<void>
  deleteTrainingProgram: (id: string) => Promise<void>
  createAssignment: (fleetId: string, assignedBy: string, data: AssignmentFormData) => Promise<void>
  deleteAssignment: (id: string) => Promise<void>

  updateComplianceRecord: (id: string, data: ComplianceRecordFormData) => Promise<void>
  createDocument: (fleetId: string, data: DriverDocumentFormData) => Promise<void>
  updateDocument: (id: string, data: Partial<DriverDocumentFormData>) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  createRequirement: (fleetId: string, data: ComplianceRequirementFormData) => Promise<void>
  updateRequirement: (id: string, data: Partial<ComplianceRequirementFormData>) => Promise<void>

  createModule: (fleetId: string, programId: string, data: ModuleFormData) => Promise<void>
  updateModule: (id: string, data: Partial<ModuleFormData>) => Promise<void>
  deleteModule: (id: string) => Promise<void>
  createLesson: (fleetId: string, moduleId: string, data: LessonFormData) => Promise<void>
  updateLesson: (id: string, moduleId: string, data: Partial<LessonFormData>) => Promise<void>
  deleteLesson: (id: string, moduleId: string) => Promise<void>

  updateProfile: (id: string, data: Partial<ProfileFormData>) => Promise<void>
  updateNotificationPreferences: (id: string, prefs: { prefer_email?: boolean; prefer_sms?: boolean; prefer_push?: boolean }) => Promise<void>
  updateFleetNotificationSettings: (id: string, settings: { enable_sms_notifications?: boolean; enable_push_notifications?: boolean }) => Promise<void>
  toggleUserActive: (id: string, isActive: boolean) => Promise<void>
  createUser: (fleetId: string, data: CreateUserFormData) => Promise<void>

  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: (userId: string) => Promise<void>
  deleteNotification: (id: string) => Promise<void>
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
  modules: [],
  lessons: {},
  dashboardStats: null,
  loading: {},

  fetchFleet: async (fleetId) => {
    set(s => ({ loading: { ...s.loading, fleet: true } }))
    const { data } = await supabase.from('fleets').select('*').eq('id', fleetId).maybeSingle()
    set(s => ({ fleet: data, loading: { ...s.loading, fleet: false } }))
  },

  fetchProfiles: async (fleetId) => {
    set(s => ({ loading: { ...s.loading, profiles: true } }))
    const data = await profilesSvc.getProfiles(fleetId)
    set(s => ({ profiles: data ?? [], loading: { ...s.loading, profiles: false } }))
  },

  fetchTrainingPrograms: async (fleetId) => {
    set(s => ({ loading: { ...s.loading, trainingPrograms: true } }))
    const data = await trainingsSvc.getTrainingPrograms(fleetId)
    set(s => ({ trainingPrograms: data ?? [], loading: { ...s.loading, trainingPrograms: false } }))
  },

  fetchAssignments: async (fleetId) => {
    set(s => ({ loading: { ...s.loading, assignments: true } }))
    const data = await trainingsSvc.getAssignments(fleetId)
    set(s => ({ assignments: (data ?? []) as Assignment[], loading: { ...s.loading, assignments: false } }))
  },

  fetchComplianceRecords: async (fleetId) => {
    set(s => ({ loading: { ...s.loading, compliance: true } }))
    const data = await complianceSvc.getComplianceRecords(fleetId)
    set(s => ({ complianceRecords: (data ?? []) as DriverCompliance[], loading: { ...s.loading, compliance: false } }))
  },

  fetchDocuments: async (fleetId) => {
    set(s => ({ loading: { ...s.loading, documents: true } }))
    const data = await complianceSvc.getDocuments(fleetId)
    set(s => ({ documents: (data ?? []) as DriverDocument[], loading: { ...s.loading, documents: false } }))
  },

  fetchVehicles: async (fleetId) => {
    set(s => ({ loading: { ...s.loading, vehicles: true } }))
    const data = await vehiclesSvc.getVehicles(fleetId)
    set(s => ({ vehicles: (data ?? []) as Vehicle[], loading: { ...s.loading, vehicles: false } }))
  },

  fetchNotifications: async (userId) => {
    set(s => ({ loading: { ...s.loading, notifications: true } }))
    const data = await notificationsSvc.getNotifications(userId)
    set(s => ({ notifications: data ?? [], loading: { ...s.loading, notifications: false } }))
  },

  fetchComplianceRequirements: async (fleetId) => {
    const data = await complianceSvc.getComplianceRequirements(fleetId)
    set({ complianceRequirements: data ?? [] })
  },

  fetchModules: async (programId) => {
    set(s => ({ loading: { ...s.loading, modules: true } }))
    const data = await modulesSvc.getModules(programId)
    set(s => ({ modules: data as Module[] ?? [], loading: { ...s.loading, modules: false } }))
  },

  fetchLessons: async (moduleId) => {
    const data = await modulesSvc.getLessons(moduleId)
    set(s => ({ lessons: { ...s.lessons, [moduleId]: data as Lesson[] ?? [] } }))
  },

  fetchDashboardStats: async (fleetId) => {
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
    const thirtyDays = new Date(now.getTime() + 30 * 86400000)
    const expiringDocs = docs.filter(d => { const exp = new Date(d.expiration_date); return exp > now && exp <= thirtyDays })
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

  createVehicle: async (fleetId, data) => {
    const v = await vehiclesSvc.createVehicle(fleetId, data)
    set(s => ({ vehicles: [...s.vehicles, v as Vehicle] }))
  },
  updateVehicle: async (id, data) => {
    const v = await vehiclesSvc.updateVehicle(id, data)
    set(s => ({ vehicles: s.vehicles.map(x => x.id === id ? v as Vehicle : x) }))
  },
  deleteVehicle: async (id) => {
    await vehiclesSvc.deleteVehicle(id)
    set(s => ({ vehicles: s.vehicles.filter(x => x.id !== id) }))
  },

  createTrainingProgram: async (fleetId, data) => {
    const p = await trainingsSvc.createTrainingProgram(fleetId, data)
    set(s => ({ trainingPrograms: [...s.trainingPrograms, p as TrainingProgram] }))
  },
  updateTrainingProgram: async (id, data) => {
    const p = await trainingsSvc.updateTrainingProgram(id, data)
    set(s => ({ trainingPrograms: s.trainingPrograms.map(x => x.id === id ? p as TrainingProgram : x) }))
  },
  deleteTrainingProgram: async (id) => {
    await trainingsSvc.deleteTrainingProgram(id)
    set(s => ({ trainingPrograms: s.trainingPrograms.filter(x => x.id !== id) }))
  },
  createAssignment: async (fleetId, assignedBy, data) => {
    const a = await trainingsSvc.createAssignment(fleetId, assignedBy, data)
    set(s => ({ assignments: [a as Assignment, ...s.assignments] }))
  },
  deleteAssignment: async (id) => {
    await trainingsSvc.deleteAssignment(id)
    set(s => ({ assignments: s.assignments.filter(x => x.id !== id) }))
  },

  updateComplianceRecord: async (id, data) => {
    const r = await complianceSvc.updateComplianceRecord(id, data)
    set(s => ({ complianceRecords: s.complianceRecords.map(x => x.id === id ? r as DriverCompliance : x) }))
  },
  createDocument: async (fleetId, data) => {
    const d = await complianceSvc.createDocument(fleetId, data)
    set(s => ({ documents: [...s.documents, d as DriverDocument] }))
  },
  updateDocument: async (id, data) => {
    const d = await complianceSvc.updateDocument(id, data)
    set(s => ({ documents: s.documents.map(x => x.id === id ? d as DriverDocument : x) }))
  },
  deleteDocument: async (id) => {
    await complianceSvc.deleteDocument(id)
    set(s => ({ documents: s.documents.filter(x => x.id !== id) }))
  },
  createRequirement: async (fleetId, data) => {
    const r = await complianceSvc.createRequirement(fleetId, data)
    set(s => ({ complianceRequirements: [...s.complianceRequirements, r as ComplianceRequirement] }))
  },
  updateRequirement: async (id, data) => {
    const r = await complianceSvc.updateRequirement(id, data)
    set(s => ({ complianceRequirements: s.complianceRequirements.map(x => x.id === id ? r as ComplianceRequirement : x) }))
  },

  createModule: async (fleetId, programId, data) => {
    const m = await modulesSvc.createModule(fleetId, programId, data)
    set(s => ({ modules: [...s.modules, m as Module] }))
  },
  updateModule: async (id, data) => {
    const m = await modulesSvc.updateModule(id, data)
    set(s => ({ modules: s.modules.map(x => x.id === id ? m as Module : x) }))
  },
  deleteModule: async (id) => {
    await modulesSvc.deleteModule(id)
    set(s => ({
      modules: s.modules.filter(x => x.id !== id),
      lessons: Object.fromEntries(Object.entries(s.lessons).filter(([k]) => k !== id)),
    }))
  },
  createLesson: async (fleetId, moduleId, data) => {
    const l = await modulesSvc.createLesson(fleetId, moduleId, data)
    set(s => ({ lessons: { ...s.lessons, [moduleId]: [...(s.lessons[moduleId] ?? []), l as Lesson] } }))
  },
  updateLesson: async (id, moduleId, data) => {
    const l = await modulesSvc.updateLesson(id, data)
    set(s => ({
      lessons: {
        ...s.lessons,
        [moduleId]: (s.lessons[moduleId] ?? []).map(x => x.id === id ? l as Lesson : x),
      },
    }))
  },
  deleteLesson: async (id, moduleId) => {
    await modulesSvc.deleteLesson(id)
    set(s => ({
      lessons: { ...s.lessons, [moduleId]: (s.lessons[moduleId] ?? []).filter(x => x.id !== id) },
    }))
  },

  updateProfile: async (id, data) => {
    const p = await profilesSvc.updateProfile(id, data)
    set(s => ({ profiles: s.profiles.map(x => x.id === id ? p as Profile : x) }))
  },
  updateNotificationPreferences: async (id, prefs) => {
    const p = await profilesSvc.updateProfile(id, prefs as never)
    set(s => ({ profiles: s.profiles.map(x => x.id === id ? p as Profile : x) }))
  },
  updateFleetNotificationSettings: async (id, settings) => {
    const { data, error } = await supabase
      .from('fleets')
      .update(settings as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    set({ fleet: data as Fleet })
  },
  toggleUserActive: async (id, isActive) => {
    const p = await profilesSvc.toggleUserActive(id, isActive)
    set(s => ({ profiles: s.profiles.map(x => x.id === id ? p as Profile : x) }))
  },
  createUser: async (fleetId, data) => {
    await profilesSvc.createUserViaEdge(fleetId, data)
  },

  markNotificationRead: async (id) => {
    await notificationsSvc.markAsRead(id)
    set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n) }))
  },
  markAllNotificationsRead: async (userId) => {
    await notificationsSvc.markAllAsRead(userId)
    set(s => ({ notifications: s.notifications.map(n => ({ ...n, is_read: true })) }))
  },
  deleteNotification: async (id) => {
    await notificationsSvc.deleteNotification(id)
    set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }))
  },
}))
