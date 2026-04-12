/*
  # Add Push Subscriptions Table

  ## Summary
  Adds a `push_subscriptions` table to store browser Web Push API subscription data
  for users who have opted into browser push notifications.

  ## New Tables

  ### push_subscriptions
  Stores browser push notification subscription endpoints and keys per user.
  - `id` - UUID primary key
  - `user_id` - References profiles (one subscription per user, upsertable)
  - `endpoint` - Web Push endpoint URL provided by the browser
  - `p256dh_key` - Public key for message encryption (P-256 curve)
  - `auth_key` - Auth secret for message authentication
  - `created_at` - Timestamp

  ## Security
  - RLS enabled; users can only manage their own subscription records
  - Admins (via service role) can read all for sending notifications

  ## Notes
  1. One row per user - duplicate endpoints are handled by upsert on user_id
  2. When a user disables push in Settings, their row is deleted
*/

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'push_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'push_subscriptions' AND indexname = 'push_subscriptions_user_id_idx'
  ) THEN
    CREATE UNIQUE INDEX push_subscriptions_user_id_idx ON push_subscriptions (user_id);
  END IF;
END $$;

CREATE POLICY "Users can view own push subscription"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscription"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscription"
  ON push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscription"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
