import { handleMcp } from "./mcp";
import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { providerSchema } from "../shared/contracts";
import {
  STEAM_OPENID,
  OPENID_NS,
  ProviderError,
  upstream,
  mapCatalog,
  mapArtwork,
  mapSteam,
  validateAssertion,
  validateDiscovery,
} from "./providers";
type Env = WorkerBindings;
const json = (
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extra,
    },
  });
async function hash(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
const random = () => crypto.randomUUID() + crypto.randomUUID();
function cookie(request: Request, name: string) {
  return (
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}
const setCookie = (name: string, value: string, age: number) =>
  `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
export class IntegrationState extends DurableObject<Env> {
  private active = 0;
  private token?: { value: string; expires: number };
  private popular?: { value: ReturnType<typeof mapCatalog>; expires: number };
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS technical_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL)",
    );
  }
  async mcpLimit(userId: string) {
    const bucket = Math.floor(Date.now() / 60000);
    const key = `mcp-rate:${await hash(userId)}:${bucket}`;
    const count = z.number().parse(this.get(key) ?? 0);
    if (count >= 60) return false;
    this.put(key, count + 1, 120000);
    return true;
  }
  private put(key: string, value: unknown, ttl: number) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO technical_state VALUES (?,?,?)",
      key,
      JSON.stringify(value),
      Date.now() + ttl,
    );
    this.ctx.waitUntil(this.ensureCleanup());
  }
  private async ensureCleanup() {
    if ((await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(Date.now() + 3600000);
  }
  async alarm() {
    this.ctx.storage.sql.exec(
      "DELETE FROM technical_state WHERE expires<=?",
      Date.now(),
    );
    const next = this.ctx.storage.sql
      .exec<{ expires: number | null }>(
        "SELECT MIN(expires) AS expires FROM technical_state",
      )
      .toArray()[0]?.expires;
    if (next)
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 60000, next));
  }
  private get(key: string): unknown {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>(
        "SELECT value FROM technical_state WHERE key=? AND expires>?",
        key,
        Date.now(),
      )
      .toArray()[0];
    return row ? JSON.parse(row.value) : undefined;
  }
  private remove(key: string) {
    this.ctx.storage.sql.exec("DELETE FROM technical_state WHERE key=?", key);
  }
  private gate(cost = 1) {
    const now = Date.now();
    const previous = z.number().optional().parse(this.get("rate:last")) ?? 0;
    if (now - previous < 350 || this.active >= 6)
      throw new ProviderError(429, "slow_down", "1");
    const date = new Date().toISOString().slice(0, 10);
    const count =
      z
        .number()
        .optional()
        .parse(this.get(`daily:${date}`)) ?? 0;
    if (count + cost > 5000)
      throw new ProviderError(429, "daily_limit", "3600");
    this.put("rate:last", now + 350 * (cost - 1), 1000);
    this.put(`daily:${date}`, count + cost, 86400000);
  }
  private async session(request: Request) {
    const token = cookie(request, "__Host-nextup-session");
    if (!/^[a-f0-9-]{72}$/.test(token)) return undefined;
    return z
      .object({ steamId: z.string().regex(/^7656119\d{10}$/) })
      .optional()
      .parse(this.get(`session:${await hash(token)}`));
  }
  async fetch(request: Request) {
    this.ctx.storage.sql.exec(
      "DELETE FROM technical_state WHERE expires<=?",
      Date.now(),
    );
    const url = new URL(request.url);
    const origin = this.env.APP_ORIGIN;
    if (url.origin !== origin) return json({ error: "wrong_origin" }, 403);
    const catalog = !!(
      this.env.TWITCH_CLIENT_ID && this.env.TWITCH_CLIENT_SECRET
    );
    const steam = !!this.env.STEAM_WEB_API_KEY && origin.startsWith("https://");
    const session = await this.session(request);
    if (request.method === "GET" && url.pathname === "/api/providers")
      return json(
        providerSchema.parse({ catalog, steam, connected: steam && !!session }),
      );
    if (
      request.headers.get("Sec-Fetch-Site") === "cross-site" &&
      url.pathname !== "/api/steam/callback"
    )
      return json({ error: "cross_site_request" }, 403);
    if (request.method === "POST" && url.pathname === "/api/steam/logout") {
      if (
        request.headers.get("Origin") !== origin ||
        request.headers.get("X-Next-Up") !== "1"
      )
        return json({ error: "invalid_origin" }, 403);
      this.remove(
        `session:${await hash(cookie(request, "__Host-nextup-session"))}`,
      );
      return json({ ok: true }, 200, {
        "Set-Cookie": setCookie("__Host-nextup-session", "", 0),
      });
    }
    if (request.method !== "GET")
      return json({ error: "method_not_allowed" }, 405, { Allow: "GET" });
    if (
      ![
        "/api/catalog",
        "/api/catalog/popular",
        "/api/artwork",
        "/api/steam/login",
        "/api/steam/callback",
        "/api/steam/library",
      ].includes(url.pathname)
    )
      return json({ error: "not_found" }, 404);
    if (
      url.pathname === "/api/catalog/popular" &&
      catalog &&
      this.popular &&
      this.popular.expires > Date.now()
    )
      return json(this.popular.value, 200, {
        "Cache-Control": `public, max-age=${Math.max(0, Math.floor((this.popular.expires - Date.now()) / 1000))}`,
      });
    try {
      this.gate(url.pathname === "/api/catalog/popular" ? 2 : 1);
    } catch (e) {
      return this.failure(e);
    }
    this.active++;
    const signal = AbortSignal.timeout(8000);
    try {
      if (
        url.pathname === "/api/catalog" ||
        url.pathname === "/api/catalog/popular" ||
        url.pathname === "/api/artwork"
      ) {
        if (!catalog) return json({ error: "catalog_not_configured" }, 503);
        const isArtwork = url.pathname === "/api/artwork";
        const isPopular = url.pathname === "/api/catalog/popular";
        let query: string;
        if (isArtwork) {
          const id = z.coerce
            .number()
            .int()
            .positive()
            .safe()
            .safeParse(url.searchParams.get("igdbId"));
          if (!id.success) return json({ error: "invalid_game_id" }, 400);
          query = `where id = ${id.data}; fields artworks.image_id,artworks.width,artworks.height,screenshots.image_id,screenshots.width,screenshots.height; limit 1;`;
        } else if (isPopular) {
          query = "";
        } else {
          const q = z
            .string()
            .trim()
            .min(2)
            .max(100)
            .parse(url.searchParams.get("q"));
          query = `search ${JSON.stringify(q)}; fields name,cover.image_id,genres.name; limit 20;`;
        }
        if (!this.token || this.token.expires < Date.now() + 60000) {
          const r = await upstream(
            "https://id.twitch.tv/oauth2/token",
            {
              method: "POST",
              body: new URLSearchParams({
                client_id: this.env.TWITCH_CLIENT_ID!,
                client_secret: this.env.TWITCH_CLIENT_SECRET!,
                grant_type: "client_credentials",
              }),
            },
            signal,
          );
          const auth = z
            .object({
              access_token: z.string().min(1),
              expires_in: z.number().positive(),
            })
            .parse(await r.json());
          this.token = {
            value: auth.access_token,
            expires: Date.now() + auth.expires_in * 1000,
          };
        }
        let popularIds: number[] = [];
        if (isPopular) {
          const ranking = await upstream(
            "https://api.igdb.com/v4/popularity_primitives",
            {
              method: "POST",
              headers: {
                "Client-ID": this.env.TWITCH_CLIENT_ID!,
                Authorization: `Bearer ${this.token.value}`,
                "Content-Type": "text/plain",
              },
              body: "fields game_id,value; sort value desc; limit 20; where popularity_type = 1;",
            },
            signal,
          );
          const rows = z
            .array(
              z.object({
                game_id: z.number().int().positive().safe(),
                value: z.number().finite(),
              }),
            )
            .max(20)
            .parse(await ranking.json());
          popularIds = [...new Set(rows.map((row) => row.game_id))];
          if (!popularIds.length) return json({ games: [] });
          query = `where id = (${popularIds.join(",")}); fields name,cover.image_id,genres.name; limit 20;`;
        }
        const r = await upstream(
          "https://api.igdb.com/v4/games",
          {
            method: "POST",
            headers: {
              "Client-ID": this.env.TWITCH_CLIENT_ID!,
              Authorization: `Bearer ${this.token.value}`,
              "Content-Type": "text/plain",
            },
            body: query,
          },
          signal,
        );
        if (isArtwork)
          return json(mapArtwork(await r.json()), 200, {
            "Cache-Control": "public, max-age=86400",
          });
        const result = mapCatalog(await r.json());
        if (isPopular) {
          // The games endpoint does not retain the ranking's order.
          result.games = popularIds.flatMap((id) =>
            result.games.filter((game) => game.igdbId === id),
          );
          this.popular = { value: result, expires: Date.now() + 3600000 };
          return json(result, 200, { "Cache-Control": "public, max-age=3600" });
        }
        return json(result);
      }
      if (!steam) return json({ error: "steam_requires_key_and_https" }, 503);
      if (url.pathname === "/api/steam/login") {
        const state = random();
        const browser = random();
        const returnTo = `${origin}/api/steam/callback?state=${state}`;
        this.put(
          `state:${await hash(state)}`,
          { browser: await hash(browser), returnTo },
          600000,
        );
        const target = new URL(STEAM_OPENID);
        target.search = new URLSearchParams({
          "openid.ns": OPENID_NS,
          "openid.mode": "checkid_setup",
          "openid.return_to": returnTo,
          "openid.realm": `${origin}/`,
          "openid.identity": `${OPENID_NS}/identifier_select`,
          "openid.claimed_id": `${OPENID_NS}/identifier_select`,
        }).toString();
        return new Response(null, {
          status: 302,
          headers: {
            Location: target.href,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "Set-Cookie": setCookie("__Host-nextup-login", browser, 600),
          },
        });
      }
      if (url.pathname === "/api/steam/callback") {
        const state = url.searchParams.get("state") ?? "";
        if (!/^[a-f0-9-]{72}$/.test(state))
          throw new ProviderError(400, "invalid_state");
        const stateKey = `state:${await hash(state)}`;
        const pending = z
          .object({ browser: z.string(), returnTo: z.string() })
          .optional()
          .parse(this.get(stateKey));
        if (
          !pending ||
          pending.browser !==
            (await hash(cookie(request, "__Host-nextup-login")))
        )
          throw new ProviderError(400, "invalid_state");
        const identity = validateAssertion(url.searchParams, pending.returnTo);
        // Consume synchronously before any provider I/O; a replay cannot reuse this attempt.
        if (!this.get(stateKey)) throw new ProviderError(400, "replayed_state");
        this.remove(stateKey);
        const nonceKey = `nonce:${await hash(identity.nonce)}`;
        if (this.get(nonceKey))
          throw new ProviderError(400, "replayed_assertion");
        this.put(nonceKey, true, 600000);
        const discovered = await upstream(identity.claimed, {}, signal);
        validateDiscovery(await discovered.text());
        const verify = new URLSearchParams();
        for (const [key, value] of url.searchParams)
          if (key.startsWith("openid.")) verify.set(key, value);
        verify.set("openid.mode", "check_authentication");
        const checked = await upstream(
          STEAM_OPENID,
          { method: "POST", body: verify },
          signal,
        );
        const lines = (await checked.text()).trim().split(/\r?\n/);
        if (
          lines.filter((line) => line === "is_valid:true").length !== 1 ||
          lines.some((line) => line === "is_valid:false")
        )
          throw new ProviderError(401, "invalid_signature");
        const token = random();
        this.put(
          `session:${await hash(token)}`,
          { steamId: identity.steamId },
          86400000,
        );
        const headers = new Headers({
          Location: `${origin}/#settings`,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        });
        headers.append(
          "Set-Cookie",
          setCookie("__Host-nextup-session", token, 86400),
        );
        headers.append("Set-Cookie", setCookie("__Host-nextup-login", "", 0));
        return new Response(null, { status: 302, headers });
      }
      if (!session) return json({ error: "not_connected" }, 401);
      const target = new URL(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
      );
      target.search = new URLSearchParams({
        key: this.env.STEAM_WEB_API_KEY!,
        steamid: session.steamId,
        include_appinfo: "1",
        include_played_free_games: "1",
      }).toString();
      const result = await upstream(target.href, {}, signal);
      return json(mapSteam(await result.json()));
    } catch (error) {
      if (
        (url.pathname === "/api/catalog" ||
          url.pathname === "/api/catalog/popular" ||
          url.pathname === "/api/artwork") &&
        error instanceof ProviderError &&
        error.code === "provider_authentication_failed"
      )
        this.token = undefined;
      return this.failure(error);
    } finally {
      this.active--;
    }
  }
  private failure(error: unknown) {
    if (error instanceof ProviderError)
      return json(
        { error: error.code },
        error.status,
        error.retryAfter ? { "Retry-After": error.retryAfter } : {},
      );
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    )
      return json({ error: "provider_timeout" }, 504);
    return json({ error: "invalid_or_unavailable_response" }, 502);
  }
}
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (
      url.pathname === "/api/mcp" ||
      url.pathname === "/.well-known/oauth-protected-resource/api/mcp" ||
      url.pathname === "/.well-known/oauth-protected-resource"
    ) {
      const integration = env.AUTH.get(env.AUTH.idFromName("integrations"));
      return handleMcp(request, env, ctx, {
        limit: (userId) => integration.mcpLimit(userId),
        catalog: (query) =>
          integration.fetch(
            new Request(
              `${env.APP_ORIGIN}/api/catalog?q=${encodeURIComponent(query)}`,
            ),
          ),
      });
    }
    if (url.pathname.startsWith("/api/"))
      return env.AUTH.get(env.AUTH.idFromName("integrations")).fetch(request);
    return json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
