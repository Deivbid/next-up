import { test as base, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { defaultPreferences } from "../../src/domain/game";
import type { LibrarySnapshot } from "../../shared/library";
export const userId = "11111111-1111-4111-8111-111111111111";
const env = readFileSync(".env.local", "utf8");
export const apiUrl = env
  .split("\n")
  .find((s) => s.startsWith("VITE_SUPABASE_URL="))!
  .split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^["']|["']$/g, "");
export type MockCloud = Map<string, LibrarySnapshot>;
export async function mockCloud(
  context: BrowserContext,
  store: MockCloud = new Map(),
  id = userId,
) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "player@example.com",
    app_metadata: { provider: "google" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token =
    [
      { alg: "HS256", typ: "JWT" },
      {
        sub: id,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".") + ".test-signature";
  await context.addInitScript(
    ({ key, session, id }) => {
      if (!sessionStorage.getItem(`test-auth-initialized:${id}`)) {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem("next-up-steam-owner", id);
        sessionStorage.setItem(`test-auth-initialized:${id}`, "1");
      }
    },
    {
      key: `sb-${new URL(apiUrl).hostname.split(".")[0]}-auth-token`,
      session: {
        access_token: token,
        refresh_token: "test-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user,
      },
      id,
    },
  );
  await context.route(`${apiUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/v1/user") return route.fulfill({ json: user });
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (path === "/rest/v1/rpc/next_up_read_library")
      return route.fulfill({
        json: store.get(id) ?? {
          games: [],
          preferences: defaultPreferences,
          revision: 0,
        },
      });
    if (path === "/rest/v1/rpc/next_up_change_library") {
      const body = route.request().postDataJSON();
      const current = store.get(id) ?? {
        games: [],
        preferences: defaultPreferences,
        revision: 0,
      };
      if (body.p_expected_revision !== current.revision)
        return route.fulfill({
          status: 409,
          json: { code: "PT409", message: "Library changed" },
        });
      const games = body.p_replace
        ? []
        : current.games.filter((g) => !body.p_remove.includes(g.id));
      for (const g of body.p_games) {
        const index = games.findIndex((e) => e.id === g.id);
        if (index >= 0) games[index] = g;
        else games.push(g);
      }
      const next = {
        games,
        preferences: body.p_preferences ?? current.preferences,
        revision: current.revision + 1,
      };
      store.set(id, structuredClone(next));
      return route.fulfill({ json: next });
    }
    return route.fulfill({
      status: 400,
      json: { error: "Unexpected test endpoint" },
    });
  });
  await context.route("**/api/catalog/popular", (route) =>
    route.fulfill({ json: { games: [] } }),
  );
  await context.route("**/api/providers", (route) =>
    route.fulfill({ json: { catalog: true, steam: false, connected: false } }),
  );
  await context.route("**/api/steam/logout", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  return store;
}
export const test = base.extend<{ cloud: MockCloud }>({
  cloud: [
    async ({ context }, use) => {
      await use(await mockCloud(context));
    },
    { auto: true },
  ],
});
