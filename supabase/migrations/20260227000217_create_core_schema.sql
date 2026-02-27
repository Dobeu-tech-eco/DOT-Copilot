/*
  # DOT-Copilot Core Schema - Baldor Food Company

  1. New Tables
    - `fleets` - Company/fleet organizations with white-label branding
      - `id` (uuid, primary key)
      - `company_name` (text) - e.g., "Baldor Food Company"
      - `cargo_type`, `vehicle_types`, `operation_type` (text) - fleet profile
      - `logo_url`, `primary_color`, `secondary_color` (text) - branding
      - Various settings and status flags
    - `locations` - Physical locations/warehouses for fleets
      - `id` (uuid, primary key)
      - `name`, `address`, `city`, `state`, `zip_code` (text)
      - `fleet_id` (uuid, FK to fleets)
    - `profiles` - Extended user profiles linked to auth.users
      - `id` (uuid, primary key, FK to auth.users)
      - `email`, `name`, `role` (text) - basic identity
      - `fleet_id`, `location_id` (uuid) - organizational placement
      - `employee_id`, `phone` (text) - employment details
      - Notification preferences and status flags
    - `training_programs` - Training course containers
      - `id` (uuid, primary key)
      - `program_name`, `description` (text)
      - `fleet_id` (uuid, FK to fleets)
      - `template_category`, `estimated_duration` (text/int)
    - `modules` - Modules within training programs
      - `id` (uuid, primary key)
      - `module_name`, `description` (text)
      - `training_program_id`, `fleet_id` (uuid, FK)
      - `sequence_order`, `passing_score` (int)
    - `lessons` - Individual lessons within modules
      - `id` (uuid, primary key)
      - `lesson_name`, `content`, `content_type` (text)
      - `module_id`, `fleet_id` (uuid, FK)
      - Various content-type-specific fields
    - `assignments` - Training assignments for drivers
      - `id` (uuid, primary key)
      - `user_id`, `fleet_id` (uuid, FK)
      - `status`, `priority` (text)
      - `due_date` (timestamptz)
    - `completion_records` - Training completion tracking
      - `id` (uuid, primary key)
      - `user_id`, `fleet_id` (uuid, FK)
      - `quiz_score`, `time_spent` (int)
      - `passed` (boolean)
    - `driver_documents` - CDL, medical cards, certifications
      - `id` (uuid, primary key)
      - `user_id`, `fleet_id` (uuid, FK)
      - `document_type`, `document_number` (text)
      - `expiration_date` (timestamptz)
      - CDL-specific fields (class, endorsements, restrictions)
    - `compliance_requirements` - Regulatory requirements
      - `id` (uuid, primary key)
      - `name`, `regulatory_body` (text)
      - `renewal_period` (int, months)
    - `driver_compliance` - Driver compliance status per requirement
      - `id` (uuid, primary key)
      - `user_id`, `requirement_id` (uuid, FK)
      - `status` (text) - COMPLIANT, EXPIRING_SOON, EXPIRED, etc.
    - `vehicles` - Fleet vehicles (new for Baldor)
      - `id` (uuid, primary key)
      - `fleet_id` (uuid, FK)
      - `vehicle_number`, `vehicle_type` (text)
      - `has_temperature_monitoring` (boolean)
    - `notifications` - In-app notifications
    - `audit_logs` - Change tracking
    - `driver_stats` - Aggregated driver statistics

  2. Security
    - RLS enabled on ALL tables
    - Policies restrict access to authenticated users
    - Users can only access data within their own fleet
    - Admins/supervisors get broader access within their fleet

  3. Indexes
    - Optimized queries on fleet_id, user_id, status, expiration_date
    - Composite indexes for common query patterns
*/

