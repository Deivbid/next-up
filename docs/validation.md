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


## Supabase account integration — 2026-09-11

Local delivery, not deployed. TypeScript, lint, 13 unit checks and the Worker protocol harness passed. PostgreSQL/PGlite passed 66 ownership, integrity, revision and atomic-operation checks. The 25 browser scenarios passed using simulated Supabase sessions/RPC; the six account scenarios and PWA offline/draft/update scenario were repeated successfully after the final image/lazy-route optimization. Desktop and mobile screenshots were inspected; axe reported no violations in the tested views/themes at 320–1440 px.

Lighthouse mobile simulation on the anonymous local production landing: Performance **88**, Accessibility **100**, Best Practices **100**, SEO **92**. The initial run scored 67 for performance; reducing the screenshot and deferring the authenticated App chunk improved it. These are local lab results, not a guarantee of frame rate or deployed performance. Raw reports are local-only `.local/auth-lighthouse.json` and `.local/auth-lighthouse-final.json`. The build retains a raw-chunk-size advisory.

A read-only check against the configured hosted project confirmed Google enabled (200) and anonymous library RPC access denied (401). David reported successful execution of both SQL migrations. David subsequently reported successful real Google login and adding a game. Hosted reload and two-device smoke testing still need user confirmation before publication. The browser suite is not represented as live OAuth end-to-end coverage.


## Profile and loading refinement — 2026-09-11

Moved email, refresh and logout into Settings → Profile. Save failures and legacy-import notices remain visible across views; failed cloud requests offer a contextual retry. Shared Next Up loading artwork uses the existing gamepad icon and CSS transform/opacity animation, disabled for reduced motion. No persistence, OAuth or provider contract changes.

TypeScript production build and lint passed. All 27 browser tests passed, including profile visibility, theme persistence into a second simulated device, delayed loading, reduced motion, axe and both themes at 320–1440 px. The production PWA offline/draft/update test passed. Inspected `.local/profile-light-mobile.png` and `.local/brand-loading-mobile.png`. The account provider is simulated in browser tests; no new claim of real cross-device validation or guaranteed 60 FPS. Changes remain local.

## Panoramic hero B — 2026-09-11

Implemented the selected B layout: landscape art on desktop, art above content on mobile, full-cover fallback. No account or library mutations. Production build/types/lint, 14 unit tests, Worker protocol tests, all 32 browser tests and the PWA offline/update test passed. Browser checks cover image failure, absent/invalid artwork, saved-game preservation, mobile ordering, keyboard/axe and both themes at 320–1440 px. Worker fixtures verify exact ID queries, auth headers, invalid-input rejection without upstream calls, public success caching, no-store errors and Retry-After propagation. Browser provider responses are simulated; actual Steam artwork was inspected separately in `.local/hero-b-{theme}-{width}.png`.

Live read-only local Worker checks against IGDB returned HTTP 200 with landscape art for game IDs 159119 and 37, and null for 131931. No production deployment. Existing build chunk advisory remains; no guaranteed frame-rate claim.

## Pre-push Staff pass — September 11, 2026

**STAFF PASS: READY.** David approved the current authenticated app and selected hero B, then requested a direct push to main. Reviewed both the 12-file final refinement and the 39-file accumulated change since origin/main, including the previously committed Supabase implementation. The first final browser run exposed a missing h1 in the full-page loading fallback; added a visually hidden heading to all three loading entry points and reran the complete application checks successfully.

| Gate | Result | Evidence |
| --- | --- | --- |
| Decisions/scope | PASS | Approved Google/account flow, Settings Profile, animated logo and hero B; no new service or deployment automation |
| Individual/accumulated diff | PASS | 12/12 and 39/39 files traced; origin/main fetched; no rebase required |
| Canonical imports/consumers | PASS | AccountGate → App → CloudLibrary/RPC; Today → HeroArtwork → optional artwork endpoint; direct imports |
| DTO and capability parity | PASS | Derived artwork metadata does not alter Game/backups; account isolation, legacy import, stale edits and failure recovery exercised |
| Provider/lifecycle | PASS | Documented IGDB/Steam contracts, live artwork responses, Worker mappings; SQL ownership and transaction semantics; request abort/cache ownership reviewed |
| Validation | PASS | Types, lint, 14 unit tests, Worker harness, 66 PostgreSQL/PGlite checks, 32 browser tests, production PWA test and Wrangler dry run |
| Privacy/rollout | PASS | No secret-pattern matches in outgoing files; env secrets/private previews ignored; production asset exclusion validated; manual deployment retained |

Trace groups: auth SDK/config, AccountGate/Landing/loaders/styles, cloud controller and editor/draft/Steam adapters implement the approved account flow; two SQL migrations and database harness enforce ownership and atomic updates; HeroArtwork/App/style and Worker/contracts provide the approved panorama; test fixtures/specs verify those behaviors; README/development/integrations/Supabase docs and this report record reproducibility and limits. `public/landing-today.jpg` is the public sample-library screenshot. Detailed local inventories remain outside the repository.

