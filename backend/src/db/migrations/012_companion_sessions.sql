-- a watch has its own renewable session owned by the signed in phone session
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS parent_refresh_token_id UUID REFERENCES refresh_tokens(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS companion_device_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_companion_device
  ON refresh_tokens(parent_refresh_token_id, companion_device_id);

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS refresh_token_id UUID REFERENCES refresh_tokens(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_id ON sessions(refresh_token_id);