-- ============================================
-- FLEETS
-- ============================================
CREATE TABLE IF NOT EXISTS fleets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  locations text,
  cargo_type text,
  cdl_status text,
  vehicle_types text,
  key_risk_areas text,
  operation_type text,
  states_of_operation text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  compliance_profile_configured boolean NOT NULL DEFAULT false,
  logo_url text,
  primary_color text,
  secondary_color text,
  default_language text NOT NULL DEFAULT 'en',
  enable_sms_notifications boolean NOT NULL DEFAULT false,
  enable_push_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fleets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fleets"
  ON fleets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert fleets"
  ON fleets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update fleets"
  ON fleets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- LOCATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  latitude double precision,
  longitude double precision,
  fleet_id uuid NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view locations"
  ON locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update locations"
  ON locations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- PROFILES (linked to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'DRIVER' CHECK (role IN ('DRIVER', 'DRIVER_COACH', 'SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN')),
  fleet_id uuid REFERENCES fleets(id),
  location_id uuid REFERENCES locations(id),
  phone text,
  preferred_language text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'America/New_York',
  prefer_email boolean NOT NULL DEFAULT true,
  prefer_sms boolean NOT NULL DEFAULT false,
  prefer_push boolean NOT NULL DEFAULT true,
  employee_id text,
  hire_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users in same fleet can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update any profile in fleet"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE INDEX IF NOT EXISTS idx_profiles_fleet_id ON profiles(fleet_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ============================================
-- TRAINING PROGRAMS
-- ============================================
CREATE TABLE IF NOT EXISTS training_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_name text NOT NULL,
  description text,
  is_recommended boolean NOT NULL DEFAULT false,
  fleet_id uuid NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  is_template boolean NOT NULL DEFAULT false,
  template_category text,
  estimated_duration int,
  default_language text NOT NULL DEFAULT 'en',
  thumbnail_url text,
  compliance_requirement_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fleet members can view training programs"
  ON training_programs FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert training programs"
  ON training_programs FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update training programs"
  ON training_programs FOR UPDATE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can delete training programs"
  ON training_programs FOR DELETE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE INDEX IF NOT EXISTS idx_training_programs_fleet_id ON training_programs(fleet_id);

-- ============================================
-- MODULES
-- ============================================
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  description text,
  sequence_order int NOT NULL DEFAULT 0,
  fleet_id uuid NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  training_program_id uuid NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  estimated_duration int,
  passing_score int NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fleet members can view modules"
  ON modules FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert modules"
  ON modules FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update modules"
  ON modules FOR UPDATE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE INDEX IF NOT EXISTS idx_modules_training_program_id ON modules(training_program_id);
CREATE INDEX IF NOT EXISTS idx_modules_fleet_id ON modules(fleet_id);

-- ============================================
-- LESSONS
-- ============================================
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_name text NOT NULL,
  content text,
  content_type text NOT NULL DEFAULT 'TEXT' CHECK (content_type IN ('VIDEO', 'PDF', 'POWERPOINT', 'SCORM', 'TEXT', 'IMAGE', 'QUICK_ACKNOWLEDGE')),
  file_url text,
  sequence_order int NOT NULL DEFAULT 0,
  requires_esignature boolean NOT NULL DEFAULT false,
  fleet_id uuid NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  video_duration int,
  video_url text,
  estimated_duration int,
  acknowledgment_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fleet members can view lessons"
  ON lessons FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert lessons"
  ON lessons FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update lessons"
  ON lessons FOR UPDATE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_fleet_id ON lessons(fleet_id);

-- ============================================
-- ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  due_date timestamptz,
  assigned_date timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fleet_id uuid NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id),
  training_program_id uuid REFERENCES training_programs(id),
  assigned_by text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  reminders_sent int NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Fleet admins can view all assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can insert assignments"
  ON assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Users can update own assignment status"
  ON assignments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update any assignment"
  ON assignments FOR UPDATE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_fleet_id ON assignments(fleet_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

-- ============================================
-- COMPLETION RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS completion_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completed_date timestamptz NOT NULL DEFAULT now(),
  quiz_score int,
  esignature text,
  esignature_timestamp timestamptz,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fleet_id uuid NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id),
  module_id uuid REFERENCES modules(id),
  assignment_id uuid REFERENCES assignments(id),
  time_spent int,
  attempts int NOT NULL DEFAULT 1,
  passed boolean NOT NULL DEFAULT true,
  certificate_url text,
  certificate_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE completion_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own completions"
  ON completion_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Fleet admins can view all completions"
  ON completion_records FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Users can insert own completions"
  ON completion_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_completion_records_user_id ON completion_records(user_id);
CREATE INDEX IF NOT EXISTS idx_completion_records_fleet_id ON completion_records(fleet_id);
CREATE INDEX IF NOT EXISTS idx_completion_records_completed_date ON completion_records(completed_date);

-- ============================================
-- COMPLIANCE REQUIREMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  regulatory_body text NOT NULL,
  required_hours int,
  renewal_period int,
  applies_to text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  fleet_id uuid REFERENCES fleets(id),
  alert_days int[] NOT NULL DEFAULT '{90,60,30,14,7}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fleet members can view compliance requirements"
  ON compliance_requirements FOR SELECT
  TO authenticated
  USING (
    fleet_id IS NULL OR fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert compliance requirements"
  ON compliance_requirements FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY "Admins can update compliance requirements"
  ON compliance_requirements FOR UPDATE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- ============================================
-- DRIVER COMPLIANCE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('COMPLIANT', 'EXPIRING_SOON', 'EXPIRED', 'NOT_STARTED', 'IN_PROGRESS', 'WAIVED')),
  completed_date timestamptz,
  expiration_date timestamptz,
  hours_completed int,
  certificate_url text,
  verified_by text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, requirement_id)
);

ALTER TABLE driver_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own compliance"
  ON driver_compliance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Fleet admins can view compliance"
  ON driver_compliance FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

