# Next Up MCP 🎮

Your AI app can read your library, suggest a game, and—with permission—manage individual games. Next Up uses your existing account. It does not call or bill an AI model.

## How it works

```text
You ask your AI → MCP tool → Cloudflare Worker → your Supabase library
                              checks token      checks permission + revision
```

MCP describes the tools and their inputs/outputs. OAuth lets you approve access without giving the AI your Google password. Supabase signs a token identifying your user and the connecting app; the Worker validates it, and the database checks a live permission before accessing your games.

| Tools | Access |
| --- | --- |
| `list_games`, `get_game`, `get_preferences` | Read |
| `recommend_games`, `search_catalog` | Read |
| `add_game`, `update_game`, `remove_game` | Read & edit |

Games support multiple devices and one shared status. Recommendations reuse Today’s rules. Neither catalog search nor recommendations infer ownership, Steam Deck compatibility, or session length. Notes and titles are data, never instructions.

## Configure Supabase (project owner, once)

Use the dedicated **Next Up** project. No service-role key is required.

1. In **SQL Editor → New query**, run [`202609140001_mcp_access.sql`](../supabase/migrations/202609140001_mcp_access.sql), after the two existing library migrations. It preserves game data, adds `mcp_connections`, and wraps existing RPCs with permission checks.
2. In **Authentication → Hooks → Custom Access Token**, select the Postgres function `public.next_up_mcp_token_hook`. This adds the MCP audience and connection generation to OAuth tokens. Google/web tokens remain unchanged. Do not replace an unrelated existing hook without merging its behavior.
3. In **Authentication → OAuth Server**, enable OAuth 2.1. Set **Authorization path** to `/oauth/consent`. Enable **Dynamic client registration** so compatible AI apps can register their callback URL. Registration alone grants no data access; users still sign in and approve.
4. In **Authentication → URL Configuration**, keep existing URLs and add `https://next-up.deivbid.workers.dev/oauth/consent` to **Redirect URLs**. Keep **Site URL** at `https://next-up.deivbid.workers.dev`. The redirect returns from Google login, not from the MCP client. OAuth client callbacks are registered separately by the client. Add `http://127.0.0.1:3030/oauth/consent` only if testing locally.
5. Confirm **JWT Signing Keys** has an active asymmetric key (ES256 or RS256). The existing Next Up project was verified to advertise ES256. Never copy a private signing key into the app.

Supabase derives the consent page from **Site URL + Authorization path**. For a fully local OAuth test, temporarily set Site URL to `http://127.0.0.1:3030`, use the local MCP endpoint, then restore the production Site URL before sharing. Existing production Google callbacks specify their redirect explicitly; do not alter their allowlist. For production testing, deploy the consent UI first and keep the production Site URL.

The hook allows this project's production URL and local port 3030. If self-hosting at another domain, change the `mcp_connections.resource` constraint in a new migration and configure `APP_ORIGIN` consistently.

## Configure the Worker

Set these server-side variables in `.dev.vars` locally and as Cloudflare Worker secrets for production:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