David reported real Google sign-in, adding a game and subsequent successful local app use. Automated account transport remains simulated; no independent hosted two-device result is claimed. The production HTTP probe returned 403 in this tool environment, so it does not establish live UI status. The repository has no deployment workflow/checks and its documented Cloudflare flow is manual: pushing source is separate from publishing. The build retains its non-blocking bundle-size advisory. No paid services, new secrets, deployment, database changes or unrelated repository writes were performed in this push step.

## MCP local implementation — September 14, 2026

Implemented eight remote MCP tools, explicit read/read-and-edit consent, Settings revocation and the public `/connect` guide. Existing multiple-device games, shared status, Google login, Steam import and library revision semantics are preserved. No AI model service, new hosting provider, automatic deployment or bulk-delete tool was added.

Local evidence:

- `npm run check` passed: app/Worker TypeScript, ESLint, 14 unit tests, existing Worker provider harness, 50 MCP checks using the official SDK client and a real local Worker, 94 PostgreSQL/PGlite checks, and production build.
- The full 38-scenario browser regression passed. After adjusting optional OAuth metadata to match Supabase's implementation, all eight final MCP browser scenarios passed, including two additional cases for omitted metadata/failed permission saves and unsupported scopes. These use simulated provider sessions, not a hosted OAuth roundtrip.
- Axe and overflow checks passed at 320, 390, 768 and 1440 px; consent is keyboard operable and defaults to read-only. Settings connections were checked in both themes. Inspected desktop/mobile guide and mobile consent screenshots stored under `.local/`. Motion uses existing reduced-motion rules.
- Production PWA offline/draft/update test passed. No new Lighthouse or measured frame-rate claim. The current initial JS chunk is about 706 kB / 208 kB gzip; its existing size advisory remains.
- Wrangler production-config dry run passed (Worker 1437 KiB / 263 KiB gzip). A separate local run of that config verified `/oauth/consent` has `frame-ancestors 'none'`, `X-Frame-Options: DENY` and `Cache-Control: no-store`. Private concept files are excluded by the built `.assetsignore`; a concept URL returns only the app fallback.
- Through the real local frontend proxy, `/connect` returns 200, resource metadata returns 200 JSON, and unauthenticated `/api/mcp` returns 401 with `WWW-Authenticate` discovery. Local servers were restarted with the new proxy and server-side public Supabase configuration.
- No configured credential values were found in outgoing source files. All dependency lockfile URLs use the public npm registry. Secrets, provider source checkout, skills and test artifacts remain ignored. No hosted database write, deployment, commit or push was performed.

Provider audit: inspected the existing Next Up consumer, SQL migrations, tests, installed SDKs, official MCP/Cloudflare/Supabase documentation and Supabase Auth implementation at `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`. Verified endpoint methods, consent auto-approval behavior, single-use codes/PKCE locks, token-hook input, optional response fields, grant revocation and refresh-session deletion. Application-level grants enforce revocation before JWT expiry; fixed issuer/audience/JWKS validation and existing atomic revisions prevent cross-user access and stale writes. Timeout, retry and error contracts are recorded in [`mcp.md`](mcp.md). Hosted provider version/settings and the final client roundtrip remain unverified.

### Staff pass — release acceptance pending

**STAFF PASS: NOT READY for release.** Local implementation and deterministic checks pass. The required hosted SQL/hook/OAuth configuration and Google → consent → MCP → revocation roundtrip still need David's manual setup and joint validation. This is an explicit release blocker, not a completed capability claim or an excuse to bypass the gate. No push or review is requested.

| Gate | Result | Evidence | Exception |
| --- | --- | --- | --- |
| Decisions and scope | PASS | Approved MCP, existing platforms/shared progress, no paid model API or auto-deployment | None |
| Individual / accumulated diff | PASS | 33/33 changed or new files traced below against main `fd9b2d1`; no branch stack | None |
| Canonical imports / exports | PASS | Shared snapshot/schema owners; direct consumers; no new re-export barrels | None |
| Reachable consumers | PASS | Worker route → MCP server → existing RPC/catalog/recommender; landing/consent/Settings → account transport, tested | None |
| DTO / versioning | PASS | Existing Game/backups unchanged; OAuth metadata validated against provider; SQL migration adds grant checks without replacing user data | None |
| Capability parity | PASS | Existing browser/PWA/SQL regression; unsupported clients and bulk operations documented | None |
| Activated audits | FAIL for release | Local checks above pass; hosted OAuth configuration and final real-client acceptance pending | None |

