import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { catalogSchema, steamLibrarySchema } from "../shared/contracts";
export const STEAM_OPENID = "https://steamcommunity.com/openid/login";
export const OPENID_NS = "http://specs.openid.net/auth/2.0";
export class ProviderError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: string,
  ) {
    super(code);
  }
}
export async function upstream(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
) {
  const response = await fetch(url, { ...init, signal, redirect: "manual" });
  if (!response.ok) {
    if (response.status === 401)
      throw new ProviderError(502, "provider_authentication_failed");
    if (response.status === 429) {
      const supplied = response.headers.get("Retry-After");
      throw new ProviderError(
        429,
        "provider_rate_limited",
        supplied && /^\d{1,5}$/.test(supplied) ? supplied : "60",
      );
    }
    throw new ProviderError(502, "provider_unavailable");
  }
  return response;
}
export function mapCatalog(body: unknown) {
  const source = z
    .array(
      z.object({
        id: z.number().int().positive(),
        name: z.string(),
        cover: z
          .object({ image_id: z.string().regex(/^[a-zA-Z0-9_]+$/) })
          .optional(),
        genres: z.array(z.object({ name: z.string() })).optional(),
      }),
    )
    .max(20)
    .parse(body);
  return catalogSchema.parse({
    games: source.map((g) => ({
      igdbId: g.id,
      title: g.name,
      cover: g.cover
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
        : "",
      genres: g.genres?.slice(0, 10).map((v) => v.name) ?? [],
    })),
  });
}
export function mapSteam(body: unknown) {
  const result = z
    .object({
      response: z.object({
        game_count: z.number().int().nonnegative().max(20000),
        games: z
          .array(
            z.object({ appid: z.number().int().positive(), name: z.string() }),
          )
          .max(20000)
          .optional(),
      }),
    })
    .parse(body).response;
  if (result.game_count > 0 && !result.games)
    throw new ProviderError(502, "library_unavailable");
  const games = result.games ?? [];
  if (games.length !== result.game_count)
    throw new ProviderError(502, "incomplete_library");
  return steamLibrarySchema.parse({
    games: games.map((g) => ({ steamId: g.appid, title: g.name })),
  });
}
export function validateAssertion(
  params: URLSearchParams,
  returnTo: string,
  now = Date.now(),
) {
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1))
    throw new ProviderError(400, "duplicate_parameters");
  if (
    params.get("openid.ns") !== OPENID_NS ||
    params.get("openid.mode") !== "id_res" ||
    params.get("openid.op_endpoint") !== STEAM_OPENID ||
    params.get("openid.return_to") !== returnTo
  )
    throw new ProviderError(400, "invalid_assertion");
  const claimed = params.get("openid.claimed_id") ?? "";
  if (
    !/^https:\/\/steamcommunity\.com\/openid\/id\/7656119\d{10}$/.test(
      claimed,
    ) ||
    params.get("openid.identity") !== claimed
  )
    throw new ProviderError(400, "invalid_identity");
  const signed = new Set((params.get("openid.signed") ?? "").split(","));
  if (
    [
      "op_endpoint",
      "claimed_id",
      "identity",
      "return_to",
      "response_nonce",
      "assoc_handle",
    ].some((key) => !signed.has(key)) ||
    !params.get("openid.sig")
  )
    throw new ProviderError(400, "unsigned_identity");
  const nonce = params.get("openid.response_nonce") ?? "";
  const timestamp = Date.parse(nonce.slice(0, 20));
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ.+$/.test(nonce) ||
    nonce.length > 255 ||
    !Number.isFinite(timestamp) ||
    Math.abs(now - timestamp) > 300000
  )
    throw new ProviderError(400, "expired_assertion");
  return { claimed, steamId: claimed.split("/").pop()!, nonce };
}
export function validateDiscovery(xml: string) {
  if (xml.length > 100000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new ProviderError(400, "invalid_discovery");
  const parsed = new XMLParser({
    removeNSPrefix: true,
    processEntities: false,
  }).parse(xml);
  const schema = z.object({
    XRDS: z.object({
      XRD: z.object({
        Service: z.object({
          Type: z.union([z.string(), z.array(z.string())]),
          URI: z.union([z.string(), z.array(z.string())]),
        }),
      }),
    }),
  });
  const service = schema.parse(parsed).XRDS.XRD.Service;
  if (
    ![service.Type].flat().includes(`${OPENID_NS}/signon`) ||
    ![service.URI].flat().includes(STEAM_OPENID)
  )
    throw new ProviderError(400, "invalid_discovery");
}