These are the same project URL/public key used by `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; they are not admin credentials. Existing Twitch/Steam secrets stay server-side.

Manual CLI steps (run inside this repo):

```sh
npx wrangler secret put SUPABASE_URL --config wrangler.production.jsonc
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config wrangler.production.jsonc
npm run build
npx wrangler deploy --config wrangler.production.jsonc
```

`secret put` applies a Worker version immediately. Use the personal Cloudflare account. No deployment is performed by the tests or by pushing Git. The build copies `public/.assetsignore` to exclude local design concepts. The deployment order is **SQL → hook → OAuth settings → Worker variables → build/deploy**. The web app keeps working before the MCP is configured; MCP requests fail closed with 503 or an authorization error.

## Connect an AI app

Open `/connect` for the user guide. In a client supporting remote MCP and OAuth, add:

```text
https://next-up.deivbid.workers.dev/api/mcp
```

Authorize with your Next Up account, then choose **Read only** or **Read & edit**. Try “What’s in my PS5 backlog?” or “I have 30 minutes and my Steam Deck.”

The endpoint uses Streamable HTTP with stateless handlers and legacy protocol compatibility. It publishes RFC 9728 resource metadata at `/.well-known/oauth-protected-resource/api/mcp`. A 401 response advertises that URL through `WWW-Authenticate`; metadata points to Supabase’s OAuth issuer. Client availability and pricing depend on the AI app. SSE-only clients are not supported. Browser-origin clients are limited to this app and loopback hosts; native/server clients normally send no Origin.

Remove access in **Settings → AI connections**. This first deletes the live database permission, then revokes Supabase’s OAuth grant and refresh sessions. Already issued tokens cannot access the library after the database removal, even before their JWT expiry. A request already executing may finish. Previously shared chat data cannot be recalled. To change read/write permission, remove and reconnect.

## Contracts and failure behavior

- JWT verification: fixed project JWKS, ES256/RS256, issuer, endpoint audience, expiry, user UUID, OAuth client UUID, grant generation and `authenticated` role. Never accept a web token, ID token, arbitrary issuer, URL token, or admin key as MCP authorization.
- The token is intentionally valid for both this MCP and the same project's Supabase Data API. Database RPCs derive ownership from `auth.uid()` and enforce the live client grant; no privileged token or arbitrary SQL tool exists.
- Single-game writes require an `expectedRevision` from a prior read. The existing PostgreSQL transaction lock and revision comparison reject stale/duplicate retries. Mutations are not automatically retried. After an uncertain response, read again before attempting a change.
- Read-only permissions also apply to direct database REST/RPC access. MCP tokens cannot administer connections, bulk-delete a library or edit preferences through the existing RPC.
- List responses page up to 50 games and omit notes. `get_game` returns the requested game's notes. Reuse `expectedRevision` while paging to detect a changed library.
- MCP requests are capped at 64 KiB; database responses at 16 MiB. Very large libraries exceeding that response limit must use the web app until server-side pagination is added.
- Requests share a 60/minute per-user limit (technical counters expire after two minutes). JWKS requests time out after 5 seconds; RPC work has a 15-second deadline. Provider search retains its existing 8-second timeout and rate limits.
- HTTP 401: reconnect; 403: insufficient/revoked permission; 409 tool error: reread before editing; 429: respect `Retry-After`; 502/503: unavailable or uncertain result. Provider error bodies, tokens and personal notes are not logged. No library response is cached publicly.
- Supabase owns PKCE verification, redirect registration, single-use authorization codes (default ten-minute lifetime), and refresh-token rotation. Its hosted build/rate-limit settings are not controlled by this repository.
- Consent response metadata such as client name, URI, logo and scope may be omitted by the provider. The UI accepts absent optional metadata, shows a fallback client name, and never approves unknown scopes silently. Runtime validation follows the provider response rather than the SDK's stricter metadata types.
- Codex requests `offline_access` alongside `openid`. Supabase's supported-scope implementation and the hosted authorization endpoint accept this standard scope. Consent explains it as staying connected between sessions; it does not grant library editing. Unknown scopes remain rejected.

## Test it

```sh
npm run typecheck
npm run lint
npm test
npm run test:worker
npm run test:mcp
npm run test:database
npm run build
npm run test:e2e
npm run test:pwa
```

`test:mcp` uses the official MCP client and a real local Worker with signed test JWTs and isolated Supabase/IGDB fixtures. `test:database` uses local PostgreSQL/PGlite installed with the dev dependencies. Browser tests simulate Supabase responses. These do not substitute for a hosted Google → consent → MCP roundtrip.

Manual acceptance after configuration: connect read-only, list your real games, disconnect and verify access fails; reconnect with editing, add a clearly named test game, edit it, confirm in the web app, and remove it. Check your original games and theme remain intact.

## Sources and limits

- [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase token security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Cloudflare MCP handler API](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

Supabase OAuth Server is **beta and free during beta**, not a promise of permanent free service. Review its terms before wider rollout. No new paid service or model subscription is created by Next Up.
