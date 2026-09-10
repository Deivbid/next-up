# Smoke test — September 10, 2026

Current status: the original app is live, and David reported successful Steam login/import. The cover-picker changes below are validated for a push to main; deployment remains manual. Earlier sections retain the initial prototype evidence.

## Initial prototype validation (historical)

**Ready to share as a source-code prototype.** No app has been deployed. Steam live authentication and real-phone installation remain unverified.

| Check | Result |
| --- | --- |
| TypeScript, ESLint, production build | Pass |
| Clean install/build | Pass: only public files, no secrets or local tooling required; matching CSS/JS asset hashes |
| Vitest | 13 passed: recommendations, provider validation, backup rejection/atomic rollback and repeated Steam import preservation |
| Worker integration | Pass: actual Worker + SQLite Durable Object with mocked providers; login state, discovery, signature verification, replay rejection, sessions and CSRF-safe logout |
| Playwright browser | 12 passed: add/edit/reload, wishlist/status, backup/restore/delete confirmation, keyboard, autocomplete cancellation/selection and manual fallback |
| Responsive + axe | Pass: both themes across Today, Library and Settings at 320, 390, 768 and 1440 px; editor and suggestion list checked; no reported axe violations or horizontal overflow |
| Production PWA | Passed: offline reload/edit persistence, draft recovery, update confirmation and protection of open forms |
| Live IGDB smoke | Passed: type a title → select a real catalog result → save → reload; no uncaught page errors |

All browser checks used isolated Chromium profiles. They do not establish real iOS/Android installation, Safari compatibility or a guarantee of 60 fps. No personal library was changed by the tests.

## Performance evidence

Earlier same-day Lighthouse measurements: mobile first opening 96 performance / 100 accessibility / 100 best practices / 91 SEO; desktop 100 / 100 / 100 / 91. A populated warm-return mobile run scored 100 / 100 / 100 / 92, with CLS 0 and TBT 0 ms. These measurements preceded the autocomplete change; they are historical evidence, not a fresh benchmark of this revision. A headless desktop navigation sample measured about 16.7 ms median/p95 per frame. Reduced motion disables nonessential animation.

The build still reports a roughly 535 kB uncompressed main JS chunk (165 kB gzip). Large real libraries and slow phones need further measurement. Lists show 48 records initially, with more available on demand.

## Build reproducibility fix

The clean-copy smoke exposed different CSS output from automatic Tailwind source scanning. `src/style.css` now explicitly scans the application source directory. Both the working project and a fresh public-file install produce identical CSS/JS asset hashes; CSS is 47.59 kB (10.17 kB gzip). Browser and offline tests were rerun against this final build.

## Limitations

- Data belongs to the browser origin/device. Export before changing addresses, clearing site data or moving to another device. Restore accepts validated JSON up to 10 MB / 20,000 games.
- IGDB title search is verified live. Token expiry, throttling and failures are covered by application logic/tests, not all reproduced against a real account.
- Steam is experimental: its provider adapter and import logic are tested with fixtures; actual HTTPS login, cookies and public/private/empty library responses need account acceptance. It stays disabled on the default HTTP preview.
- Manual entries without shared provider IDs cannot be safely matched to Steam by title. Steam categories/wishlist and Deck compatibility are not imported.
- Public source code does not imply a production-ready public API. Review deployment, quotas and provider terms before hosting.

## Staff pass: public source prototype

| Gate | Result | Evidence |
| --- | --- | --- |
| Decisions/scope | PASS | Local-first library, optional providers, no paid AI, no cloud sync; README discloses experimental Steam |
| Tree trace | PASS | Full initial implementation reviewed, grouped in `file-inventory.md`; public branch compared to README-only main |
| Imports/exports | PASS | App imports domain/data/provider owners; shadcn modules expose their component API |
| Reachable consumers | PASS | Today→recommend; editor→validated writes; Settings→backup/provider routes; import selection→transaction |
| Contracts/parity | PASS | Zod provider/backup validation, manual fallback; no live Steam capability claim |
| Lifecycle/security | PASS | Transaction rollback, browser isolation, one-use auth state, expiry cleanup, bounded image cache, abortable typeahead; private local artifacts excluded |
| Validation | PASS | Checks above, build, visual screenshots and publication file/secret audit |

**STAFF PASS: READY for the public prototype PR.** Steam HTTPS and real-phone acceptance are required before claiming those features as verified or deploying the app, not prerequisites for publishing the clearly labeled source prototype. Full development history and raw reports stay local.

## Steam cover picker — September 10, 2026

Local refinement only; the deployed Worker was not changed. David separately reported that live Steam sign-in and importing succeeded on his deployment.

