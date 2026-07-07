/*
  # Platform Admin Role + Fleet Provisioning Support

  Adds a platform-admin concept so Dobeu staff can provision new customer
  fleets (e.g. Baldor) from an admin dashboard. Platform admins are Dobeu
  employees, not customer users, and need cross-fleet access to `fleets`
  and `profiles` to create new fleets and manage invited admin users.

  AMENDED during pre-apply review: an earlier draft used `true OR
  is_platform_admin()` in the fleets policies, which would have re-loosened
  the tenant-scoped policies from 20260227014402/20260227034110 back to
  USING (true). This version preserves the live tenant-scoped semantics and
  adds the platform-admin grant via OR. This file matches the SQL applied
  to project qcsfncdgmjuvedbyejhp on 2026-07-07.

  Contents:
  1. profiles.is_platform_admin column (+ partial index)
  2. public.is_platform_admin() SECURITY DEFINER helper (auth.uid() only)
  3. Tenant-preserving RLS updates on fleets/profiles with platform-admin OR
  4. handle_new_user() reads invite metadata (fleet_id/role/full_name)
  5. Seed initial Dobeu platform admins
*/

-- ============================================
-- PROFILES: is_platform_admin column
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_platform_admin
  ON public.profiles (is_platform_admin)
  WHERE is_platform_admin = true;

-- ============================================
-- HELPER: public.is_platform_admin()
-- ============================================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_platform_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ============================================
-- FLEETS: platform-admin-aware policies
-- ============================================
-- Preserve the tenant-scoped semantics from 20260227014402/20260227034110
-- and add the platform-admin grant via OR.
DROP POLICY IF EXISTS "Authenticated users can view fleets" ON public.fleets;
CREATE POLICY "Authenticated users can view fleets"
  ON public.fleets FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT profiles.fleet_id FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
    )
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admins can insert fleets" ON public.fleets;
CREATE POLICY "Admins can insert fleets"
  ON public.fleets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'ADMIN'
    )
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admins can update fleets" ON public.fleets;
CREATE POLICY "Admins can update fleets"
  ON public.fleets FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT profiles.fleet_id FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['ADMIN','BRANCH_MANAGER'])
    )
    OR public.is_platform_admin()
  )
  WITH CHECK (
    id IN (
      SELECT profiles.fleet_id FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['ADMIN','BRANCH_MANAGER'])
    )
    OR public.is_platform_admin()
  );

-- ============================================
-- PROFILES: platform-admin-aware policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own or fleet profiles" ON public.profiles;
CREATE POLICY "Users can view own, fleet, or all profiles as platform admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Users can update own or admins update fleet profiles" ON public.profiles;
CREATE POLICY "Users can update own, fleet admins update fleet, or platform admin any"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM public.profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
    OR public.is_platform_admin()
  )
  WITH CHECK (
    id = (select auth.uid())
    OR fleet_id IN (
      SELECT fleet_id FROM public.profiles
      WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
    OR public.is_platform_admin()
  );

-- ============================================
-- TRIGGER: handle_new_user() reads invite metadata
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, fleet_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'DRIVER'),
    CASE
      WHEN NEW.raw_user_meta_data->>'fleet_id' IS NOT NULL
        THEN (NEW.raw_user_meta_data->>'fleet_id')::uuid
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- SEED: initial platform admins
-- ============================================
UPDATE public.profiles
SET is_platform_admin = true
WHERE email IN ('jswilliamstu@gmail.com', 'jeremyw@dobeu.net', 'pilot-check@dobeu.net');
