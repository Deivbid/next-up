import { z } from "zod";

export const devices = ["PC", "Steam Deck", "PS5", "Switch 2"] as const;
export const statuses = [
  "Backlog",
  "Playing",
  "Paused",
  "Finished",
  "Dropped",
] as const;
export const gameSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    ownership: z.enum(["owned", "wishlist"]),
    status: z.enum(statuses),
    devices: z
      .array(z.enum(devices))
      .max(4)
      .refine((a) => new Set(a).size === a.length),
    genres: z.array(z.string().trim().min(1).max(60)).max(10),
    session: z.enum(["unknown", "short", "long", "flexible"]),
    notes: z.string().max(4000),
    categories: z.array(z.string().trim().min(1).max(60)).max(20),
    cover: z
      .string()
      .max(500)
      .refine((value) => {
        if (!value) return true;
        try {
          const u = new URL(value);
          return (
            u.protocol === "https:" &&
            ["images.igdb.com", "shared.fastly.steamstatic.com"].includes(
              u.hostname,
            )
          );
        } catch {
          return false;
        }
      }),
    steamId: z.number().int().positive().optional(),
    igdbId: z.number().int().positive().optional(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();
export type Game = z.infer<typeof gameSchema>;
export type Device = (typeof devices)[number];
export const preferencesSchema = z
  .object({
    id: z.literal("preferences"),
    devices: z.array(z.enum(devices)).max(4),
    theme: z.enum(["dark", "light"]),
  })
  .strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Preferences = {
  id: "preferences",
  devices: [...devices],
  theme: "dark",
};
export function newGame(): Game {
  return {
    id: crypto.randomUUID(),
    title: "",
    ownership: "owned",
    status: "Backlog",
    devices: [],
    genres: [],
    session: "unknown",
    notes: "",
    categories: [],
    cover: "",
    updatedAt: Date.now(),
  };
}
