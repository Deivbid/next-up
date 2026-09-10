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

Open **http://127.0.0.1:3030**. Start the optional API in another terminal:

```sh
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run worker:dev
```

For development, stop the preview and run `npm run dev` with the same config flags. Offline support and update prompts are tested against the production build. If you switch from a production preview to Vite development, unregister the service worker in browser developer tools first; this does not require deleting IndexedDB.

Use **Try example library** to explore the design, or add your own games. Example preferences are illustrative and editable. Game cover art loads from Steam/IGDB; missing or unavailable artwork gets a placeholder.


## Check it

```sh
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run check
PLAYWRIGHT_BROWSERS_PATH=.local/browsers npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null exec playwright install chromium
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run test:e2e
npm --userconfig=.local/empty-npmrc --globalconfig=/dev/null run test:pwa
```

`check` runs both TypeScript targets, lint, unit tests, Worker integration checks and the production build. Browser tests use a separate browser profile. PWA tests temporarily change the generated `dist/sw.js` to exercise an update and restore it afterward; run them without rebuilding concurrently.
