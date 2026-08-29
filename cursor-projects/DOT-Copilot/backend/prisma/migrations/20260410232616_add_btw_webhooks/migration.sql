-- Migration: add_btw_webhooks
-- Adds btw_sessions, webhooks, and webhook_deliveries tables.
-- These tables exist in the application routes (src/routes/btw.ts, src/routes/webhooks.ts)
-- but were missing from the Prisma migration history.
--
-- Rollback: see rollback section at the bottom of this file.
-- Validation queries: see validation section at the bottom of this file.

-- ============================================
-- BTW SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS "btw_sessions" (
    "id"                    TEXT NOT NULL,
    "trainee_id"            TEXT NOT NULL,
    "trainer_id"            TEXT NOT NULL,
    "fleet_id"              TEXT,                    -- added for fleet tenancy (was missing from original model)
    "session_date"          TIMESTAMP(3) NOT NULL,
    "start_time"            TIMESTAMP(3) NOT NULL,
    "end_time"              TIMESTAMP(3) NOT NULL,
    "total_minutes"         INTEGER NOT NULL DEFAULT 0,
    "route_type"            TEXT NOT NULL,
    "vehicle_type"          TEXT,
    "vehicle_id"            TEXT,
    "start_location"        TEXT,
    "end_location"          TEXT,
    "skills_checklist"      JSONB NOT NULL DEFAULT '{}',
    "overall_rating"        INTEGER,
    "trainer_notes"         TEXT,
    "areas_for_improvement" TEXT,
    "trainer_signature"     TEXT,
    "trainer_signed_at"     TIMESTAMP(3),
    "trainee_signature"     TEXT,
    "trainee_signed_at"     TIMESTAMP(3),
    "status"                TEXT NOT NULL DEFAULT 'pending',
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "btw_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "btw_sessions_overall_rating_check" CHECK ("overall_rating" BETWEEN 1 AND 5),
    CONSTRAINT "btw_sessions_status_check" CHECK ("status" IN ('pending', 'completed', 'cancelled'))
);

-- Ensure fleet tenancy column exists when btw_sessions was created by an
-- earlier migration (init) that predates the fleet_id column.
ALTER TABLE "btw_sessions" ADD COLUMN IF NOT EXISTS "fleet_id" TEXT;

-- Foreign keys (idempotent: the init migration may already define these)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'btw_sessions_trainee_id_fkey') THEN
        ALTER TABLE "btw_sessions"
            ADD CONSTRAINT "btw_sessions_trainee_id_fkey"
            FOREIGN KEY ("trainee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'btw_sessions_trainer_id_fkey') THEN
        ALTER TABLE "btw_sessions"
            ADD CONSTRAINT "btw_sessions_trainer_id_fkey"
            FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'btw_sessions_fleet_id_fkey') THEN
        ALTER TABLE "btw_sessions"
            ADD CONSTRAINT "btw_sessions_fleet_id_fkey"
            FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "btw_sessions_trainee_id_idx"   ON "btw_sessions"("trainee_id");
CREATE INDEX IF NOT EXISTS "btw_sessions_trainer_id_idx"   ON "btw_sessions"("trainer_id");
CREATE INDEX IF NOT EXISTS "btw_sessions_fleet_id_idx"     ON "btw_sessions"("fleet_id");
CREATE INDEX IF NOT EXISTS "btw_sessions_status_idx"       ON "btw_sessions"("status");
CREATE INDEX IF NOT EXISTS "btw_sessions_session_date_idx" ON "btw_sessions"("session_date" DESC);

-- ============================================
-- WEBHOOKS
-- ============================================

CREATE TABLE IF NOT EXISTS "webhooks" (
    "id"                TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "url"               TEXT NOT NULL,
    "secret"            TEXT,
    -- events stored as text array; values match WebhookEventType enum
    "events"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_active"         BOOLEAN NOT NULL DEFAULT true,
    "fleet_id"          TEXT NOT NULL,
    "created_by"        TEXT NOT NULL,
    "headers"           JSONB,
    "max_retries"       INTEGER NOT NULL DEFAULT 3,
    "retry_delay_ms"    INTEGER NOT NULL DEFAULT 1000,
    "last_triggered_at" TIMESTAMP(3),
    "success_count"     INTEGER NOT NULL DEFAULT 0,
    "failure_count"     INTEGER NOT NULL DEFAULT 0,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_fleet_id_fkey') THEN
        ALTER TABLE "webhooks"
            ADD CONSTRAINT "webhooks_fleet_id_fkey"
            FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_created_by_fkey') THEN
        ALTER TABLE "webhooks"
            ADD CONSTRAINT "webhooks_created_by_fkey"
            FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "webhooks_fleet_id_idx"    ON "webhooks"("fleet_id");
CREATE INDEX IF NOT EXISTS "webhooks_is_active_idx"   ON "webhooks"("fleet_id", "is_active")
    WHERE "is_active" = true;

-- ============================================
-- WEBHOOK DELIVERIES
-- ============================================

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
    "id"               TEXT NOT NULL,
    "webhook_id"       TEXT NOT NULL,
    "event"            TEXT NOT NULL,
    "payload"          JSONB NOT NULL,
    "response_status"  INTEGER,
    "response_body"    TEXT,
    "response_time_ms" INTEGER,
    "success"          BOOLEAN NOT NULL,
    "attempts"         INTEGER NOT NULL DEFAULT 1,
    "last_attempt_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_webhook_id_fkey') THEN
        ALTER TABLE "webhook_deliveries"
            ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey"
            FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_id_created_at_idx"
    ON "webhook_deliveries"("webhook_id", "created_at" DESC);

-- ============================================
-- ROLLBACK
-- To undo this migration, run the following in reverse dependency order:
--
--   DROP TABLE IF EXISTS "webhook_deliveries";
--   DROP TABLE IF EXISTS "webhooks";
--   DROP TABLE IF EXISTS "btw_sessions";
--
-- ============================================

-- ============================================
-- VALIDATION QUERIES
-- Run after applying to verify integrity:
--
--   -- Confirm tables exist
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('btw_sessions', 'webhooks', 'webhook_deliveries');
--
--   -- Confirm FK constraints
--   SELECT conname, conrelid::regclass, confrelid::regclass
--   FROM pg_constraint
--   WHERE contype = 'f'
--     AND conrelid::regclass::text IN ('btw_sessions', 'webhooks', 'webhook_deliveries');
--
--   -- Confirm indexes
--   SELECT indexname, tablename FROM pg_indexes
--   WHERE tablename IN ('btw_sessions', 'webhooks', 'webhook_deliveries')
--   ORDER BY tablename, indexname;
--
--   -- Row counts (should all be 0 on fresh migration)
--   SELECT 'btw_sessions' AS tbl, COUNT(*) FROM btw_sessions
--   UNION ALL SELECT 'webhooks', COUNT(*) FROM webhooks
--   UNION ALL SELECT 'webhook_deliveries', COUNT(*) FROM webhook_deliveries;
--
-- ============================================
