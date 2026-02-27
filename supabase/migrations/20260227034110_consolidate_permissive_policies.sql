/*
  # Consolidate Multiple Permissive RLS Policies

  Merges pairs of permissive policies on the same table/action/role into
  single policies with combined OR conditions. This eliminates the
  "multiple permissive policies" security warning while preserving
  identical access logic.

  1. Tables affected
    - profiles: SELECT (2 -> 1), UPDATE (2 -> 1)
    - assignments: SELECT (2 -> 1), UPDATE (2 -> 1)
    - completion_records: SELECT (2 -> 1)
    - driver_compliance: SELECT (2 -> 1)
    - driver_documents: SELECT (2 -> 1), INSERT (2 -> 1), UPDATE (2 -> 1)
    - driver_stats: SELECT (2 -> 1)
    - quiz_responses: SELECT (2 -> 1)

  2. Security notes
    - Access logic is identical before and after; only the policy
      structure changes from two PERMISSIVE policies to one
    - All policies still restricted to authenticated role
    - All ownership and fleet-membership checks preserved
*/

-- ============================================
-- PROFILES SELECT: merge "own profile" + "same fleet"
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users in same fleet can view profiles" ON profiles;

CREATE POLICY "Users can view own or fleet profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles WHERE id = (select auth.uid())
    )
  );

-- ============================================
-- PROFILES UPDATE: merge "own profile" + "admin fleet"
-- ============================================
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile in fleet" ON profiles;

CREATE POLICY "Users can update own or admins update fleet profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- ============================================
-- ASSIGNMENTS SELECT: merge "own" + "fleet admins"
-- ============================================
DROP POLICY IF EXISTS "Users can view own assignments" ON assignments;
DROP POLICY IF EXISTS "Fleet admins can view all assignments" ON assignments;

CREATE POLICY "Users can view own or admins view fleet assignments"
  ON assignments FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- ASSIGNMENTS UPDATE: merge "own" + "admin"
-- ============================================
DROP POLICY IF EXISTS "Users can update own assignment status" ON assignments;
DROP POLICY IF EXISTS "Admins can update any assignment" ON assignments;

CREATE POLICY "Users can update own or admins update fleet assignments"
  ON assignments FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- COMPLETION RECORDS SELECT: merge "own" + "fleet admins"
-- ============================================
DROP POLICY IF EXISTS "Users can view own completions" ON completion_records;
DROP POLICY IF EXISTS "Fleet admins can view all completions" ON completion_records;

CREATE POLICY "Users can view own or admins view fleet completions"
  ON completion_records FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- DRIVER COMPLIANCE SELECT: merge "own" + "fleet admins"
-- ============================================
DROP POLICY IF EXISTS "Users can view own compliance" ON driver_compliance;
DROP POLICY IF EXISTS "Fleet admins can view compliance" ON driver_compliance;

CREATE POLICY "Users can view own or admins view fleet compliance"
  ON driver_compliance FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

-- ============================================
-- DRIVER DOCUMENTS SELECT: merge "own" + "fleet admins"
-- ============================================
DROP POLICY IF EXISTS "Users can view own documents" ON driver_documents;
DROP POLICY IF EXISTS "Fleet admins can view documents" ON driver_documents;

CREATE POLICY "Users can view own or admins view fleet documents"
  ON driver_documents FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- DRIVER DOCUMENTS INSERT: merge "own" + "admins"
-- ============================================
DROP POLICY IF EXISTS "Users can insert own documents" ON driver_documents;
DROP POLICY IF EXISTS "Admins can insert documents" ON driver_documents;

CREATE POLICY "Users can insert own or admins insert fleet documents"
  ON driver_documents FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- DRIVER DOCUMENTS UPDATE: merge "own" + "admins"
-- ============================================
DROP POLICY IF EXISTS "Users can update own documents" ON driver_documents;
DROP POLICY IF EXISTS "Admins can update documents" ON driver_documents;

CREATE POLICY "Users can update own or admins update fleet documents"
  ON driver_documents FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  );

-- ============================================
-- DRIVER STATS SELECT: merge "own" + "fleet admins"
-- ============================================
DROP POLICY IF EXISTS "Users can view own stats" ON driver_stats;
DROP POLICY IF EXISTS "Fleet admins can view stats" ON driver_stats;

CREATE POLICY "Users can view own or admins view fleet stats"
  ON driver_stats FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );

-- ============================================
-- QUIZ RESPONSES SELECT: merge "own" + "fleet admins"
-- ============================================
DROP POLICY IF EXISTS "Users can view own responses" ON quiz_responses;
DROP POLICY IF EXISTS "Fleet admins can view responses" ON quiz_responses;

CREATE POLICY "Users can view own or admins view fleet responses"
  ON quiz_responses FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.fleet_id IN (
        SELECT fleet_id FROM profiles WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
      )
    )
  );
