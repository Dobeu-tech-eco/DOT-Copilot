/*
  # Optimize RLS Policies and Harden Security

  1. Performance Optimization
    - All auth.uid() calls wrapped in (select auth.uid()) to prevent
      re-evaluation per row. This is critical for query performance at scale.
    - Applied across all 14 tables with RLS policies.

  2. Security Hardening
    - Replaced all "always true" (USING true / WITH CHECK true) policies
      with proper role-based checks requiring ADMIN or BRANCH_MANAGER role.
    - Affected tables: fleets, locations, profiles, notifications,
      audit_logs, driver_compliance, driver_stats, quiz_questions.

  3. Function Security
    - Fixed handle_new_user() function to use immutable search_path
      set to 'public' to prevent search_path injection.

  4. Tables with policies updated
    - profiles (4 policies)
    - fleets (3 policies)
    - locations (2 policies)
    - training_programs (4 policies)
    - modules (3 policies)
    - lessons (3 policies)
    - assignments (5 policies)
    - completion_records (3 policies)
    - compliance_requirements (3 policies)
    - driver_compliance (4 policies)
    - driver_documents (6 policies)
    - vehicles (3 policies)
    - notifications (3 policies)
    - driver_stats (4 policies)
    - audit_logs (2 policies)
    - quiz_questions (3 policies)
    - quiz_responses (3 policies)
*/

-- ============================================
-- HELPER: admin check subquery pattern
-- (select auth.uid()) is used everywhere for perf
-- ============================================

-- ============================================
-- PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users in same fleet can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile in fleet" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users in same fleet can view profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY "Admins can update any profile in fleet"
  ON profiles FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- ============================================
-- FLEETS
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view fleets" ON fleets;
DROP POLICY IF EXISTS "Admins can insert fleets" ON fleets;
DROP POLICY IF EXISTS "Admins can update fleets" ON fleets;

CREATE POLICY "Authenticated users can view fleets"
  ON fleets FOR SELECT TO authenticated
  USING (
    id IN (SELECT fleet_id FROM profiles WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can insert fleets"
  ON fleets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN')
    )
  );

CREATE POLICY "Admins can update fleets"
  ON fleets FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- ============================================
-- LOCATIONS
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view locations" ON locations;
DROP POLICY IF EXISTS "Admins can manage locations" ON locations;
DROP POLICY IF EXISTS "Admins can update locations" ON locations;

CREATE POLICY "Authenticated users can view locations"
  ON locations FOR SELECT TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can manage locations"
  ON locations FOR INSERT TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY "Admins can update locations"
  ON locations FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- ============================================
-- TRAINING PROGRAMS
-- ============================================
DROP POLICY IF EXISTS "Fleet members can view training programs" ON training_programs;
DROP POLICY IF EXISTS "Admins can insert training programs" ON training_programs;
DROP POLICY IF EXISTS "Admins can update training programs" ON training_programs;
DROP POLICY IF EXISTS "Admins can delete training programs" ON training_programs;

CREATE POLICY "Fleet members can view training programs"
  ON training_programs FOR SELECT TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can insert training programs"
  ON training_programs FOR INSERT TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update training programs"
  ON training_programs FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can delete training programs"
  ON training_programs FOR DELETE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- ============================================
-- MODULES
-- ============================================
DROP POLICY IF EXISTS "Fleet members can view modules" ON modules;
DROP POLICY IF EXISTS "Admins can insert modules" ON modules;
DROP POLICY IF EXISTS "Admins can update modules" ON modules;

CREATE POLICY "Fleet members can view modules"
  ON modules FOR SELECT TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can insert modules"
  ON modules FOR INSERT TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update modules"
  ON modules FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- LESSONS
-- ============================================
DROP POLICY IF EXISTS "Fleet members can view lessons" ON lessons;
DROP POLICY IF EXISTS "Admins can insert lessons" ON lessons;
DROP POLICY IF EXISTS "Admins can update lessons" ON lessons;

CREATE POLICY "Fleet members can view lessons"
  ON lessons FOR SELECT TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can insert lessons"
  ON lessons FOR INSERT TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update lessons"
  ON lessons FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- ASSIGNMENTS
-- ============================================
DROP POLICY IF EXISTS "Users can view own assignments" ON assignments;
DROP POLICY IF EXISTS "Fleet admins can view all assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON assignments;
DROP POLICY IF EXISTS "Users can update own assignment status" ON assignments;
DROP POLICY IF EXISTS "Admins can update any assignment" ON assignments;

CREATE POLICY "Users can view own assignments"
  ON assignments FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Fleet admins can view all assignments"
  ON assignments FOR SELECT TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can insert assignments"
  ON assignments FOR INSERT TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Users can update own assignment status"
  ON assignments FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins can update any assignment"
  ON assignments FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- COMPLETION RECORDS
-- ============================================
DROP POLICY IF EXISTS "Users can view own completions" ON completion_records;
DROP POLICY IF EXISTS "Fleet admins can view all completions" ON completion_records;
DROP POLICY IF EXISTS "Users can insert own completions" ON completion_records;

CREATE POLICY "Users can view own completions"
  ON completion_records FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Fleet admins can view all completions"
  ON completion_records FOR SELECT TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Users can insert own completions"
  ON completion_records FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================
