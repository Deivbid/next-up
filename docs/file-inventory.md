# Public source inventory

66 source files in this inventory. The initial prototype is merged into main; this update adds the visual Steam picker and records the existing production configuration.

## Root configuration and documentation (18)

- `.dev.vars.example`
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

## docs (6)

- `docs/decisions.md`
- `docs/development.md`
- `docs/file-inventory.md`
- `docs/integrations.md`
- `docs/tooling.md`
- `docs/validation.md`

## public (3)

- `public/icon-192.png`
- `public/icon-512.png`
- `public/icon.svg`

## scripts (1)

- `scripts/check-worker.mjs`

## shared (1)

- `shared/contracts.ts`

## src (28)

- `src/App.tsx`
- `src/components/Cover.tsx`
- `src/components/GameEditor.tsx`
- `src/components/SteamGamePicker.tsx`
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
- `src/data/db.ts`
- `src/data/demo.ts`
- `src/data/draft.ts`
- `src/data/steam.ts`
- `src/domain/game.ts`
- `src/domain/recommend.ts`
- `src/lib/utils.ts`
- `src/main.tsx`
- `src/style.css`
- `src/vite-env.d.ts`

## tests (6)

- `tests/browser/app.spec.ts`
- `tests/browser/catalog.spec.ts`
- `tests/browser/steam.spec.ts`
- `tests/pwa/offline.spec.ts`
- `tests/unit/library.test.ts`
- `tests/unit/providers.test.ts`

## worker (2)

- `worker/index.ts`
- `worker/providers.ts`

Secrets, local databases/caches, browser profiles, skill bundles, reference images and build output are excluded by `.gitignore`.
