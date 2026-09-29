# Public source inventory

97 repository files, including the authenticated app and MCP integration. Local secrets, installed skills, reference material and build output are excluded.

## Root configuration and documentation (19)

- `.dev.vars.example`
- `.env.example`
- `.gitignore`
- `.npmrc`
- `README.md`
- `THIRD_PARTY_NOTICES.md`
- `components.json`
- `eslint.config.js`
- `index.html`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `playwright.pwa.config.ts`
- `tsconfig.json`
- `tsconfig.worker.json`
- `vite.config.ts`
- `vitest.config.ts`
- `wrangler.jsonc`
- `wrangler.production.jsonc`

## design (1)

- `design/DESIGN.md`

## docs (7)

- `docs/decisions.md`
- `docs/development.md`
- `docs/file-inventory.md`
- `docs/integrations.md`
- `docs/mcp.md`
- `docs/tooling.md`
- `docs/validation.md`

## public (6)

- `public/.assetsignore`
- `public/_headers`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/icon.svg`
- `public/landing-today.jpg`

## scripts (3)

- `scripts/check-database.mjs`
- `scripts/check-mcp.mjs`
- `scripts/check-worker.mjs`

## shared (3)

- `shared/contracts.ts`
- `shared/library.ts`
- `shared/mcp.ts`

## src (40)

- `src/App.tsx`
- `src/components/AccountGate.tsx`
- `src/components/AiConnections.tsx`
- `src/components/BrandLoader.tsx`
- `src/components/ConnectGuide.tsx`
- `src/components/Cover.tsx`
- `src/components/GameEditor.tsx`
- `src/components/HeroArtwork.tsx`
- `src/components/Landing.tsx`
- `src/components/OAuthConsent.tsx`
- `src/components/SteamGamePicker.tsx`
- `src/components/brand-loader.css`
- `src/components/landing.css`
- `src/components/ui/alert.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/empty.tsx`
- `src/components/ui/field.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/native-select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/toggle-group.tsx`
- `src/components/ui/toggle.tsx`
- `src/data/backup.ts`
- `src/data/cloud-library.ts`
- `src/data/db.ts`
- `src/data/demo.ts`
- `src/data/draft.ts`
- `src/data/mcp-connections.ts`
- `src/data/steam.ts`
- `src/data/supabase.ts`
- `src/domain/game.ts`
- `src/domain/recommend.ts`
- `src/lib/utils.ts`
- `src/main.tsx`
- `src/style.css`
- `src/vite-env.d.ts`

## supabase (4)

- `supabase/README.md`
- `supabase/migrations/202609110001_library.sql`
- `supabase/migrations/202609110002_library_operations.sql`
- `supabase/migrations/202609140001_mcp_access.sql`

## tests (10)

- `tests/browser/account.spec.ts`
- `tests/browser/app.spec.ts`
- `tests/browser/catalog.spec.ts`
- `tests/browser/hero.spec.ts`
- `tests/browser/mcp.spec.ts`
- `tests/browser/steam.spec.ts`
- `tests/helpers/cloud.ts`
- `tests/pwa/offline.spec.ts`
- `tests/unit/library.test.ts`
- `tests/unit/providers.test.ts`

## worker (4)

- `worker/env.d.ts`
- `worker/index.ts`
- `worker/mcp.ts`
- `worker/providers.ts`
