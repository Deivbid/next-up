# Supabase setup

Run `migrations/202609110001_library.sql` once in **Next Up → SQL Editor → New query**. It creates two empty tables in a transaction. In Table Editor, expect `library_games` and `user_preferences`, with RLS enabled. Then run `migrations/202609110002_library_operations.sql` once. The second migration adds atomic snapshot/read and mutation functions and revokes direct table writes. Neither migration moves the original browser library. Do not run this migration in another app's project.

## Data contract

- `library_games`: one row per user and game. Maps the existing `Game` fields directly; `steamId`, `igdbId`, `updatedAt` map to `steam_id`, `igdb_id`, `updated_at`. Missing provider IDs map to SQL null. `updated_at` retains the existing millisecond timestamp for backup compatibility.
- `user_preferences`: one row per user; devices and theme. The local constant `id: "preferences"` is reconstructed by the client, not stored remotely.
- Supabase owns `auth.users`. Both tables reference its primary key and cascade only if that account is deleted.
- Anonymous clients have no table privileges. Authenticated clients can read/write only rows matching `auth.uid()`. Composite keys and provider uniqueness include `user_id` so different people can own the same game.
- The first migration adds row revision counters. The second uses the preferences revision as a library-wide optimistic lock, advanced on every mutation. Clients use the returned snapshot revision when submitting changes.
- Database checks constrain enums, bounds and cover hosts. Existing Zod domain validation must still run at the outgoing and incoming client boundaries (including per-label lengths and device uniqueness). No game image files or OAuth tokens belong in these tables.

## Account integration

The app uses `@supabase/supabase-js` with Google OAuth, PKCE and a root redirect. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` before building. Configure Google's client credentials only in Supabase. Allow the production root and `http://127.0.0.1:3030/` as Supabase redirects. Google's callback remains the Supabase `/auth/v1/callback` URL.

`next_up_read_library` returns `{games, preferences, revision}` in one SQL statement. All writes call `next_up_change_library` with the expected library counter and changed games/preferences/removals, or an explicitly confirmed replacement. It takes a per-account transaction advisory lock, rejects stale counters with SQLSTATE `PT409` (HTTP 409), and returns the resulting snapshot. The lock ends with the database transaction, with no independent lock TTL. Restoring and erasing are atomic. Direct table writes are revoked to prevent bypassing the counter. Security-definer functions use an empty search path and derive the account only from `auth.uid()`.

Supabase remains authoritative. The account cache is keyed by project hostname and user UUID. Form drafts also retain their account and opening revision. Logout clears the local account cache/draft; account changes unmount the previous controller, abort its requests and isolate its results. RPC calls pin the originating session's bearer token so switching accounts cannot send an old draft under a new identity.

Online writes only. Open/focus/reconnect or Settings → Profile → Refresh library fetches a fresh snapshot. There is no realtime subscription or offline mutation queue. Every mutation advances the library counter; even an unrelated change can require reopening a stale editor. The client never automatically retries a mutation. Fetch/RPC deadlines are 15 seconds; cancellation does not guarantee a transaction did not commit. On uncertain results, refresh reconciles server state before another write. Rate limiting asks the user to wait rather than automatically retrying without observing Retry-After.

Each response currently contains the account's full library (maximum 20,000 games); this simplifies consistency but costs more bandwidth than incremental sync. Store images by external URL, not as uploaded image files. Both outgoing and incoming data are checked with Zod; PostgreSQL additionally constrains storage and ownership. The original local library is read only for a backup-first explicit import; existing cloud edits win on duplicate IDs/provider IDs. Choosing import also records which account claimed that browser-local source; the import banner does not expose it to a different signed-in account afterward.

Sources inspected: current app write paths, installed Supabase JS/PostgREST client source, [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [auth.uid implementation](https://github.com/supabase/auth/blob/master/migrations/20211124214934_update_auth_functions.up.sql). HTTP errors are handled through the SDK's error/status response, not assumed to throw. No Supabase admin credentials or MCP access are available in this task; migrations are applied manually by David.

## Validation boundary

Local SQL checks use PostgreSQL/PGlite with minimal Supabase auth role/schema stand-ins. Browser tests simulate OAuth sessions and RPC responses. They cover user isolation, stale edits, lost responses, CRUD, backups, Steam import, themes, keyboard, offline reads, drafts and PWA updates. Live public project checks confirmed Google enabled (HTTP 200) and anonymous snapshot access denied (HTTP 401). David reported successful real Google login and adding a game. A hosted reload and cross-device write/read smoke test still need user confirmation before deployment.

## Local privacy checks

The pinned PostgreSQL WASM test engine is installed by `npm ci` as a dev dependency:

```sh
npm run test:database
```

PGlite is only for testing SQL locally. Production data will live in Supabase PostgreSQL.

## MCP access

After both library migrations, follow [MCP setup](../docs/mcp.md) to apply `202609140001_mcp_access.sql` and configure the OAuth token hook. This preserves the existing library and direct Google login.
