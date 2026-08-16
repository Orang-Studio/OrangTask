CREATE TABLE IF NOT EXISTS github_connections (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  github_login TEXT,
  access_token TEXT NOT NULL,
  scopes TEXT,
  sync_issues BOOLEAN NOT NULL DEFAULT true,
  sync_pull_requests BOOLEAN NOT NULL DEFAULT true,
  sync_security BOOLEAN NOT NULL DEFAULT true,
  list_id UUID REFERENCES lists(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS github_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  external_key TEXT NOT NULL,
  repo TEXT NOT NULL,
  number INTEGER,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT,
  author TEXT,
  severity TEXT,
  labels TEXT[],
  item_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, external_key)
);

CREATE INDEX IF NOT EXISTS idx_github_items_user ON github_items(user_id);
CREATE INDEX IF NOT EXISTS idx_github_items_task ON github_items(task_id);

CREATE TABLE IF NOT EXISTS scratchpads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scratchpads_user ON scratchpads(user_id);