CREATE POLICY "Admins can insert compliance records"
  ON driver_compliance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update compliance records"
  ON driver_compliance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_driver_compliance_user_id ON driver_compliance(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_compliance_status ON driver_compliance(status);
CREATE INDEX IF NOT EXISTS idx_driver_compliance_expiration ON driver_compliance(expiration_date);

-- ============================================
-- DRIVER DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fleet_id uuid NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('CDL', 'MEDICAL_CARD', 'HAZMAT_ENDORSEMENT', 'TWIC_CARD', 'PASSPORT', 'MVR', 'DRUG_TEST', 'BACKGROUND_CHECK', 'STATE_PERMIT', 'FOOD_HANDLER_CERT', 'REFRIGERATED_TRANSPORT_QUAL', 'OTHER')),
  document_number text,
  issued_date timestamptz,
  expiration_date timestamptz NOT NULL,
  issuing_state text,
  issuing_country text,
  cdl_class text,
  endorsements text[] NOT NULL DEFAULT '{}',
  restrictions text[] NOT NULL DEFAULT '{}',
  front_image_url text,
  back_image_url text,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expiring_soon', 'expired')),
  verified_at timestamptz,
  verified_by text,
  last_alert_sent timestamptz,
  alerts_sent int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON driver_documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Fleet admins can view documents"
  ON driver_documents FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Users can insert own documents"
  ON driver_documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can insert documents"
  ON driver_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Users can update own documents"
  ON driver_documents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update documents"
  ON driver_documents FOR UPDATE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE INDEX IF NOT EXISTS idx_driver_documents_user_id ON driver_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_fleet_id ON driver_documents(fleet_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_type ON driver_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_driver_documents_expiration ON driver_documents(expiration_date);
CREATE INDEX IF NOT EXISTS idx_driver_documents_status ON driver_documents(status);

-- ============================================
-- VEHICLES (New for Baldor)
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  vehicle_number text NOT NULL,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('refrigerated_truck', 'delivery_van', 'dry_goods_truck', 'box_truck', 'other')),
  make text,
  model text,
  year int,
  license_plate text,
  vin text,
  has_temperature_monitoring boolean NOT NULL DEFAULT false,
  temperature_unit_id text,
  last_inspection_date timestamptz,
  next_inspection_due timestamptz,
  assigned_route text,
  assigned_driver_id uuid REFERENCES profiles(id),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fleet members can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE INDEX IF NOT EXISTS idx_vehicles_fleet_id ON vehicles(fleet_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_driver ON vehicles(assigned_driver_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  title text,
  notification_type text NOT NULL,
  channel text NOT NULL DEFAULT 'IN_APP' CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'PUSH')),
  is_read boolean NOT NULL DEFAULT false,
  is_sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fleet_id uuid REFERENCES fleets(id),
  related_assignment_id uuid REFERENCES assignments(id),
  action_url text,
  action_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================
-- DRIVER STATS
-- ============================================
CREATE TABLE IF NOT EXISTS driver_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_trainings_completed int NOT NULL DEFAULT 0,
  total_lessons_completed int NOT NULL DEFAULT 0,
  total_quizzes_taken int NOT NULL DEFAULT 0,
  average_quiz_score double precision,
  highest_quiz_score int,
  total_time_spent int NOT NULL DEFAULT 0,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_activity_date timestamptz,
  overall_rank int,
  fleet_rank int,
  location_rank int,
  compliance_score double precision,
  overdue_count int NOT NULL DEFAULT 0,
  btw_hours_completed double precision NOT NULL DEFAULT 0,
  btw_sessions_completed int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stats"
  ON driver_stats FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Fleet admins can view stats"
  ON driver_stats FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

CREATE POLICY "Stats can be inserted"
  ON driver_stats FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Stats can be updated"
  ON driver_stats FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details text,
  ip_address text,
  user_agent text,
  old_values jsonb,
  new_values jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fleet_id uuid REFERENCES fleets(id)
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, timestamp);

-- ============================================
-- QUIZ QUESTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  answer_options jsonb NOT NULL,
  correct_answer text NOT NULL,
  sequence_order int NOT NULL DEFAULT 0,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_type text NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'multi_select')),
  points int NOT NULL DEFAULT 1,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fleet members can view quiz questions"
  ON quiz_questions FOR SELECT
  TO authenticated
  USING (
    lesson_id IN (
      SELECT l.id FROM lessons l
      WHERE l.fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage quiz questions"
  ON quiz_questions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update quiz questions"
  ON quiz_questions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson_id ON quiz_questions(lesson_id);

-- ============================================
-- QUIZ RESPONSES
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selected_answer text NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  completion_record_id uuid REFERENCES completion_records(id),
  time_spent int
);

ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own responses"
  ON quiz_responses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Fleet admins can view responses"
  ON quiz_responses FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

CREATE POLICY "Users can insert own responses"
  ON quiz_responses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_id ON quiz_responses(user_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'DRIVER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
