# OrangTask for Android

Native Kotlin/Jetpack Compose client for OrangTask. Talks to the same backend
as the web app (REST + WebSocket), point it at your instance and go.

## Status

- **Phase 0 (done)**: auth: email/password sign-in & registration, magic link
  (request + paste-link completion), forgot/reset password, PIN unlock with
  forgot-PIN recovery, silent access-token refresh, encrypted token storage.
- **Phase 1 (done)**: tasks & lists: smart views (Today/Upcoming/Overdue/
  Assigned/All), list index + create/rename/icon/color/delete, task rows with
  swipe-to-complete/delete, quick add, full task editor (due date/time,
  priority, assignee, tags, notes, recurrence rule, subtasks), Room cache as
  the UI's source of truth, WebSocket realtime sync with reconnect, minimal
  settings (theme + sign out).
- **Phase 2 (done)**: offline mutations: a durable `pending_ops` queue
  (Room + WorkManager) replays task creates/edits/completes/deletes in order
  when connectivity returns, with tasks created offline shown immediately as
  local drafts. Search tab hitting `/api/search` (the web's ⌘K palette), with
  results deep-linking into the task sheet. Natural-language quick add
  ("report friday 5pm !high", "pay rent every month") with live parse-preview
  chips.
- **Phase 3 (this)**: list sharing (invite by email, editor/viewer roles,
  leave list) from the list menu; full settings (profile editing, PIN
  setup/removal, per-type push/email notification preferences, theme);
  webhooks manager (outgoing with event selection + test + delivery log,
  incoming with copyable URL); an Integrations section for personal API keys
  (create/revoke, shown once) that authenticate direct REST calls alongside
  the incoming webhook; notifications screen with unread bell on the smart
  views (60s poll, like the web); data tools, JSON export via the share
  sheet, Google Keep import (pick the Takeout .zip, parsed on-device), and
  account deletion.
- **Phase 4 (in progress)**: GitHub/Google OAuth sign-in via a Chrome Custom
  Tab: the backend carries a `platform=android` flag through the OAuth `state`
  and, on success, redirects to the `orangtask://auth-callback` deep link with
  the token pair (handled by `MainActivity`) instead of the web app. Login
  buttons appear only for providers the backend has configured (`/auth/providers`).
  FCM push is still pending, it needs a Firebase project you own for the
  service-account credentials.

## Building

Requirements: Android Studio (Ladybug or newer) with JDK 17. Everything else
(Gradle 8.9, SDK 35, dependencies) is fetched automatically on first sync.

There are two product flavors:

| Flavor | Push | Ships to |
| --- | --- | --- |
| `foss` | none, the notification list is polled | F-Droid |
| `full` | Firebase Cloud Messaging | GitHub releases, Play |

`foss` pulls in no proprietary libraries at all, which is what F-Droid requires.
The only difference in the code is `PushRegistrar`, which is a no-op there, plus
`OrangMessagingService` and the FCM manifest entries, which only exist in `full`.

```bash
# Open the android/ folder in Android Studio and press Run, or:
cd android
./gradlew assembleFossDebug     # → app/build/outputs/apk/foss/debug/app-foss-debug.apk
./gradlew assembleFullRelease   # → app/build/outputs/apk/full/release/app-full-release.apk
```

Both APKs are installable by sideloading (`adb install` or copying to the
phone). Without a `keystore.properties`, release builds are signed with the
debug key; for Play-Store-grade signing create `android/keystore.properties`:

```properties
storeFile=orangtask.jks
storePassword=...
keyAlias=orangtask
keyPassword=...
```

## F-Droid

F-Droid builds `assembleFossRelease` from the tag matching the version, signs it
itself and publishes it. Two things feed that:

- `fastlane/metadata/android/en-US/` at the repo root holds the store listing
  (title, summary, description, changelogs, icon, feature graphic). F-Droid
  reads it straight from this repo on every build, so changing the listing is a
  normal commit. A new release needs `changelogs/<versionCode>.txt`.
- `metadata/lt.oranges.orangtask.yml` in
  [fdroiddata](https://gitlab.com/fdroid/fdroiddata) holds the build recipe.
  Its `UpdateCheckMode: Tags` picks up new `v*` tags on its own, so a release is
  just a version bump plus a tag.

Keep the `foss` flavor free of proprietary dependencies or the build gets
rejected by F-Droid's scanner.

## Server

The app targets `https://task.oranges.lt` by default, change `API_BASE_URL`
in `app/build.gradle.kts` to point at your own instance.

The backend must include the native-client auth support from this repo
(`backend/src/routes/auth.ts`): the `X-Platform` header makes auth endpoints
return tokens in the JSON body, and `/api/auth/refresh` accepts the refresh
token as a bearer header. Deploy the current backend before testing the app.

Debug builds allow cleartext HTTP so you can develop against a local backend
(`http://10.0.2.2:3001` from the emulator).

## Architecture

Single `app` module, package-by-feature:

- `core/network`: Retrofit/OkHttp + kotlinx.serialization; `AuthInterceptor`
  adds `X-Platform: android` and the bearer token; `TokenAuthenticator`
  silently refreshes on 401 and retries (mirrors the web's `auth:expired`
  flow). Tokens live in `EncryptedSharedPreferences` (`TokenStore`).
- `core/db`: Room cache of the server data. Task rows are denormalized the
  way the API returns them (tag names/ids, assignee, subtask count on the
  row); smart views run as local queries over it, so screens render instantly
  and offline from the last sync.
- `core/ws` + `core/sync`: OkHttp WebSocket to `/ws?token=…` with exponential
  backoff; `SyncCoordinator` full-refreshes on every (re)connect, applies
  complete event payloads directly and debounces a refetch behind every event
  (the web's invalidate-on-event, made durable).
- `auth`: repository + login/PIN screens. The PIN gate is local: the server's
  7-day `pin_ok` cookie is mirrored by a `pinVerifiedUntil` timestamp.
- `tasks` / `lists`: repositories with optimistic mutations (apply to Room,
  call the API, roll back on failure) and the task/list screens; one
  parameterized `TaskListScreen` serves the smart views and list detail.
- `home`: `MainScaffold`: bottom tab bar (Today / Lists / + / Search /
  Settings) and the signed-in NavHost; sync runs only while it is started.
- `ui/theme`: design tokens ported from `frontend/tailwind.config.js`
  (orange/ink scales, DM Sans, sharp corners), dark by default.
- `navigation`: the session state (`Loading / LoggedOut / RequiresPin /
  Active`) picks the visible surface, like the web `AuthGate`.
