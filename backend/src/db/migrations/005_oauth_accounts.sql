-- Linked OAuth identities. Lets one OrangTask account be reached from multiple
-- providers even when their emails differ, login matches on (provider,
-- provider_user_id) first, then falls back to email for older accounts.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
