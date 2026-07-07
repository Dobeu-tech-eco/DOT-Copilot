-- Hotfix: RLS recursion on profiles (42P17 -> PostgREST 500) introduced by
-- 20260707000000. Replace self-referential subqueries with SECURITY DEFINER
-- helpers (function owner bypasses RLS, breaking the recursion).
-- Applied to project qcsfncdgmjuvedbyejhp on 2026-07-07 (matches live state).

CREATE OR REPLACE FUNCTION public.current_user_fleet_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.fleet_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_fleet_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_fleet_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- PROFILES
DROP POLICY IF EXISTS "Users can view own, fleet, or all profiles as platform admin" ON public.profiles;
CREATE POLICY "Users can view own, fleet, or all profiles as platform admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (fleet_id IS NOT NULL AND fleet_id = public.current_user_fleet_id())
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Users can update own, fleet admins update fleet, or platform admin any" ON public.profiles;
CREATE POLICY "Users can update own, fleet admins update fleet, or platform admin any"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (fleet_id IS NOT NULL AND fleet_id = public.current_user_fleet_id()
        AND public.current_user_role() IN ('ADMIN','BRANCH_MANAGER'))
    OR public.is_platform_admin()
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR (fleet_id IS NOT NULL AND fleet_id = public.current_user_fleet_id()
        AND public.current_user_role() IN ('ADMIN','BRANCH_MANAGER'))
    OR public.is_platform_admin()
  );

-- FLEETS (use helpers for consistency/perf; semantics preserved)
DROP POLICY IF EXISTS "Authenticated users can view fleets" ON public.fleets;
CREATE POLICY "Authenticated users can view fleets"
  ON public.fleets FOR SELECT
  TO authenticated
  USING (
    id = public.current_user_fleet_id()
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admins can insert fleets" ON public.fleets;
CREATE POLICY "Admins can insert fleets"
  ON public.fleets FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'ADMIN'
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admins can update fleets" ON public.fleets;
CREATE POLICY "Admins can update fleets"
  ON public.fleets FOR UPDATE
  TO authenticated
  USING (
    (id = public.current_user_fleet_id() AND public.current_user_role() IN ('ADMIN','BRANCH_MANAGER'))
    OR public.is_platform_admin()
  )
  WITH CHECK (
    (id = public.current_user_fleet_id() AND public.current_user_role() IN ('ADMIN','BRANCH_MANAGER'))
    OR public.is_platform_admin()
  );
