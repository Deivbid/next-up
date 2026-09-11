import { type SteamGame, steamLibrarySchema } from "../../shared/contracts";
import { newGame } from "../domain/game";
import type { LibraryDB } from "./db";
export function steamCoverUrl(steamId: number) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamId}/library_600x900.jpg`;
}

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
        cover: steamCoverUrl(item.steamId),
      });
    }
  });
}

// Steam's HttpOnly browser session is separate from the Google account.
// Reset an inherited connection before exposing the importer to another account.
export async function ensureSteamOwner(userId: string, connected: boolean) {
  const key = "next-up-steam-owner";
  try {
    const pendingOwner = sessionStorage.getItem("next-up-steam-login-owner");
    if (
      localStorage.getItem(key) === userId &&
      (!pendingOwner || pendingOwner === userId)
    ) {
      if (connected) sessionStorage.removeItem("next-up-steam-login-owner");
      return true;
    }
    if (connected) {
      const response = await fetch("/api/steam/logout", {
        method: "POST",
        headers: { "X-Next-Up": "1" },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("Could not reset Steam session");
    }
    if (connected) sessionStorage.removeItem("next-up-steam-login-owner");
    localStorage.setItem(key, userId);
    return !connected;
  } catch {
    throw new Error("Reconnect Steam to use this account.");
  }
}
