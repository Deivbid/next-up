import { it, expect, vi, afterEach } from "vitest";
import {
  mapCatalog,
  mapSteam,
  validateAssertion,
  validateDiscovery,
  upstream,
  STEAM_OPENID,
  OPENID_NS,
} from "../../worker/providers";
afterEach(() => vi.unstubAllGlobals());
it("rejects private and partial Steam library responses without manufacturing an empty import", () => {
  expect(() => mapSteam({ response: {} })).toThrow();
  expect(() =>
    mapSteam({
      response: { game_count: 2, games: [{ appid: 1, name: "One" }] },
    }),
  ).toThrow();
  expect(mapSteam({ response: { game_count: 0 } })).toEqual({ games: [] });
});
it("maps only supported catalog fields and a trusted artwork host", () => {
  expect(
    mapCatalog([
      {
        id: 1,
        name: "Game",
        cover: { image_id: "co123" },
        genres: [{ name: "RPG" }],
        secret: "ignored",
      },
    ]),
  ).toEqual({
    games: [
      {
        igdbId: 1,
        title: "Game",
        cover:
          "https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg",
        genres: ["RPG"],
      },
    ],
  });
  expect(() =>
    mapCatalog([{ id: 1, name: "Game", cover: { image_id: "../../invalid" } }]),
  ).toThrow();
});
function assertion() {
  return new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "id_res",
    "openid.op_endpoint": STEAM_OPENID,
    "openid.return_to": "https://nextup.example/api/steam/callback?state=one",
    "openid.claimed_id":
      "https://steamcommunity.com/openid/id/76561198000000000",
    "openid.identity": "https://steamcommunity.com/openid/id/76561198000000000",
    "openid.response_nonce":
      new Date().toISOString().replace(/\.\d{3}Z/, "Z") + "nonce",
    "openid.signed":
      "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "provider-signature",
    "openid.assoc_handle": "handle",
  });
}
it("rejects callback substitution, unsigned identities, expired nonces and duplicate parameters before provider verification", () => {
  const p = assertion();
  const expected = p.get("openid.return_to")!;
  expect(validateAssertion(p, expected).steamId).toBe("76561198000000000");
  expect(() => validateAssertion(p, "https://attacker.example/")).toThrow();
  p.set("openid.signed", "return_to");
  expect(() => validateAssertion(p, expected)).toThrow();
  const duplicate = assertion();
  duplicate.append("openid.identity", "another");
  expect(() => validateAssertion(duplicate, expected)).toThrow();
  expect(() =>
    validateAssertion(assertion(), expected, Date.now() + 600001),
  ).toThrow();
});
it("accepts the observed Steam XRDS discovery shape and rejects external endpoints and XML entities", () => {
  const xml = `<xrds:XRDS xmlns:xrds="xri://$xrds"><XRD><Service><Type>${OPENID_NS}/signon</Type><URI>${STEAM_OPENID}</URI></Service></XRD></xrds:XRDS>`;
  expect(() => validateDiscovery(xml)).not.toThrow();
  expect(() =>
    validateDiscovery(xml.replace(STEAM_OPENID, "https://attacker.example")),
  ).toThrow();
  expect(() => validateDiscovery("<!DOCTYPE test>" + xml)).toThrow();
});
it("surfaces provider rate limiting without automatic retries", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response("", { status: 429, headers: { "Retry-After": "15" } }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    upstream("https://api.igdb.com/v4/games", {}, AbortSignal.timeout(1000)),
  ).rejects.toMatchObject({ status: 429, retryAfter: "15" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