File trace: `.dev.vars.example`, `package.json`, `package-lock.json`, `vite.config.ts`, `wrangler.production.jsonc`, `worker/env.d.ts`, `public/_headers` and `public/.assetsignore` provide runtime/dependency/asset configuration; `worker/index.ts` and `worker/mcp.ts` implement routing, limits and tools; `shared/library.ts`, `shared/mcp.ts` and `src/data/cloud-library.ts` own shared contracts; `202609140001_mcp_access.sql` enforces user/client grants; `src/data/mcp-connections.ts`, `AccountGate.tsx`, `AiConnections.tsx`, `OAuthConsent.tsx`, `ConnectGuide.tsx`, `Landing.tsx`, `src/main.tsx` and `src/style.css` connect consent and documentation to the UI; `scripts/check-{database,mcp,worker}.mjs`, `tests/browser/mcp.spec.ts` and `tests/helpers/cloud.ts` verify provider/storage/browser behavior; `README.md`, `supabase/README.md`, `docs/{mcp,development,file-inventory,validation}.md` document setup, boundaries and evidence. SDK/JWT and local PostgreSQL dependencies each have exercised consumers; no unused service integration was added.

### Controlled production deployment — September 14, 2026

David confirmed successful SQL execution, showed the enabled `next_up_mcp_token_hook`, enabled OAuth Server/dynamic registration, and then explicitly chose production testing instead of a local OAuth roundtrip. This supersedes the earlier local-first rollout decision. Public Supabase discovery and ES256 JWKS return 200. Production consent redirect allowlisting was requested; confirmation is still pending.

Rebuilt the unchanged application and reran the production dry run successfully. Verified Wrangler's personal account and existing deployment, then uploaded the build and the two Supabase public configuration bindings together, preserving other variables/secrets. Worker `next-up` version **65b03ccd-e4cc-47cc-894f-5bdb7d2dfc33** is deployed at `https://next-up.deivbid.workers.dev`. Previous Worker version: `d7c08cd2-25ac-4019-8db9-a4fcbc93767c`; rolling back Worker code would not undo the separately applied SQL/hook. The temporary owner-only variables file was removed after upload. No Git commit or push was performed.

Production smoke: landing, `/connect` and `/oauth/consent` return the current build (200); consent returns no-store and anti-framing CSP; MCP resource discovery returns the production resource/issuer (200); unauthenticated MCP calls correctly return 401 with discovery; `/api/providers` reports catalog and Steam configured. A fresh unsigned-in Playwright browser rendered the guide at 390/1440 px without overflow, displayed Google sign-in on the landing, and recorded no uncaught page errors. Screenshot: local-only `.local/mcp-production-guide.png`.

Authenticated production acceptance is **still pending**, so the previous NOT READY verdict for full release acceptance is not relabeled as complete. Next: confirm the production Google return allowlist, connect through an OAuth-capable MCP client, exercise read-only access and revocation, then opt into editing and add/edit/remove one disposable test game. Existing library data must remain intact. This controlled deployment is the user-requested environment for completing that acceptance, not proof that it already passed.

### Codex connection compatibility — September 14, 2026

Registered the user-requested `next-up` MCP server in Codex and initiated its real OAuth flow. Codex adds `offline_access` even when `openid` is explicitly requested. Supabase's `internal/models/oauth_scope.go` lists it as supported, and the hosted authorize endpoint returned a valid consent redirect. Our consent UI incorrectly rejected it. Added only that standard scope and a visible explanation (“stay connected between sessions”), preserving read-only defaults, database grants and rejection of unknown scopes.

TypeScript, lint, production build, all eight focused browser consent/settings scenarios and the production dry run passed. The consent fixture now uses Codex's actual `openid offline_access` combination and asserts its explanation is visible. Published the small compatibility fix as Worker version **69d5e21b-3086-4455-8c4c-996c484270da**, preserving configured variables/secrets. No database change, Git commit or push. User Google sign-in/consent and the authenticated MCP roundtrip are still pending; adding the configuration alone is not recorded as successful authorization.

## 2026-09-28 — Multiple playing games and popular catalog

**STAFF PASS: READY — scoped to this task's delta against the preserved starting tree.** The checkout already contained uncommitted MCP/auth work; this is not a new approval of that whole accumulated diff. No commit, push or deployment was performed.

Decision ledger: show every owned Playing game, including several on one platform; preserve the single-game panoramic hero; offer up to 20 popular IGDB titles before searching. No new account setup, schema migration, dependencies, personalized ranking, ownership assumptions or library writes from catalog requests. Existing search/manual-entry behavior is retained.

