# Connect personal credentials

Credentials are optional and supplied only through your ignored local `.dev.vars` file. Manual entry, organization, backups and recommendations already work without them. Do not paste secrets in chat or use a `VITE_` variable for a secret.

## 1. IGDB / Twitch

1. Open the [Twitch developer console](https://dev.twitch.tv/console/apps) with your personal account; enable 2FA if requested.
2. Register an application, choose **Confidential** and use the local redirect requested by the form (IGDB does not use that redirect; its docs suggest localhost).
3. Copy the Client ID and generate a Client Secret.
4. In this project, copy `.dev.vars.example` to `.dev.vars`. Fill `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` **locally**. This file is ignored by Git.
5. Restart `npm run worker:dev` using the README's isolated npm flags. With the app at `http://127.0.0.1:3030`, Settings should show the catalog configured. Search for a game and verify the results before relying on the integration.

The Worker requests a client-credentials token, then calls `https://api.igdb.com/v4/games` with Client-ID/Bearer headers. IGDB does not allow direct browser CORS requests. Its documented rate limit is 4 requests/second and 8 concurrent requests; this implementation deliberately stays below those limits. Usage remains subject to IGDB/Twitch terms.

[IGDB docs](https://api-docs.igdb.com/) · [Twitch token flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow)

## 2. Steam

1. Get a personal Web API key from [Steam's developer page](https://steamcommunity.com/dev).
2. Set `STEAM_WEB_API_KEY` in the ignored `.dev.vars` file.
3. **Steam login stays disabled on the current HTTP preview.** Before testing it, configure an HTTPS app origin in `APP_ORIGIN`, with `/api/*` routed to the Worker on the same origin. The existing deployment uses `https://next-up.deivbid.workers.dev`; see the manual deployment instructions in [Development](development.md).
4. Use **Connect Steam** in Settings, sign in on Steam's official page, then select games to import.
5. Check a repeated import after editing a game: its title, status, notes, devices and categories must remain unchanged.

A successful identity login does not grant access to a private game library. GetOwnedGames requires game details visible to the caller. Private, malformed or partial responses produce an error rather than a successful empty import. An explicit zero-game response is supported.

[Steam GetOwnedGames](https://partner.steamgames.com/doc/webapi/IPlayerService) · [OpenID verification](https://openid.net/specs/openid-authentication-2_0.html) · [Steam terms](https://steamcommunity.com/dev/apiterms)

## Verified boundaries

Consumer: this browser app. Provider adapter: `worker/index.ts` / `worker/providers.ts`. Third-party source code is not available; official docs are the upstream source of truth. Steam's XRDS discovery response was also inspected and matched its documented OpenID endpoint. Live IGDB title search was verified locally. David reported successful live Steam sign-in and importing on September 10, 2026. Public/private/empty-library edge cases remain covered with fixtures rather than a full live-account matrix.

| Route | Behavior |
| --- | --- |
| GET `/api/providers` | Configured/connected booleans; no tokens or Steam ID returned |
| GET `/api/catalog?q=…` | Validated neutral catalog DTO; no local mutation |
| GET `/api/steam/login` | Official Steam redirect, browser-bound one-use state, secure cookie |
| GET `/api/steam/callback` | Checks return URL, provider-owned claimed ID, signed fields, nonce, XRDS discovery and direct verification; creates a 24-hour session |
| GET `/api/steam/library` | Authenticated validated import candidates; selected games are saved to the signed-in Supabase account |
| POST `/api/steam/logout` | Requires exact Origin and custom header; clears server session and cookie |

Responses are no-store, with no permissive CORS. Login/session cookies are HttpOnly, Secure, SameSite=Lax and host scoped. Nonces and state are consumed before provider verification so an interrupted attempt must start again. Redirecting upstream requests are rejected with manual redirect handling compatible with the Worker runtime.

Unconfigured features return 503; missing session 401; invalid callbacks 400; invalid origin 403; rate limits 429 with Retry-After; provider/decode errors 502; deadline expiry 504. There are no automatic retries. Numeric upstream Retry-After is retained; absent or unsupported forms use a conservative 60-second value. No upstream Retry-After header shape has been observed with personal credentials yet.

Local Worker verification uses Miniflare with the real Worker and Durable Object, while all outbound providers are mocked. It proves application validation and state handling, **not live Steam authentication**.
