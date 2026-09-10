import { z } from "zod";
import { gameSchema, preferencesSchema } from "../domain/game";
import { type LibraryDB } from "./db";

const backupSchema = z
  .object({
    application: z.literal("next-up"),
    exportedAt: z.string().datetime(),
    games: z.array(gameSchema).max(20000),
    preferences: preferencesSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    for (const key of ["id", "steamId", "igdbId"] as const) {
      const values = data.games
        .map((g) => g[key])
        .filter((v) => v !== undefined);
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${key} in backup` });
    }
  });
export type Backup = z.infer<typeof backupSchema>;
export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    throw new Error("Backup must be smaller than 10 MB.");
  try {
    return backupSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      "This is not a valid Next Up backup. Your library has not changed.",
    );
  }
}
export async function restoreBackup(database: LibraryDB, backup: Backup) {
  const valid = backupSchema.parse(backup);
  await database.transaction(
    "rw",
    database.games,
    database.preferences,
    async () => {
      await database.games.clear();
      await database.preferences.clear();
      await database.games.bulkPut(valid.games);
      await database.preferences.put(valid.preferences);
    },
  );
}
