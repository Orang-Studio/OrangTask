# OrangTask MCP server

Exposes your OrangTask tasks and lists to Claude Code (or any MCP client) over the
existing personal-API-key REST surface. No new backend code, no extra auth path.

First, get a personal API key: in OrangTask go to **Settings → Integrations**
and create one. The raw key (`otk_…`) is shown exactly once, copy it then.

## Install as a Claude Code plugin (recommended)

This repo is also a plugin marketplace, so you can install without cloning.

1. Export your key so the plugin can read it:

   ```sh
   export ORANGTASK_API_KEY=otk_your_key_here
   ```

2. Add the marketplace and install, inside Claude Code:

   ```
   /plugin marketplace add Orang-Studio/OrangTask
   /plugin install orangtask@orangtask
   ```

The plugin runs the published `orangtask-mcp` package via `npx`, so there is no
clone or `npm install` step. `ORANGTASK_API_URL` defaults to
`https://task.oranges.lt`; export it to override (e.g. `http://localhost:3001`
for a local backend). Verify with `/mcp`, `orangtask` should list 11 tools.

## Install manually (any MCP client)

1. Install deps:

   ```sh
   cd mcp && npm install
   ```

2. Register with Claude Code:

   ```sh
   claude mcp add orangtask \
     --env ORANGTASK_API_KEY=otk_your_key_here \
     --env ORANGTASK_API_URL=https://task.oranges.lt \
     -- node /absolute/path/to/mcp/index.js
   ```

   `ORANGTASK_API_URL` defaults to `https://task.oranges.lt`; set it to
   `http://localhost:3001` to point at a local backend.

Verify with `/mcp` inside Claude Code, `orangtask` should list 11 tools.

## Tools

| Tool | What it does |
| --- | --- |
| `list_tasks` | Tasks from a smart view (`today`, `week`, `overdue`, `assigned`, `all`) or one list |
| `list_subtasks` | The subtasks nested under one parent task |
| `search_tasks` | Substring + full-text search over titles and notes |
| `create_task` | Add a task to a list, or a subtask under one via `parent_id` |
| `update_task` | Patch title, notes, priority, status, dates, assignee, recurrence, `parent_id` |
| `complete_task` | Mark done (recurring tasks roll to the next occurrence) |
| `uncomplete_task` | Move a done task back to todo |
| `delete_task` | Permanent delete |
| `list_lists` | Lists you own or were shared into, with ids |
| `create_list` | New owned list |
| `list_tags` | Your tags |

Task payloads are trimmed (notes truncated to 300 chars) so a large list does not
flood the model context.

`list_tasks` and `search_tasks` only return top-level tasks, each carrying a
`subtask_count`. Use `list_subtasks` (parent's `list_id` + `id`) to descend into
any task whose count is above zero.

Nesting is set with `parent_id`: on `create_task` to file a new task under an
existing one, on `update_task` to move an existing task (pass `null` to pull it
back up to the top level). The parent must be in the same list, and a task
cannot be moved under one of its own subtasks.

## Notes

- The API key carries **full account access**: same as your session. Treat it like a
  password, and revoke it from Settings → Integrations if it leaks.
- `delete_task` is irreversible. Claude Code will prompt before it runs unless you
  have allowlisted the tool.
- Permissions are enforced server side: viewers on a shared list get 403 on writes.
