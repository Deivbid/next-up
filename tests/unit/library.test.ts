import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { newGame, defaultPreferences, type Game } from "../../src/domain/game";
import { recommend } from "../../src/domain/recommend";
import { LibraryDB } from "../../src/data/db";
import { parseBackup, restoreBackup } from "../../src/data/backup";
import { importSteam } from "../../src/data/steam";
const game = (values: Partial<Game> = {}): Game => ({
  ...newGame(),
  title: "A game",
  devices: ["PC"],
  ...values,
});
const occasion = { device: "PC" as const, minutes: 30, genre: "" };
describe("recommendations", () => {
  it("excludes wishlist, finished, dropped and unconfirmed devices", () => {
    const games = [
      game({ ownership: "wishlist" }),
      game({ status: "Finished" }),
      game({ status: "Dropped" }),
      game({ devices: ["Steam Deck"] }),
      game({ devices: [] }),
      game({ title: "Eligible" }),
    ];
    expect(recommend(games, occasion).map((r) => r.game.title)).toEqual([
      "Eligible",
    ]);
  });
  it("ranks explicit session preferences and explains unknown fit", () => {
    const results = recommend(
      [
        game({ title: "Long", session: "long" }),
        game({ title: "Unknown" }),
        game({ title: "Short", session: "short" }),
      ],
      occasion,
    );
    expect(results.map((r) => r.game.title)).toEqual([
      "Short",
      "Unknown",
      "Long",
    ]);
    expect(results[1].reasons).toContain("Session fit is unknown");
  });
  it("does not infer Deck compatibility from PC ownership and caps suggestions at three", () => {
    const games = Array.from({ length: 5 }, () => game());
    expect(
      recommend(games, { ...occasion, device: "Steam Deck" }),
    ).toHaveLength(0);
    expect(recommend(games, occasion)).toHaveLength(3);
  });
  it("filters optional genre without mutating the library", () => {
    const games = [game({ genres: ["RPG"] }), game({ genres: ["Puzzle"] })];
    const original = structuredClone(games);
    expect(recommend(games, { ...occasion, genre: "Puzzle" })).toHaveLength(1);
    expect(games).toEqual(original);
  });
});
describe("data safety", () => {
  it("rejects malformed, duplicated and foreign backups", () => {
    expect(() => parseBackup('{"games":[]}')).toThrow();
    const repeated = game();
    expect(() =>
      parseBackup(
        JSON.stringify({
          application: "next-up",
          exportedAt: new Date().toISOString(),
          preferences: defaultPreferences,
          games: [repeated, repeated],
        }),
      ),
    ).toThrow();
  });
  it("validates before replacing and restores games and settings together", async () => {
    const db = new LibraryDB(crypto.randomUUID());
    const original = game();
    await db.games.add(original);
    const invalid = {
      application: "next-up",
      exportedAt: new Date().toISOString(),
      preferences: defaultPreferences,
      games: [{ ...original, title: "" }],
    };
    await expect(restoreBackup(db, invalid as never)).rejects.toThrow();
    expect(await db.games.toArray()).toEqual([original]);
    const replacement = game({ title: "Restored" });
    const backup = parseBackup(
      JSON.stringify({ ...invalid, games: [replacement] }),
    );
    await restoreBackup(db, backup);
    expect(await db.games.toArray()).toEqual([replacement]);
    expect(await db.preferences.get("preferences")).toEqual(defaultPreferences);
    await db.delete();
  });
  it("preserves status, notes, devices and categories during repeated Steam imports", async () => {
    const db = new LibraryDB(crypto.randomUUID());
    const existing = game({
      steamId: 1,
      title: "My title",
      status: "Paused",
      notes: "Keep this",
      categories: ["Weekend"],
      devices: ["Steam Deck"],
    });
    await db.games.add(existing);
    await importSteam(db, [
      { steamId: 1, title: "Provider name" },
      { steamId: 2, title: "New game" },
    ]);
    await importSteam(db, [{ steamId: 2, title: "New game" }]);
    expect(await db.games.get(existing.id)).toEqual(existing);
    expect(await db.games.count()).toBe(2);
    expect(
      (await db.games.where("steamId").equals(2).first())?.devices,
    ).toEqual(["PC"]);
    await db.delete();
  });
});

it('rolls back replacement if storage fails during the restore transaction',async()=>{
 const db=new LibraryDB(crypto.randomUUID());const original=game();await db.games.add(original);
 const reject=()=>{throw new Error('Simulated storage failure');};db.preferences.hook('creating',reject);
 const backup=parseBackup(JSON.stringify({application:'next-up',exportedAt:new Date().toISOString(),preferences:defaultPreferences,games:[game({title:'Replacement'})]}));
 await expect(restoreBackup(db,backup)).rejects.toThrow('Simulated storage failure');expect(await db.games.toArray()).toEqual([original]);db.preferences.hook('creating').unsubscribe(reject);await db.delete();
});
