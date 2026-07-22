-- FCM device tokens for native push (Android). Web browsers use the
-- push_subscriptions table (Web Push / VAPID) instead; native clients can't
-- use Web Push, so they register an FCM registration token here and the
-- notifications service fans out to both channels.
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
