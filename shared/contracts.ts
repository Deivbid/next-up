import { z } from "zod";
export const catalogGameSchema = z
  .object({
    igdbId: z.number().int().positive(),
    title: z.string().min(1).max(200),
    cover: z.string().max(500),
    genres: z.array(z.string().max(60)).max(10),
  })
  .strict();
export const catalogSchema = z
  .object({ games: z.array(catalogGameSchema).max(20) })
  .strict();
export type CatalogGame = z.infer<typeof catalogGameSchema>;
export const steamGameSchema = z
  .object({
    steamId: z.number().int().positive(),
    title: z.string().min(1).max(200),
  })
  .strict();
export const steamLibrarySchema = z
  .object({ games: z.array(steamGameSchema).max(20000) })
  .strict();
export type SteamGame = z.infer<typeof steamGameSchema>;
export const providerSchema = z
  .object({ catalog: z.boolean(), steam: z.boolean(), connected: z.boolean() })
  .strict();
