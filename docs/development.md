# Development

## Run it

Node 22.12+ and npm. Dependencies are pinned in the lockfile.

```sh
mkdir -p .local
touch .local/empty-npmrc
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null ci
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run build
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run preview
```

Before building, copy `.env.example` to `.env.local`, set the Supabase project URL and publishable key, and follow [Supabase setup](../supabase/README.md). Vite embeds these public values at build time. Never use a service-role or secret key in `VITE_*`.

Open **http://127.0.0.1:3030**. Start the optional API in another terminal:

```sh
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run worker:dev
```

For development, stop the preview and run `npm run dev` with the same config flags. Offline support and update prompts are tested against the production build. If you switch from a production preview to Vite development, unregister the service worker in browser developer tools first; this does not require deleting IndexedDB.

After signing in with Google, use **Try example library** to explore the design, or add your own games. Example preferences are illustrative and editable. Game cover art loads from Steam/IGDB; missing or unavailable artwork gets a placeholder.


## Check it

```sh
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run check
PLAYWRIGHT_BROWSERS_PATH=.local/browsers npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null exec playwright install chromium
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run test:e2e
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run test:pwa
```

`check` runs both TypeScript targets, lint, unit tests, Worker integration checks and the production build. Browser tests use a separate browser profile. PWA tests temporarily change the generated `dist/sw.js` to exercise an update and restore it afterward; run them without rebuilding concurrently.


## Existing Cloudflare deployment

The app and API share `https://next-up.deivbid.workers.dev`, configured in `wrangler.production.jsonc`. `dist` contains static assets; `/api/*` runs the Worker. `APP_ORIGIN` must match the public origin exactly. The AUTH binding and v1 migration match the already-deployed Durable Object.

After signing into your personal Cloudflare account with Wrangler, publish changes manually:

```sh
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run build
printf 'concepts/\n' > dist/.assetsignore
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null exec -- wrangler deploy --config wrangler.production.jsonc
```

The asset exclusion keeps local-only design references out of the upload. The production config contains no secrets: configure `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` and `STEAM_WEB_API_KEY` as Worker secrets. Git pushes do not deploy automatically in this setup.

Libraries now belong to a Supabase account. Open or refresh Next Up to read changes from another device. Writes require a connection; each account gets its own validated IndexedDB cache for offline reading while its session remains available. An expired session may require reconnecting. Signing out locally clears that account's cached library and draft. Browser data is not encrypted by this app.

The original `next-up` IndexedDB library is left untouched. Sign in on the original browser/origin, download its backup, and explicitly import it. Existing account games keep their edits. An account on another origin cannot discover that browser-local source; export/import JSON or sign in where the old library was saved first.

Browser tests simulate Supabase sessions and HTTP responses; SQL checks separately exercise actual PostgreSQL semantics through PGlite. They are not a live Google/Supabase end-to-end test. The fixture requires `VITE_SUPABASE_URL` in `.env.local` and never performs real authenticated writes. Run `node scripts/check-database.mjs` after installing the test-only tool documented in `supabase/README.md`.
