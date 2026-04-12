/*
  # Add BTW Sessions and Webhooks

  Adds three tables that exist in the Prisma schema but were missing from Supabase:

  1. `btw_sessions` — Behind-the-wheel training sessions with skills checklist,
     dual digital signatures (trainer + trainee), and route/vehicle metadata.

  2. `webhooks` — Fleet-registered webhook endpoints subscribed to platform events
     (e.g., BTW_SESSION_COMPLETED, ASSIGNMENT_CREATED).

  3. `webhook_deliveries` — Delivery log for each webhook dispatch attempt,
     including HTTP status, response body, and success flag.

  Security:
  - RLS enabled on all three tables
  - Fleet-scoped read policies (users see only their fleet's data)
  - Role-gated write policies (ADMIN / SUPERVISOR / DRIVER_COACH for BTW sessions;
    ADMIN only for webhook management)
  - Drivers can only sign their own sessions

  Indexes:
  - fleet_id, trainee_id, trainer_id, status, session_date on btw_sessions
  - fleet_id, is_active on webhooks
  - webhook_id, success, created_at on webhook_deliveries
*/

-- ============================================
-- BTW SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS btw_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id        uuid        NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  trainee_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Session timing
  session_date    timestamptz NOT NULL,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  -- Computed duration stored for efficient aggregation queries
  total_minutes   integer     NOT NULL DEFAULT 0,

  -- Route and vehicle context
  route_type      text        NOT NULL
                  CHECK (route_type IN ('city','highway','rural','backing','dock','mountain','mixed')),
  vehicle_type    text,
  vehicle_id      uuid,       -- nullable FK; vehicles table may not exist in all deployments

  start_location  text,
  end_location    text,

  -- Evaluation data stored as JSONB for flexibility (keys = skill slugs, values = boolean)
  -- Example: {"pre_trip_inspection": true, "backing_straight": false}
  skills_checklist jsonb      NOT NULL DEFAULT '{}',

  overall_rating  integer     CHECK (overall_rating BETWEEN 1 AND 5),
  trainer_notes   text,
  areas_for_improvement text,

  -- Digital signatures (base64-encoded SVG or PNG data URI)
  trainer_signature   text,
  trainer_signed_at   timestamptz,
  trainee_signature   text,
  trainee_signed_at   timestamptz,

  -- Lifecycle status
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','cancelled')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE btw_sessions ENABLE ROW LEVEL SECURITY;

-- Fleet members can view sessions within their fleet
CREATE POLICY "Fleet members can view btw_sessions"
  ON btw_sessions FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid())
  );

-- Trainers (DRIVER_COACH, SUPERVISOR, ADMIN) can create sessions
CREATE POLICY "Trainers can insert btw_sessions"
  ON btw_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'DRIVER_COACH')
    )
  );

-- Trainers can update sessions they created; admins can update any session in fleet
CREATE POLICY "Trainers can update own btw_sessions"
  ON btw_sessions FOR UPDATE
  TO authenticated
  USING (
    trainer_id = auth.uid()
    OR fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR')
    )
  )
  WITH CHECK (
    fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid())
  );

-- Trainees can update only their own signature fields
-- (enforced at application layer; RLS allows the update if they are the trainee)
CREATE POLICY "Trainees can sign own btw_sessions"
  ON btw_sessions FOR UPDATE
  TO authenticated
  USING (trainee_id = auth.uid())
  WITH CHECK (trainee_id = auth.uid());

-- Admins can delete sessions within their fleet
CREATE POLICY "Admins can delete btw_sessions"
  ON btw_sessions FOR DELETE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_btw_sessions_fleet_id     ON btw_sessions(fleet_id);
CREATE INDEX IF NOT EXISTS idx_btw_sessions_trainee_id   ON btw_sessions(trainee_id);
CREATE INDEX IF NOT EXISTS idx_btw_sessions_trainer_id   ON btw_sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_btw_sessions_status       ON btw_sessions(status);
CREATE INDEX IF NOT EXISTS idx_btw_sessions_session_date ON btw_sessions(session_date DESC);
-- Composite index for the trainee summary query (completed sessions by trainee, ordered by date)
CREATE INDEX IF NOT EXISTS idx_btw_sessions_trainee_status_date
  ON btw_sessions(trainee_id, status, session_date DESC);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_btw_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER btw_sessions_updated_at
  BEFORE UPDATE ON btw_sessions
  FOR EACH ROW EXECUTE FUNCTION update_btw_sessions_updated_at();


-- ============================================
-- WEBHOOKS
-- ============================================

CREATE TABLE IF NOT EXISTS webhooks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id    uuid        NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,

  -- Target endpoint
  url         text        NOT NULL,
  -- HMAC-SHA256 signing secret; stored hashed at application layer before insert
  secret      text,

  -- Array of event type strings the webhook is subscribed to
  -- Example: ['BTW_SESSION_COMPLETED', 'ASSIGNMENT_CREATED']
  events      text[]      NOT NULL DEFAULT '{}',

  is_active   boolean     NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Fleet admins can view their fleet's webhooks
CREATE POLICY "Fleet admins can view webhooks"
  ON webhooks FOR SELECT
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- Only admins can create webhooks
CREATE POLICY "Admins can insert webhooks"
  ON webhooks FOR INSERT
  TO authenticated
  WITH CHECK (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- Only admins can update webhooks
CREATE POLICY "Admins can update webhooks"
  ON webhooks FOR UPDATE
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

-- Only admins can delete webhooks
CREATE POLICY "Admins can delete webhooks"
  ON webhooks FOR DELETE
  TO authenticated
  USING (
    fleet_id IN (
      SELECT fleet_id FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE INDEX IF NOT EXISTS idx_webhooks_fleet_id  ON webhooks(fleet_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(fleet_id, is_active)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_webhooks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_webhooks_updated_at();


-- ============================================
-- WEBHOOK DELIVERIES
-- ============================================

-- Delivery log: one row per dispatch attempt per webhook.
-- Written by the backend event dispatcher; read-only from the frontend.
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    uuid        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,

  event_type    text        NOT NULL,
  -- Full JSON payload sent to the webhook endpoint
  payload       jsonb       NOT NULL DEFAULT '{}',

  -- HTTP response details
  status_code   integer,
  response_body text,
  success       boolean     NOT NULL DEFAULT false,

  -- Retry tracking
  attempt       integer     NOT NULL DEFAULT 1,

  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Fleet admins can view delivery logs for their webhooks
CREATE POLICY "Fleet admins can view webhook_deliveries"
  ON webhook_deliveries FOR SELECT
  TO authenticated
  USING (
    webhook_id IN (
      SELECT w.id FROM webhooks w
      JOIN profiles p ON p.fleet_id = w.fleet_id
      WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'BRANCH_MANAGER')
    )
  );

-- Deliveries are written by the backend service role, not by end users.
-- No INSERT/UPDATE/DELETE policies for authenticated role intentionally.
-- The backend uses the service_role key which bypasses RLS.

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id
  ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success
  ON webhook_deliveries(webhook_id, success);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at
  ON webhook_deliveries(created_at DESC);
-- Composite index for delivery history queries (most recent attempts per webhook)
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_created
  ON webhook_deliveries(webhook_id, created_at DESC);
