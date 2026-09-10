import { z } from "zod";
import { gameSchema, type Game } from "../domain/game";
const draftSchema = gameSchema.extend({
  title: z.string().max(200),
  genres: z.array(z.string().max(60)).max(10),
  categories: z.array(z.string().max(60)).max(20),
});
export function readDraft(): Game | null {
  try {
    const raw = sessionStorage.getItem("next-up-draft");
    if (!raw) return null;
    return draftSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
export function storeDraft(game: Game) {
  try {
    sessionStorage.setItem("next-up-draft", JSON.stringify(game));
  } catch {
    /* Optional recovery must not block normal saves. */
  }
}
export function clearDraft() {
  try {
    sessionStorage.removeItem("next-up-draft");
  } catch {
    /* Browser storage may be unavailable. */
  }
}
