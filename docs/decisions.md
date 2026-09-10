# Decision ledger

Source: David's approved first-version plan and visual approval, September 10, 2026.

| Decision | Implementation | Exclusions |
| --- | --- | --- |
| Visual direction approved | Graphite/lime, dark default, light option, cover-led library | No portfolio-purple requirement |
| Mobile-first PWA | React/Vite, semantic navigation, transform/opacity transitions, reduced motion | Native stores |
| Local-first library | Dexie games/preferences stores; optional per-tab recovery draft | Required account, cloud sync |
| Recommendations | Owned Backlog/Playing/Paused games; explicit device; optional genre; session preference ranking | Paid AI, inferred Deck compatibility, total-length/session inference |
| Backup | Zod validation before mutation; unique IDs; 10 MB / 20,000-game limit; confirmed atomic restore | Silent replacement, importing unknown fields |
| Optional providers | IGDB POST search; official Steam OpenID + GetOwnedGames; manual fallback | PSN, Nintendo, offers |
| Steam refresh | User selects records, transaction skips existing Steam IDs, preserves all edits | Importing Steam categories, provider refresh deleting local games |
| Server | Worker + one SQLite Durable Object for technical state and rate limits | Stored libraries, notes or analytics |
| Isolation | Local skill copies, public npm registry/cache, local browser binaries and Wrangler config/logs | Global or work configuration changes |
| Delivery | Working local app; IGDB verified; Steam requires live HTTPS acceptance | Deployment, paid resources, automatic subscriptions |

## State lifecycle

- **IndexedDB:** `next-up`, owned by browser origin; games indexed by ID/provider IDs, ownership and status. Dexie `version(1)` is its required database migration declaration, not a speculative wire-contract version.
- **Draft:** optional sessionStorage record for this tab; updated while editing, restored after reload, removed on save or deliberate discard. Browser storage failures cannot block a normal IndexedDB save.
- **Backup:** runtime validation strips nothing silently; unsupported/duplicate records fail before the transaction. A failed write rolls back games and preferences together.
- **Technical server state:** hashed login/session identifiers; login state 10 minutes, consumed once; nonce rejection window ±5 minutes with 10-minute replay retention; session 24 hours. Expired values fail reads immediately, cleanup runs on requests and a bounded alarm while records remain.
- **Rate limit:** global 350 ms request spacing, six concurrent requests, 5,000 admitted provider-route requests/day. Conservative protection for this personal prototype; not a multi-tenant public service quota system.
- **Provider I/O:** one 8-second deadline for the route's provider work, no automatic retries. Redirects are rejected. IGDB access token lives in Worker memory until expiry; authentication failures invalidate it for the next manual attempt.
- **PWA:** bounded cover cache (120 entries / 30 days), app assets precached; API paths excluded from offline navigation fallback. Update activation requires a click and waits for the current form to close. Draft recovery protects edits on reload.

## Validation boundary

The local UI, persistence, backups, offline/update behavior and Worker with mocked providers are implemented and tested. Live IGDB title search has been verified. Steam account permissions, secure-cookie behavior with an HTTPS origin and real-phone installation remain acceptance checks before claiming those capabilities or deploying the app. The source repository may be published as a prototype with these limitations disclosed.
