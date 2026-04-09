import { create } from 'zustand'
import { api } from '../lib/api'
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

  addProfile: (profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateProfile: (id: string, updates: Partial<Profile>) => Promise<void>
  deleteProfile: (id: string) => Promise<void>

  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'created_at'>) => Promise<void>
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>
  deleteVehicle: (id: string) => Promise<void>

  updateFleet: (updates: Partial<Fleet>) => Promise<void>

  addComplianceRecord: (record: Omit<DriverCompliance, 'id' | 'created_at'>) => Promise<void>
  updateComplianceRecord: (id: string, updates: Partial<DriverCompliance>) => Promise<void>

  addDocument: (doc: Omit<DriverDocument, 'id' | 'created_at'>) => Promise<void>
  updateDocument: (id: string, updates: Partial<DriverDocument>) => Promise<void>

  addTrainingProgram: (program: Omit<TrainingProgram, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateTrainingProgram: (id: string, updates: Partial<TrainingProgram>) => Promise<void>

  addAssignment: (assignment: Omit<Assignment, 'id' | 'created_at'>) => Promise<void>
  updateAssignment: (id: string, updates: Partial<Assignment>) => Promise<void>
}

function snakeToCamelProfile(u: any): Profile {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    fleet_id: u.fleet_id ?? u.fleetId ?? null,
    location_id: u.location_id ?? u.locationId ?? null,
    phone: u.phone ?? null,
    preferred_language: u.preferred_language ?? u.preferredLanguage ?? 'en',
    timezone: u.timezone ?? 'America/New_York',
    prefer_email: u.prefer_email ?? u.preferEmail ?? true,
    prefer_sms: u.prefer_sms ?? u.preferSms ?? false,
    prefer_push: u.prefer_push ?? u.preferPush ?? true,
    employee_id: u.employee_id ?? u.employeeId ?? null,
    hire_date: u.hire_date ?? u.hireDate ?? null,
    is_active: u.is_active ?? u.isActive ?? true,
    last_login_at: u.last_login_at ?? u.lastLoginAt ?? null,
    created_at: u.created_at ?? u.createdAt ?? '',
    updated_at: u.updated_at ?? u.updatedAt ?? '',
  }
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
    try {
      const res = await api.get<{ data: any }>(`/fleets/${fleetId}`)
      const f = res.data
      const fleet: Fleet = {
        id: f.id,
        company_name: f.company_name ?? f.companyName ?? '',
        locations: f.locations ?? null,
        cargo_type: f.cargo_type ?? f.cargoType ?? null,
        cdl_status: f.cdl_status ?? f.cdlStatus ?? null,
        vehicle_types: f.vehicle_types ?? f.vehicleTypes ?? null,
        key_risk_areas: f.key_risk_areas ?? f.keyRiskAreas ?? null,
        operation_type: f.operation_type ?? f.operationType ?? null,
        states_of_operation: f.states_of_operation ?? f.statesOfOperation ?? null,
        onboarding_completed: f.onboarding_completed ?? f.onboardingCompleted ?? false,
        compliance_profile_configured: f.compliance_profile_configured ?? f.complianceProfileConfigured ?? false,
        logo_url: f.logo_url ?? f.logoUrl ?? null,
        primary_color: f.primary_color ?? f.primaryColor ?? null,
        secondary_color: f.secondary_color ?? f.secondaryColor ?? null,
        default_language: f.default_language ?? f.defaultLanguage ?? 'en',
        created_at: f.created_at ?? f.createdAt ?? '',
        updated_at: f.updated_at ?? f.updatedAt ?? '',
      }
      set(s => ({ fleet, loading: { ...s.loading, fleet: false } }))
    } catch (e) {
      console.error('fetchFleet error:', e)
      set(s => ({ loading: { ...s.loading, fleet: false } }))
    }
  },

  fetchProfiles: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, profiles: true } }))
    try {
      const res = await api.get<{ data: any[] }>(`/users?page=1&limit=500`)
      const profiles = (res.data || []).map(snakeToCamelProfile)
      set(s => ({ profiles, loading: { ...s.loading, profiles: false } }))
    } catch (e) {
      console.error('fetchProfiles error:', e)
      set(s => ({ loading: { ...s.loading, profiles: false } }))
    }
  },

  fetchTrainingPrograms: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, trainingPrograms: true } }))
    try {
      const res = await api.get<{ data: any[] }>(`/training-programs?page=1&limit=500`)
      const programs = (res.data || []).map((p: any) => ({
        id: p.id,
        program_name: p.program_name ?? p.programName ?? '',
        description: p.description ?? null,
        is_recommended: p.is_recommended ?? p.isRecommended ?? false,
        fleet_id: p.fleet_id ?? p.fleetId ?? '',
        is_template: p.is_template ?? p.isTemplate ?? false,
        template_category: p.template_category ?? p.templateCategory ?? null,
        estimated_duration: p.estimated_duration ?? p.estimatedDuration ?? null,
        compliance_requirement_id: p.compliance_requirement_id ?? p.complianceRequirementId ?? null,
        created_at: p.created_at ?? p.createdAt ?? '',
        updated_at: p.updated_at ?? p.updatedAt ?? '',
      }))
      set(s => ({ trainingPrograms: programs, loading: { ...s.loading, trainingPrograms: false } }))
    } catch (e) {
      console.error('fetchTrainingPrograms error:', e)
      set(s => ({ loading: { ...s.loading, trainingPrograms: false } }))
    }
  },

  fetchAssignments: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, assignments: true } }))
    try {
      const res = await api.get<{ data: any[] }>(`/assignments?page=1&limit=500`)
      const assignments = (res.data || []).map((a: any) => ({
        id: a.id,
        status: a.status,
        due_date: a.due_date ?? a.dueDate ?? null,
        assigned_date: a.assigned_date ?? a.assignedDate ?? '',
        user_id: a.user_id ?? a.userId ?? '',
        fleet_id: a.fleet_id ?? a.fleetId ?? '',
        module_id: a.module_id ?? a.moduleId ?? null,
        training_program_id: a.training_program_id ?? a.trainingProgramId ?? null,
        assigned_by: a.assigned_by ?? a.assignedBy ?? null,
        priority: a.priority ?? 'normal',
        created_at: a.created_at ?? a.createdAt ?? '',
        profiles: a.user ? snakeToCamelProfile(a.user) : undefined,
        training_programs: a.trainingProgram ? {
          id: a.trainingProgram.id,
          program_name: a.trainingProgram.programName ?? a.trainingProgram.program_name ?? '',
        } : undefined,
      }))
      set(s => ({ assignments, loading: { ...s.loading, assignments: false } }))
    } catch (e) {
      console.error('fetchAssignments error:', e)
      set(s => ({ loading: { ...s.loading, assignments: false } }))
    }
  },

  fetchComplianceRecords: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, compliance: true } }))
    try {
      const res = await api.get<{ data: any[] }>(`/compliance/drivers`)
      set(s => ({ complianceRecords: res.data || [], loading: { ...s.loading, compliance: false } }))
    } catch (e) {
      console.error('fetchComplianceRecords error:', e)
      set(s => ({ loading: { ...s.loading, compliance: false } }))
    }
  },

  fetchDocuments: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, documents: true } }))
    try {
      const res = await api.get<{ data: any[] }>(`/documents`)
      const docs = (res.data || []).map((d: any) => ({
        id: d.id,
        document_type: d.document_type ?? d.documentType ?? '',
        document_number: d.document_number ?? d.documentNumber ?? null,
        issued_date: d.issued_date ?? d.issuedDate ?? null,
        expiration_date: d.expiration_date ?? d.expirationDate ?? '',
        issuing_state: d.issuing_state ?? d.issuingState ?? null,
        status: d.status ?? 'valid',
        user_id: d.user_id ?? d.userId ?? '',
        fleet_id: d.fleet_id ?? d.fleetId ?? '',
        created_at: d.created_at ?? d.createdAt ?? '',
        profiles: d.user ? snakeToCamelProfile(d.user) : undefined,
      }))
      set(s => ({ documents: docs, loading: { ...s.loading, documents: false } }))
    } catch (e) {
      console.error('fetchDocuments error:', e)
      set(s => ({ loading: { ...s.loading, documents: false } }))
    }
  },

  fetchVehicles: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, vehicles: true } }))
    // API endpoint not yet implemented
    set(s => ({ vehicles: [], loading: { ...s.loading, vehicles: false } }))
  },

  fetchNotifications: async (userId: string) => {
    set(s => ({ loading: { ...s.loading, notifications: true } }))
    try {
      const res = await api.get<{ data: any[] }>(`/notifications?page=1&limit=50`)
      const notifs = (res.data || []).map((n: any) => ({
        id: n.id,
        message: n.message,
        notification_type: n.notification_type ?? n.notificationType ?? '',
        is_read: n.is_read ?? n.isRead ?? false,
        user_id: n.user_id ?? n.userId ?? '',
        fleet_id: n.fleet_id ?? n.fleetId ?? '',
        created_at: n.created_at ?? n.createdAt ?? '',
      }))
      set(s => ({ notifications: notifs, loading: { ...s.loading, notifications: false } }))
    } catch (e) {
      console.error('fetchNotifications error:', e)
      set(s => ({ loading: { ...s.loading, notifications: false } }))
    }
  },

  fetchComplianceRequirements: async (fleetId: string) => {
    try {
      const res = await api.get<{ data: any[] }>(`/compliance/requirements`)
      const reqs = (res.data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        regulatory_body: r.regulatory_body ?? r.regulatoryBody ?? '',
        required_hours: r.required_hours ?? r.requiredHours ?? null,
        renewal_period: r.renewal_period ?? r.renewalPeriod ?? null,
        applies_to: r.applies_to ?? r.appliesTo ?? [],
        is_active: r.is_active ?? r.isActive ?? true,
        fleet_id: r.fleet_id ?? r.fleetId ?? null,
        created_at: r.created_at ?? r.createdAt ?? '',
      }))
      set({ complianceRequirements: reqs })
    } catch (e) {
      console.error('fetchComplianceRequirements error:', e)
    }
  },

  fetchDashboardStats: async (fleetId: string) => {
    set(s => ({ loading: { ...s.loading, dashboard: true } }))
    const store = get()

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

    set(s => ({
      dashboardStats: {
        totalDrivers: drivers.length,
        activeDrivers: activeDrivers.length,
        totalVehicles: store.vehicles.length,
        complianceRate: drivers.length > 0 ? 100 : 100, // TODO: calculate based on data
        overdueAssignments: overdueAssignments.length,
        completedTrainings: store.completionRecords.length,
        expiringDocuments: expiringDocs.length + expiredDocs.length,
        upcomingExpirations: expiringDocs.slice(0, 5),
      },
      loading: { ...s.loading, dashboard: false },
    }))
  },

  markNotificationRead: async (id: string) => {
    try {
      await api.put(`/notifications/${id}`, { isRead: true })
      set(s => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
      }))
    } catch (e) {
      console.error('markNotificationRead error:', e)
    }
  },

  addProfile: async (profile) => {
    try {
      const res = await api.post('/users', {
        email: profile.email,
        password: 'TempPass123!',
        name: profile.name,
        role: profile.role,
        fleetId: profile.fleet_id,
      })
      const u = res.data
      const newProfile = snakeToCamelProfile(u)
      set(s => ({ profiles: [...s.profiles, newProfile] }))
    } catch (e) {
      console.error('addProfile error:', e)
    }
  },

  updateProfile: async (id, updates) => {
    try {
      await api.put(`/users/${id}`, updates)
      set(s => ({
        profiles: s.profiles.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p),
      }))
    } catch (e) {
      console.error('updateProfile error:', e)
    }
  },

  deleteProfile: async (id) => {
    try {
      await api.delete(`/users/${id}`)
      set(s => ({ profiles: s.profiles.filter(p => p.id !== id) }))
    } catch (e) {
      console.error('deleteProfile error:', e)
    }
  },

  addVehicle: async (vehicle) => {
    // API not yet implemented
    console.warn('addVehicle API not yet implemented')
  },

  updateVehicle: async (id, updates) => {
    // API not yet implemented
    set(s => ({
      vehicles: s.vehicles.map(v => v.id === id ? { ...v, ...updates } : v),
    }))
  },

  deleteVehicle: async (id) => {
    // API not yet implemented
    set(s => ({ vehicles: s.vehicles.filter(v => v.id !== id) }))
  },

  updateFleet: async (updates) => {
    const store = get()
    if (store.fleet) {
      try {
        await api.put(`/fleets/${store.fleet.id}`, updates)
        set(s => ({
          fleet: s.fleet ? { ...s.fleet, ...updates, updated_at: new Date().toISOString() } : null,
        }))
      } catch (e) {
        console.error('updateFleet error:', e)
      }
    }
  },

  addComplianceRecord: async (record) => {
    // API not yet implemented
    console.warn('addComplianceRecord API not yet implemented')
  },

  updateComplianceRecord: async (id, updates) => {
    set(s => ({
      complianceRecords: s.complianceRecords.map(r => r.id === id ? { ...r, ...updates } : r),
    }))
  },

  addDocument: async (doc) => {
    try {
      await api.post('/documents', {
        documentType: doc.document_type,
        documentNumber: doc.document_number,
        expirationDate: new Date(doc.expiration_date).toISOString(),
        issuedDate: doc.issued_date ? new Date(doc.issued_date).toISOString() : undefined,
        issuingState: doc.issuing_state,
        userId: doc.user_id,
      })
      // Refetch documents to get fresh data with IDs
      const store = get()
      if (store.fleet) await store.fetchDocuments(store.fleet.id)
    } catch (e) {
      console.error('addDocument error:', e)
    }
  },

  updateDocument: async (id, updates) => {
    set(s => ({
      documents: s.documents.map(d => d.id === id ? { ...d, ...updates } : d),
    }))
  },

  addTrainingProgram: async (program) => {
    try {
      await api.post('/training-programs', {
        programName: program.program_name,
        description: program.description,
        isRecommended: program.is_recommended,
        fleetId: program.fleet_id,
      })
      // Refetch
      const store = get()
      if (store.fleet) await store.fetchTrainingPrograms(store.fleet.id)
    } catch (e) {
      console.error('addTrainingProgram error:', e)
    }
  },

  updateTrainingProgram: async (id, updates) => {
    set(s => ({
      trainingPrograms: s.trainingPrograms.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p),
    }))
  },

  addAssignment: async (assignment) => {
    try {
      await api.post('/assignments', {
        userId: assignment.user_id,
        fleetId: assignment.fleet_id,
        trainingProgramId: assignment.training_program_id,
        dueDate: assignment.due_date,
        priority: assignment.priority,
      })
      // Refetch
      const store = get()
      if (store.fleet) await store.fetchAssignments(store.fleet.id)
    } catch (e) {
      console.error('addAssignment error:', e)
    }
  },

  updateAssignment: async (id, updates) => {
    set(s => ({
      assignments: s.assignments.map(a => a.id === id ? { ...a, ...updates } : a),
    }))
  },
}))