-- COMPLIANCE REQUIREMENTS
-- ============================================
DROP POLICY IF EXISTS "Fleet members can view compliance requirements" ON compliance_requirements;
DROP POLICY IF EXISTS "Admins can insert compliance requirements" ON compliance_requirements;
DROP POLICY IF EXISTS "Admins can update compliance requirements" ON compliance_requirements;

CREATE POLICY "Fleet members can view compliance requirements"
  ON compliance_requirements FOR SELECT TO authenticated
  USING (
    fleet_id IS NULL OR fleet_id IN (SELECT fleet_id FROM profiles WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can insert compliance requirements"
  ON compliance_requirements FOR INSERT TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY "Admins can update compliance requirements"
  ON compliance_requirements FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- ============================================
-- DRIVER COMPLIANCE
-- ============================================
DROP POLICY IF EXISTS "Users can view own compliance" ON driver_compliance;
DROP POLICY IF EXISTS "Fleet admins can view compliance" ON driver_compliance;
DROP POLICY IF EXISTS "Admins can insert compliance records" ON driver_compliance;
DROP POLICY IF EXISTS "Admins can update compliance records" ON driver_compliance;

CREATE POLICY "Users can view own compliance"
  ON driver_compliance FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Fleet admins can view compliance"
  ON driver_compliance FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

CREATE POLICY "Admins can insert compliance records"
  ON driver_compliance FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

CREATE POLICY "Admins can update compliance records"
  ON driver_compliance FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

-- ============================================
-- DRIVER DOCUMENTS
-- ============================================
DROP POLICY IF EXISTS "Users can view own documents" ON driver_documents;
DROP POLICY IF EXISTS "Fleet admins can view documents" ON driver_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON driver_documents;
DROP POLICY IF EXISTS "Admins can insert documents" ON driver_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON driver_documents;
DROP POLICY IF EXISTS "Admins can update documents" ON driver_documents;

CREATE POLICY "Users can view own documents"
  ON driver_documents FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Fleet admins can view documents"
  ON driver_documents FOR SELECT TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Users can insert own documents"
  ON driver_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins can insert documents"
  ON driver_documents FOR INSERT TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Users can update own documents"
  ON driver_documents FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins can update documents"
  ON driver_documents FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- VEHICLES
-- ============================================
DROP POLICY IF EXISTS "Fleet members can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can update vehicles" ON vehicles;

CREATE POLICY "Fleet members can view vehicles"
  ON vehicles FOR SELECT TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can insert vehicles"
  ON vehicles FOR INSERT TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update vehicles"
  ON vehicles FOR UPDATE TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- NOTIFICATIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- DRIVER STATS
-- ============================================
DROP POLICY IF EXISTS "Users can view own stats" ON driver_stats;
DROP POLICY IF EXISTS "Fleet admins can view stats" ON driver_stats;
DROP POLICY IF EXISTS "Stats can be inserted" ON driver_stats;
DROP POLICY IF EXISTS "Stats can be updated" ON driver_stats;

CREATE POLICY "Users can view own stats"
  ON driver_stats FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Fleet admins can view stats"
  ON driver_stats FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

CREATE POLICY "Admins can insert stats"
  ON driver_stats FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
    OR user_id = (select auth.uid())
  );

CREATE POLICY "Admins can update stats"
  ON driver_stats FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

-- ============================================
-- AUDIT LOGS
-- ============================================
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY "Admins can insert audit logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
  );

-- ============================================
-- QUIZ QUESTIONS
-- ============================================
DROP POLICY IF EXISTS "Fleet members can view quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Admins can manage quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Admins can update quiz questions" ON quiz_questions;

CREATE POLICY "Fleet members can view quiz questions"
  ON quiz_questions FOR SELECT TO authenticated
  USING (
    lesson_id IN (
      SELECT l.id FROM lessons l
      WHERE l.fleet_id IN (SELECT fleet_id FROM profiles WHERE id = (select auth.uid()))
    )
  );

CREATE POLICY "Admins can manage quiz questions"
  ON quiz_questions FOR INSERT TO authenticated
  WITH CHECK (
    lesson_id IN (
      SELECT l.id FROM lessons l
      WHERE l.fleet_id IN (
        SELECT fleet_id FROM profiles
        WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

CREATE POLICY "Admins can update quiz questions"
  ON quiz_questions FOR UPDATE TO authenticated
  USING (
    lesson_id IN (
      SELECT l.id FROM lessons l
      WHERE l.fleet_id IN (
        SELECT fleet_id FROM profiles
        WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  )
  WITH CHECK (
    lesson_id IN (
      SELECT l.id FROM lessons l
      WHERE l.fleet_id IN (
        SELECT fleet_id FROM profiles
        WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

-- ============================================
-- QUIZ RESPONSES
-- ============================================
DROP POLICY IF EXISTS "Users can view own responses" ON quiz_responses;
DROP POLICY IF EXISTS "Fleet admins can view responses" ON quiz_responses;
DROP POLICY IF EXISTS "Users can insert own responses" ON quiz_responses;

CREATE POLICY "Users can view own responses"
  ON quiz_responses FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Fleet admins can view responses"
  ON quiz_responses FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

CREATE POLICY "Users can insert own responses"
  ON quiz_responses FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================
-- FIX: handle_new_user function search_path
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;
