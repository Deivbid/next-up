import type { Device, Game } from "./game";
export type Occasion = { device: Device; minutes: number; genre: string };
export function recommend(games: Game[], occasion: Occasion) {
  return games
    .filter(
      (game) =>
        game.ownership === "owned" &&
        ["Backlog", "Playing", "Paused"].includes(game.status) &&
        game.devices.includes(occasion.device) &&
        (!occasion.genre || game.genres.includes(occasion.genre)),
    )
    .map((game) => {
      let score = 0;
      const reasons = [`You marked it playable on ${occasion.device}`];
      if (game.session === "flexible") {
        score += 3;
        reasons.push("You marked sessions as flexible");
      } else if (game.session === "short" && occasion.minutes <= 45) {
        score += 4;
        reasons.push("You marked it for short sessions");
      } else if (game.session === "long" && occasion.minutes >= 60) {
        score += 4;
        reasons.push("You marked it for longer sessions");
      } else if (game.session === "unknown") {
        reasons.push("Session fit is unknown");
      } else {
        score -= 2;
        reasons.push(
          `You prefer ${game.session === "long" ? "longer" : "short"} sessions for this game`,
        );
      }
      if (game.status === "Playing") {
        score += 2;
        reasons.push("Already in your rotation");
      }
      if (game.status === "Paused")
        reasons.push("Ready whenever you want to return");
      return { game, reasons, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.game.title.localeCompare(b.game.title) ||
        a.game.id.localeCompare(b.game.id),
    )
    .slice(0, 3);
}
