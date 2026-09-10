import { newGame, type Game } from "../domain/game";
export function demoGames(): Game[] {
  return [
    {
      title: "Cyberpunk 2077",
      steamId: 1091500,
      status: "Playing",
      devices: ["PC"],
      session: "long",
      genres: ["RPG"],
      notes: "Back in Night City. Pick up the next side quest.",
    },
    {
      title: "Balatro",
      steamId: 2379780,
      status: "Backlog",
      devices: ["Steam Deck"],
      session: "short",
      genres: ["Strategy"],
    },
    {
      title: "A Short Hike",
      steamId: 1055540,
      status: "Backlog",
      devices: ["Switch 2", "Steam Deck"],
      session: "flexible",
      genres: ["Adventure"],
    },
    {
      title: "Papers, Please",
      steamId: 239030,
      status: "Paused",
      devices: ["Steam Deck"],
      session: "short",
      genres: ["Simulation"],
      notes: "Take a moment to revisit the controls when returning.",
    },
  ].map(
    (item) =>
      ({
        ...newGame(),
        ...item,
        cover: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.steamId}/library_600x900.jpg`,
      }) as Game,
  );
}
