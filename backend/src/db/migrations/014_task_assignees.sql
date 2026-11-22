-- assigned_to mirrors first assignee for older clients
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignee_ids UUID[] NOT NULL DEFAULT '{}';
UPDATE tasks SET assignee_ids = ARRAY[assigned_to]
  WHERE assigned_to IS NOT NULL AND assignee_ids = '{}';
