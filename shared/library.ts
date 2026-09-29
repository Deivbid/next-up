import { z } from "zod";
import { gameSchema, preferencesSchema } from "../src/domain/game";

export const librarySnapshotSchema = z
  .object({
    games: z.array(gameSchema).max(20000),
    preferences: preferencesSchema,
    revision: z.number().int().nonnegative().safe(),
  })
  .strict()
  .superRefine(({ games }, ctx) => {
    for (const key of ["id", "steamId", "igdbId"] as const) {
      const values = games.map((g) => g[key]).filter((v) => v !== undefined);
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${key}` });
    }
  });
export type LibrarySnapshot = z.infer<typeof librarySnapshotSchema>;
