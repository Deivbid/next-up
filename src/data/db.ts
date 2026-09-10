import Dexie, { type Table } from "dexie";
import { gameSchema, type Game, type Preferences } from "../domain/game";

export class LibraryDB extends Dexie {
  games!: Table<Game, string>;
  preferences!: Table<Preferences, string>;
  constructor(name = "next-up") {
    super(name);
    this.version(1).stores({
      games: "id, steamId, igdbId, ownership, status",
      preferences: "id",
    });
  }
}
export const db = new LibraryDB();
export async function saveGame(game: Game) {
  const valid = gameSchema.parse({ ...game, updatedAt: Date.now() });
  await db.transaction("rw", db.games, async () => {
    for (const key of ["steamId", "igdbId"] as const) {
      if (valid[key] !== undefined) {
        const existing = await db.games.where(key).equals(valid[key]!).first();
        if (existing && existing.id !== valid.id)
          throw new Error("Game already exists");
      }
    }
    await db.games.put(valid);
  });
}
