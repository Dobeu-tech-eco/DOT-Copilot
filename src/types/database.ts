export type UserRole = 'DRIVER' | 'DRIVER_COACH' | 'SUPERVISOR' | 'BRANCH_MANAGER' | 'ADMIN'
export type ComplianceStatus = 'COMPLIANT' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'WAIVED'
export type DocumentType = 'CDL' | 'MEDICAL_CARD' | 'HAZMAT_ENDORSEMENT' | 'TWIC_CARD' | 'PASSPORT' | 'MVR' | 'DRUG_TEST' | 'BACKGROUND_CHECK' | 'STATE_PERMIT' | 'FOOD_HANDLER_CERT' | 'REFRIGERATED_TRANSPORT_QUAL' | 'OTHER'
export type VehicleType = 'refrigerated_truck' | 'delivery_van' | 'dry_goods_truck' | 'box_truck' | 'other'
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'
export type AssignmentPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ContentType = 'VIDEO' | 'PDF' | 'POWERPOINT' | 'SCORM' | 'TEXT' | 'IMAGE' | 'QUICK_ACKNOWLEDGE'

export interface Profile {
  id: string
  email: string
  name: string | null
  role: UserRole
  fleet_id: string | null
  location_id: string | null
  phone: string | null
  preferred_language: string
  timezone: string
  prefer_email: boolean
  prefer_sms: boolean
  prefer_push: boolean
  employee_id: string | null
  hire_date: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Fleet {
  id: string
  company_name: string
  locations: string | null
  cargo_type: string | null
  cdl_status: string | null
  vehicle_types: string | null
  key_risk_areas: string | null
  operation_type: string | null
  states_of_operation: string | null
  onboarding_completed: boolean
  compliance_profile_configured: boolean
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  default_language: string
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  fleet_id: string
  is_active: boolean
  created_at: string
}

export interface TrainingProgram {
  id: string
  program_name: string
  description: string | null
  is_recommended: boolean
  fleet_id: string
  is_template: boolean
  template_category: string | null
  estimated_duration: number | null
  compliance_requirement_id: string | null
  created_at: string
  updated_at: string
}

export interface Module {
  id: string
  module_name: string
  description: string | null
  sequence_order: number
  fleet_id: string
  training_program_id: string
  estimated_duration: number | null
  passing_score: number
  created_at: string
}

export interface Lesson {
  id: string
  lesson_name: string
  content: string | null
  content_type: ContentType
  file_url: string | null
  sequence_order: number
  requires_esignature: boolean
  fleet_id: string
  module_id: string
  estimated_duration: number | null
  created_at: string
}

export interface Assignment {
  id: string
  status: AssignmentStatus
  due_date: string | null
  assigned_date: string
  user_id: string
  fleet_id: string
  module_id: string | null
  training_program_id: string | null
  assigned_by: string | null
  priority: AssignmentPriority
  reminders_sent: number
  created_at: string
  profiles?: Profile
  training_programs?: TrainingProgram
  modules?: Module
}

export interface CompletionRecord {
  id: string
  completed_date: string
  quiz_score: number | null
  user_id: string
  fleet_id: string
  lesson_id: string | null
  module_id: string | null
  assignment_id: string | null
  time_spent: number | null
  attempts: number
  passed: boolean
  created_at: string
}

export interface ComplianceRequirement {
  id: string
  name: string
  description: string | null
  regulatory_body: string
  required_hours: number | null
  renewal_period: number | null
  applies_to: string[]
  is_active: boolean
  fleet_id: string | null
  alert_days: number[]
  created_at: string
}

export interface DriverCompliance {
  id: string
  user_id: string
  requirement_id: string
  status: ComplianceStatus
  completed_date: string | null
  expiration_date: string | null
  hours_completed: number | null
  certificate_url: string | null
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
  compliance_requirements?: ComplianceRequirement
  profiles?: Profile
}

export interface DriverDocument {
  id: string
  user_id: string
  fleet_id: string
  document_type: DocumentType
  document_number: string | null
  issued_date: string | null
  expiration_date: string
  issuing_state: string | null
  cdl_class: string | null
  endorsements: string[]
  restrictions: string[]
  status: string
  created_at: string
  profiles?: Profile
}

export interface Vehicle {
  id: string
  fleet_id: string
  vehicle_number: string
  vehicle_type: VehicleType
  make: string | null
  model: string | null
  year: number | null
  license_plate: string | null
  has_temperature_monitoring: boolean
  last_inspection_date: string | null
  next_inspection_due: string | null
  assigned_route: string | null
  assigned_driver_id: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  profiles?: Profile
}

export interface Notification {
  id: string
  message: string
  title: string | null
  notification_type: string
  is_read: boolean
  user_id: string
  action_url: string | null
  created_at: string
}

export interface DriverStats {
  id: string
  user_id: string
  total_trainings_completed: number
  total_lessons_completed: number
  total_quizzes_taken: number
  average_quiz_score: number | null
  compliance_score: number | null
  overdue_count: number
  current_streak: number
  longest_streak: number
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string; email: string }; Update: Partial<Profile> }
      fleets: { Row: Fleet; Insert: Partial<Fleet> & { company_name: string }; Update: Partial<Fleet> }
      locations: { Row: Location; Insert: Partial<Location> & { name: string; fleet_id: string }; Update: Partial<Location> }
      training_programs: { Row: TrainingProgram; Insert: Partial<TrainingProgram> & { program_name: string; fleet_id: string }; Update: Partial<TrainingProgram> }
      modules: { Row: Module; Insert: Partial<Module> & { module_name: string; fleet_id: string; training_program_id: string }; Update: Partial<Module> }
      lessons: { Row: Lesson; Insert: Partial<Lesson> & { lesson_name: string; fleet_id: string; module_id: string }; Update: Partial<Lesson> }
      assignments: { Row: Assignment; Insert: Partial<Assignment> & { user_id: string; fleet_id: string }; Update: Partial<Assignment> }
      completion_records: { Row: CompletionRecord; Insert: Partial<CompletionRecord> & { user_id: string; fleet_id: string }; Update: Partial<CompletionRecord> }
      compliance_requirements: { Row: ComplianceRequirement; Insert: Partial<ComplianceRequirement> & { name: string; regulatory_body: string }; Update: Partial<ComplianceRequirement> }
      driver_compliance: { Row: DriverCompliance; Insert: Partial<DriverCompliance> & { user_id: string; requirement_id: string }; Update: Partial<DriverCompliance> }
      driver_documents: { Row: DriverDocument; Insert: Partial<DriverDocument> & { user_id: string; fleet_id: string; document_type: DocumentType; expiration_date: string }; Update: Partial<DriverDocument> }
      vehicles: { Row: Vehicle; Insert: Partial<Vehicle> & { fleet_id: string; vehicle_number: string; vehicle_type: VehicleType }; Update: Partial<Vehicle> }
      notifications: { Row: Notification; Insert: Partial<Notification> & { message: string; notification_type: string; user_id: string }; Update: Partial<Notification> }
      driver_stats: { Row: DriverStats; Insert: Partial<DriverStats> & { user_id: string }; Update: Partial<DriverStats> }
    }
  }
}
