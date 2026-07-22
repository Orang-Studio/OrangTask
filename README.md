<div align="center">

### OrangTask
A self-hosted task manager with a web app, an Android app and real-time sync<br>
Lists, smart views, sharing, natural language quick-add, offline queue and push<br>

[task.oranges.lt](https://task.oranges.lt)

</div>

---

### What's in here

| Folder | What it is |
| --- | --- |
| `backend/` | Bun + Hono + Postgres API, WebSocket sync, web push |
| `frontend/` | React + Vite + Tailwind PWA |
| `android/` | Native Kotlin app (Jetpack Compose, Room, Hilt) |
| `mcp/` | MCP server so Claude Code can read and edit your tasks |

### Features

- Lists with icons and colors, plus smart views (today, week, overdue, assigned, all)
- Share a list with anyone, roles for owner, editor and viewer
- Quick-add that parses text like `report friday 5pm high priority`
- Recurring tasks via RRULE
- Real-time sync over WebSocket, offline queue that flushes on reconnect
- Web push and native Android push (FCM)
- Command palette, keyboard shortcuts, light and dark themes
- Personal API keys and outgoing webhooks for n8n, Zapier or your own scripts
- Import from Google Keep (Google Takeout export)

### Self-hosting

```bash
git clone https://github.com/Orang-Studio/OrangTask
cd OrangTask
cp backend/.env.example backend/.env
```

Fill in `backend/.env`, at minimum `DATABASE_URL`, `REDIS_URL` and `SESSION_SECRET`.
OAuth, email and push are all optional, the app runs without them.

```bash
docker compose up -d
```

Or run it directly:

```bash
cd backend  && bun install && bun run src/index.ts
cd frontend && bun install && bun run dev
```

`nginx.example.conf` has a reverse proxy config that handles the `/ws` upgrade.

### Android

Open `android/` in Android Studio and run. It builds in two flavors: `foss`,
which has no proprietary dependencies and is what F-Droid ships, and `full`,
which adds Firebase Cloud Messaging for native push. For push, drop your Firebase
`google-services.json` into `android/app/` and apply the Google Services plugin.
Without it the app still builds, push is simply inert.

See [android/README.md](android/README.md) for the flavors and the F-Droid setup.

### Claude Code integration

`mcp/` is an MCP server that exposes your tasks over the personal API key. See
[mcp/README.md](mcp/README.md) for setup.

### Requirements

- Bun 1.1+ (or Node 18+)
- PostgreSQL 14+
- Redis 6+
- JDK 17 and Android SDK 34 for the Android app

<div align="center">

MIT licensed<br>
Made with Love ❤️

</div>