- TypeScript (app + Worker), ESLint, 13 unit tests, Worker integration checks and production build passed. Worker checks use mocked providers.
- All 19 browser tests passed, including seven new Steam-picker checks: automatic scroll pagination, selection across search/page changes, empty results, missing artwork, keyboard/manual paging without IntersectionObserver, reopening reset, and re-import preserving saved notes/status after reload.
- Axe reported no violations for the importer in dark/light themes at 320, 390, 768 and 1440 px. Dialog content has no horizontal overflow, and import/cancel stay within the viewport. The accessibility scan waits for descendant transitions to finish, including the import button's disabled-to-enabled opacity transition.
- Inspected local screenshots with eight sample games and successfully loaded real Steam CDN covers, separately from deterministic browser fixtures: `.local/steam-real-desktop.png` and `.local/steam-real-mobile.png`. Also checked actions remain reachable at 844×390.
- Existing reduced-motion/browser regression tests passed. No new Lighthouse run or measured 60-fps claim. The previous >500-kB uncompressed chunk warning remains; this build's main JS is 536.52 kB / 164.92 kB gzip.
- Steam's provider implementation is external and not available for source inspection. Contract references: [official GetOwnedGames documentation](https://partner.steamgames.com/doc/webapi/IPlayerService?l=english), the current `worker/providers.ts` mapping, `shared/contracts.ts`, and `src/data/steam.ts`. The mapping supplies only ID/title. No endpoint, status/error mapping, headers, retry, timeout, session or storage behavior changed. Steam collections are not represented by this integration; artwork has a non-blocking fallback.

### Staff pass: READY (local refinement)

| Gate | Result | Evidence |
| --- | --- | --- |
| Decisions and scope | PASS | Current request and `docs/decisions.md`; visual import picker only |
| Individual / accumulated diff | PASS | Eight refinement files traced below; public inventory updated from 63 to 65 files; user's untracked production config excluded |
| Canonical imports/exports | PASS | No new re-exports; shared artwork helper owned by `src/data/steam.ts` and used by both import and picker |
| Reachable consumers | PASS | App mounts `SteamGamePicker`; observer/search/selection lifecycle exercised by browser tests |
| DTO/versioning | PASS | No wire contract or storage migration changes |
| Capability parity | PASS | Existing import preservation and missing-art fallback tested; Steam collections explicitly excluded |
| Triggered audits | PASS | Provider mapping/docs inspected; lifecycle, build, keyboard, responsive and accessibility checks above |

File trace: `src/App.tsx` wires the picker and import actions; `src/components/SteamGamePicker.tsx` owns the visual search/paging lifecycle; `src/data/steam.ts` shares the established cover URL; `src/style.css` defines responsive importer layout; `tests/browser/steam.spec.ts` exercises the user flows; `docs/decisions.md`, `docs/file-inventory.md` and this report record scope and evidence. No new dependencies, provider pagination, virtualized list, Steam collection synchronization or deployment machinery. No blockers or deferred correctness work.


## Pre-push Staff pass — main, September 10, 2026

**STAFF PASS: READY.** Rechecked the final code against main after David requested the push. TypeScript, lint, 13 unit tests, Worker integration, all 19 browser tests and the production PWA test passed again. Production build and Wrangler's production-config dry run passed. The current public root returned HTTP 200; no deployment was performed.

| Gate | Result | Evidence |
| --- | --- | --- |
| Decisions / scope | PASS | Push requested by David; latest picker plus existing production setup recorded |
| Individual / accumulated diff | PASS | 12/12 files traced; HEAD matches fetched origin/main before committing; no unmerged feature stack |
| Canonical exports | PASS | Artwork helper has two direct consumers; no new re-exports |
| Reachable consumers / lifecycle | PASS | Picker mounts inside the dialog; search/reset, scroll fallback and selected imports covered |
| DTO / versioning | PASS | No API or IndexedDB changes; AUTH binding and v1 migration match existing deployment |
| Capability parity | PASS | Existing imports preserve edits; collections/sync remain excluded and documented |
| Triggered audits | PASS | Consumer/provider mapping, image fallback, responsive/axe checks, Worker dry run and public-file/secret scan |

The eight picker-refinement files are traced above. Four additional files preserve the current deployment context: `wrangler.production.jsonc` records the user-created config without secrets; `docs/development.md` explains manual deployments, local asset exclusion and browser persistence; `docs/integrations.md` records user-reported live Steam acceptance; `README.md` links the running app and removes the outdated undeployed claim. No deployment automation or account credentials are added. No blockers or deferred correctness work.
