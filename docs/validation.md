# Smoke test — September 10, 2026

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
