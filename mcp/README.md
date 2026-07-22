# OrangTask MCP server

Exposes your OrangTask tasks and lists to Claude Code (or any MCP client) over the
existing personal-API-key REST surface. No new backend code, no extra auth path.

## Setup

1. In OrangTask, go to **Settings → Integrations** and create a personal API key.
   The raw key (`otk_…`) is shown exactly once, copy it then.

2. Install deps:

   ```sh
   cd mcp && npm install
   ```

3. Register with Claude Code:

   ```sh
   claude mcp add orangtask \
     --env ORANGTASK_API_KEY=otk_your_key_here \
     --env ORANGTASK_API_URL=https://task.oranges.lt \
     -- node /absolute/path/to/mcp/index.js
   ```

   `ORANGTASK_API_URL` defaults to `https://task.oranges.lt`; set it to
   `http://localhost:3001` to point at a local backend.

Verify with `/mcp` inside Claude Code, `orangtask` should list 10 tools.

## Tools

| Tool | What it does |
| --- | --- |
| `list_tasks` | Tasks from a smart view (`today`, `week`, `overdue`, `assigned`, `all`) or one list |
| `search_tasks` | Substring + full-text search over titles and notes |
| `create_task` | Add a task to a list |
| `update_task` | Patch title, notes, priority, status, dates, assignee, recurrence |
| `complete_task` | Mark done (recurring tasks roll to the next occurrence) |
| `uncomplete_task` | Move a done task back to todo |
| `delete_task` | Permanent delete |
| `list_lists` | Lists you own or were shared into, with ids |
| `create_list` | New owned list |
| `list_tags` | Your tags |

Task payloads are trimmed (notes truncated to 300 chars) so a large list does not
flood the model context.

## Notes

- The API key carries **full account access**: same as your session. Treat it like a
  password, and revoke it from Settings → Integrations if it leaks.
- `delete_task` is irreversible. Claude Code will prompt before it runs unless you
  have allowlisted the tool.
- Permissions are enforced server side: viewers on a shared list get 403 on writes.
