import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
await build({
  entryPoints: ["worker/index.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ["cloudflare:workers"],
  outfile: ".local/worker-check.mjs",
});
const origin = "https://nextup.example";
const endpoint = "https://steamcommunity.com/openid/login";
const ns = "http://specs.openid.net/auth/2.0";
let valid = true;
let providerCalls = 0;
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "api",
        modules: [{ type: "ESModule", path: ".local/worker-check.mjs" }],
        compatibilityDate: "2026-09-10",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          APP_ORIGIN: origin,
          STEAM_WEB_API_KEY: "test-only-not-a-real-key",
        },
        durableObjects: {
          AUTH: { className: "IntegrationState", useSQLite: true },
        },
        outboundService: async (request) => {
          providerCalls++;
          const url = new URL(request.url);
          if (url.href.startsWith("https://steamcommunity.com/openid/id/"))
            return new Response(
              `<XRDS><XRD><Service><Type>${ns}/signon</Type><URI>${endpoint}</URI></Service></XRD></XRDS>`,
            );
          if (url.href === endpoint) {
            const body = new URLSearchParams(await request.text());
            assert.equal(body.get("openid.mode"), "check_authentication");
            return new Response(`ns:${ns}\nis_valid:${valid}\n`);
          }
          if (url.hostname === "api.steampowered.com")
            return Response.json({
              response: {
                game_count: 1,
                games: [{ appid: 1, name: "Test game" }],
              },
            });
          throw new Error("Unexpected outbound URL");
        },
      },
    ],
  }),
);
const pause = () => new Promise((resolve) => setTimeout(resolve, 370));
const call = (path, init = {}) =>
  runtime.dispatchFetch(origin + path, { redirect: "manual", ...init });
async function start() {
  await pause();
  const response = await call("/api/steam/login");
  assert.equal(response.status, 302);
  const target = new URL(response.headers.get("location"));
  const loginCookie = response.headers.get("set-cookie");
  assert.match(loginCookie, /HttpOnly; Secure; SameSite=Lax/);
  return {
    returnTo: target.searchParams.get("openid.return_to"),
    cookie: loginCookie.split(";")[0],
  };
}
function callback(login) {
  const url = new URL(login.returnTo);
  for (const [key, value] of Object.entries({
    "openid.ns": ns,
    "openid.mode": "id_res",
    "openid.op_endpoint": endpoint,
    "openid.return_to": login.returnTo,
    "openid.identity": "https://steamcommunity.com/openid/id/76561198000000000",
    "openid.claimed_id":
      "https://steamcommunity.com/openid/id/76561198000000000",
    "openid.response_nonce":
      new Date().toISOString().replace(/\.\d{3}Z/, "Z") + crypto.randomUUID(),
    "openid.assoc_handle": "test",
    "openid.signed":
      "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "fixture-assertion",
  }))
    url.searchParams.set(key, value);
  return url.pathname + url.search;
}
try {
  assert.deepEqual(await (await call("/api/providers")).json(), {
    catalog: false,
    steam: true,
    connected: false,
  });
  const login = await start();
  const assertion = callback(login);
  await pause();
  assert.equal((await call(assertion)).status, 400); // missing browser binding
  await pause();
  const accepted = await call(assertion, { headers: { Cookie: login.cookie } });
  assert.equal(accepted.status, 302, await accepted.clone().text());
  assert.equal(accepted.headers.get("location"), origin + "/#settings");
  const session = accepted.headers
    .getSetCookie()
    .find((c) => c.startsWith("__Host-nextup-session="))
    .split(";")[0];
  await pause();
  assert.equal(
    (await call(assertion, { headers: { Cookie: login.cookie } })).status,
    400,
  ); // consumed state
  await pause();
  assert.deepEqual(
    await (
      await call("/api/steam/library", { headers: { Cookie: session } })
    ).json(),
    { games: [{ steamId: 1, title: "Test game" }] },
  );
  assert.equal(
    (
      await call("/api/steam/logout", {
        method: "POST",
        headers: {
          Cookie: session,
          Origin: "https://attacker.example",
          "X-Next-Up": "1",
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/api/steam/logout", {
        method: "POST",
        headers: { Cookie: session, Origin: origin, "X-Next-Up": "1" },
      })
    ).status,
    200,
  );
  await pause();
  assert.equal(
    (await call("/api/steam/library", { headers: { Cookie: session } })).status,
    401,
  );
  const rejected = await start();
  valid = false;
  await pause();
  assert.equal(
    (await call(callback(rejected), { headers: { Cookie: rejected.cookie } }))
      .status,
    401,
  );
  console.log(
    `Worker checks passed: browser-bound login, discovery + direct verification, replay rejection, session import and CSRF-safe logout. ${providerCalls} mocked provider calls; no external authentication.`,
  );
} finally {
  await runtime.dispose();
}
