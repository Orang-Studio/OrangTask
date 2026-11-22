-- each member orders a shared list in their own sidebar NULL falls back to the owners lists position until the member reorders
ALTER TABLE list_members
  ADD COLUMN IF NOT EXISTS position INTEGER;
