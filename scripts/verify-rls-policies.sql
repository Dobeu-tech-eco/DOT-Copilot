-- DOT-Copilot RLS Policy Verification Script
-- Run against production Supabase to verify hardened policies are in place.
-- Any row in the output means a DANGEROUS permissive policy exists.

-- Check for overly permissive policies (USING true or WITH CHECK true without subquery)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    -- Policies that allow all rows unconditionally
    qual = 'true'
    OR with_check = 'true'
    -- Policies missing fleet-scoped subqueries
    OR (qual IS NOT NULL AND qual NOT LIKE '%auth.uid()%' AND qual != 'true')
  )
ORDER BY tablename, policyname;

-- Verify RLS is enabled on all public tables
SELECT
  t.tablename,
  CASE WHEN t.rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END AS rls_status
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE 'pg_%'
  AND t.tablename NOT LIKE '_prisma_%'
ORDER BY t.tablename;

-- Count policies per table (should be >= 2 per table: at least SELECT + INSERT/UPDATE)
SELECT
  tablename,
  COUNT(*) AS policy_count,
  array_agg(policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count ASC;
