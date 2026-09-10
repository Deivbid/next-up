import { type SteamGame, steamLibrarySchema } from "../../shared/contracts";
import { newGame } from "../domain/game";
import type { LibraryDB } from "./db";
export async function importSteam(database: LibraryDB, selected: SteamGame[]) {
  const { games } = steamLibrarySchema.parse({ games: selected });
  await database.transaction("rw", database.games, async () => {
    for (const item of games) {
      const existing = await database.games
        .where("steamId")
        .equals(item.steamId)
        .first();
      if (existing) continue;
      await database.games.add({
        ...newGame(),
        title: item.title,
        steamId: item.steamId,
        devices: ["PC"],
        cover: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.steamId}/library_600x900.jpg`,
      });
    }
  });
}
