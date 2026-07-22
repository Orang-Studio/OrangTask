-- Add refresh tokens (long-lived, renews short-lived access tokens)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Add PIN support to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Shorten sessions to 1 hour (access token), refresh tokens last 1 year
-- Existing sessions remain valid (they're already in the table)
