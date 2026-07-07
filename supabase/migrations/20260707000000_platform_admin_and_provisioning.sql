/*
  # Platform Admin Role + Fleet Provisioning Support

  Adds a platform-admin concept so Dobeu staff can provision new customer
  fleets (e.g. Baldor) from an admin dashboard, independent of any single
  fleet's membership. Platform admins are Dobeu employees, not customer
  users, and need cross-fleet SELECT/INSERT/UPDATE access to `fleets` and
  cross-fleet SELECT/UPDATE access to `profiles` so they can create new
  fleets and manage the initial admin users invited into them.

  1. New column
     - `profiles.is_platform_admin` (boolean, default false) — flags Dobeu
       staff accounts. Not fleet-scoped; independent of `role`.

  2. New helper function
     - `public.is_platform_admin()` — SECURITY DEFINER function that checks
       whether the calling user (auth.uid()) has is_platform_admin = true.
       SECURITY DEFINER + fixed search_path avoids recursive-RLS issues when
       referenced from policies on `profiles` itself, and avoids search_path
       hijacking.

  3. New RLS policies (additive; consolidated with existing policies where
     they share the same table/action/role, following the OR-merge style
     used in migration 20260227034110_consolidate_permissive_policies.sql)
     - fleets: platform admins get SELECT/INSERT/UPDATE across all fleets
       (merged into the existing "authenticated users" / "admins" policies).
     - profiles: platform admins get SELECT/UPDATE across all fleets (merged
       into the existing "own or fleet" policies from the consolidation
       migration).

  4. Updated trigger
     - `public.handle_new_user()` now reads `fleet_id`, `role`, and
       `full_name` from `NEW.raw_user_meta_data` (as supplied by
       `auth.admin.inviteUserByEmail`'s `data` option) so invited users land
       with the correct fleet_id + role instead of always defaulting to
       fleet_id = NULL / role = 'DRIVER'. Falls back to prior defaults when
       metadata is absent, and continues to read the legacy `name` key for
       backward compatibility with the existing signup flow.

  5. Seed
     - Marks the initial Dobeu platform admin accounts.

  Security notes:
  - is_platform_admin() is SECURITY DEFINER so it can read profiles without
    being blocked by RLS on profiles, but it only ever evaluates against
    auth.uid() — callers cannot pass an arbitrary user id.
  - All new policies are scoped to the `authenticated` role, matching
    existing conventions.
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
DROP POLICY IF EXISTS "Authenticated users can view fleets" ON public.fleets;
CREATE POLICY "Authenticated users can view fleets"
  ON public.fleets FOR SELECT
  TO authenticated
  USING (
    true
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admins can insert fleets" ON public.fleets;
CREATE POLICY "Admins can insert fleets"
  ON public.fleets FOR INSERT
  TO authenticated
  WITH CHECK (
    true
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admins can update fleets" ON public.fleets;
CREATE POLICY "Admins can update fleets"
  ON public.fleets FOR UPDATE
  TO authenticated
  USING (
    true
    OR public.is_platform_admin()
  )
  WITH CHECK (
    true
    OR public.is_platform_admin()
  );

-- ============================================
-- PROFILES: platform-admin-aware policies
-- (merged with the consolidated "own or fleet" policies from
--  20260227034110_consolidate_permissive_policies.sql)
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

-- Trigger already exists from the core schema migration (on_auth_user_created);
-- re-creating the function body above is sufficient since the trigger just
-- calls public.handle_new_user().

-- ============================================
-- SEED: initial platform admins
-- ============================================
UPDATE public.profiles
SET is_platform_admin = true
WHERE email IN ('jswilliamstu@gmail.com', 'jeremyw@dobeu.net', 'pilot-check@dobeu.net');
