-- Web Push subscriptions (one row per device/browser)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Per-user, per-type channel preferences, e.g.
--   { "task_due_soon": { "push": true, "email": false }, ... }
-- NULL means "use defaults".
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB;