| Gate | Result | Evidence |
| --- | --- | --- |
| Decisions and scope | PASS | 10/10 task files traced below; task-only diff saved in ignored `.local/sept28-task.diff` against the pre-edit snapshot |
| Diff individual/accumulated | PASS for task delta | Starting dirty files preserved; no commit/base rewrite; `git diff --check` passes |
| Canonical imports/exports | PASS | No new exports, dependencies or component layers |
| Reachable consumers | PASS | App renders the full Playing array; editor consumes `/api/catalog/popular`; tests cover selection/save and independent status changes |
| DTO/versioning | PASS | Reuses catalog schema; popularity IDs validated before query interpolation; ordering/deduplication verified |
| Capability parity | PASS | Single hero, debounced search, manual entry, editor cancellation and unavailable-provider fallback remain covered |
| Risk audits | PASS | Worker/provider contract, public cache lifetime, cancellation/races, accessibility, themes and responsive layouts verified |

File trace: `src/App.tsx` and `src/style.css` render the active-game grid; `src/components/GameEditor.tsx` loads popular titles and switches to search; `worker/index.ts` adapts IGDB ranking and caches its public response; `scripts/check-worker.mjs` covers ranking order, duplicates, empty/malformed responses, 401/429/500 mapping and cache hits; `tests/browser/catalog.spec.ts` covers opening without typing, scrolling, keyboard selection, save, late responses and fallback; `tests/browser/hero.spec.ts` covers multiple games across/shared platforms, independent edits/reload and both themes; `tests/helpers/cloud.ts` isolates default catalog traffic; `docs/integrations.md` and this log describe the verified behavior.

Validation: TypeScript, ESLint, 14 unit tests, real Worker/DO integration checks with mocked outbound providers, production build, and **45 Playwright tests passed**. Browser checks include 320/390/768/1440 px, both themes, axe, keyboard, catalog races and existing auth/Steam/MCP flows. The initial browser launch required running Chromium outside the macOS sandbox; the final suite used a restarted Vite server to avoid stale transforms. A pre-existing hero test now allows StrictMode's initial aborted request and uses a deterministic cover fixture.

Live provider smoke: local Worker returned 200 with 20 catalog games using the existing server-only credentials. No account data was changed during the live smoke. Screenshots in ignored `.local/playing-{dark,light}-{desktop,mobile}.png` and `.local/popular-mobile.png` were visually inspected; browser fixtures use placeholder artwork. Build succeeds with its existing >500 kB main-chunk advisory. No new performance/FPS claim is made.

Follow-ups: none required for these two behaviors. Production deployment remains a separate action.

## 2026-09-29 — Accumulated release acceptance

**STAFF PASS: READY.** This pass covers the complete 38-file working-tree delta against fetched `origin/main`, including the MCP/OAuth delivery and the September 28 UI improvements. David completed the hosted Supabase SQL, token hook and OAuth Server configuration, connected Codex through the production consent flow, and subsequently used the authenticated MCP tools to read and make requested changes to his real library. That production acceptance supersedes the earlier pending status; revocation remains covered by the database, MCP and browser harnesses.

| Gate | Result | Evidence |
| --- | --- | --- |
| Decisions and scope | PASS | MCP/OAuth, public setup guide, explicit connection management, all Playing games, and IGDB popular discovery are the approved accumulated delivery; no unrelated service or speculative capability was added |
| Diff individual/accumulated | PASS | 38/38 modified or new files traced by the two delivery sections above; fetched `origin/main` matches local HEAD before commit; `git diff --check` passes |
| Canonical imports/exports | PASS | Shared library and OAuth schemas have direct consumers; no convenience barrels or preventive version fields |
| Reachable consumers | PASS | Web consent/Settings, Worker MCP route, database grant functions, catalog route, active-game grid and editor are all exercised by integration or browser tests |
| Contracts and lifecycle | PASS | JWT issuer/audience/grant validation, RLS/RPC permissions, atomic library revisions, revocation, bounded payloads, provider timeouts/rate limits and cache ownership are verified |
| Capability parity | PASS | Existing Google login, cloud library, manual/catalog add, Steam import, backup/restore, single-game hero and PWA behavior remain covered |
| Activated audits | PASS | Security boundary, provider mapping, copy/UI, production build, responsive/axe, offline behavior, Worker packaging and secret/public-file scans completed |

Current evidence: `npm run check` passed TypeScript, ESLint, 14 unit tests, 20 mocked provider calls, 50 MCP checks with the official SDK client, 94 PostgreSQL/PGlite checks and the production build. All **45 Playwright browser tests** passed after launching Chromium outside the macOS sandbox, and the production PWA scenario passed. Wrangler production dry run packaged 26 assets and a 1439 KiB Worker (264 KiB gzip). `npm audit --omit=dev` found 0 vulnerabilities. The known 706 KiB initial JavaScript chunk advisory remains non-blocking; no new Lighthouse or 60 FPS claim is made.

No configured secret is tracked: `.dev.vars`, `.env.local`, browser artifacts and `.local/` remain ignored. Production publication is the authorized next action; the source push and Cloudflare Worker deployment are separate steps.
