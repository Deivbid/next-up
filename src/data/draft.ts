import { z } from "zod";
import { gameSchema, type Game } from "../domain/game";
const draftSchema = gameSchema.extend({
  title: z.string().max(200),
  genres: z.array(z.string().max(60)).max(10),
  categories: z.array(z.string().max(60)).max(20),
});
export function readDraft(owner?: string): Game | null {
  try {
    const raw = sessionStorage.getItem(
      owner ? `next-up-draft:${owner}` : "next-up-draft",
    );
    if (!raw) return null;
    return draftSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
export function storeDraft(game: Game, owner?: string, revision?: number) {
  try {
    if (owner && revision !== undefined)
      sessionStorage.setItem(
        `next-up-draft:${owner}:revision`,
        String(revision),
      );
    sessionStorage.setItem(
      owner ? `next-up-draft:${owner}` : "next-up-draft",
      JSON.stringify(game),
    );
  } catch {
    /* Optional recovery must not block normal saves. */
  }
}
export function clearDraft(owner?: string) {
  try {
    if (owner) sessionStorage.removeItem(`next-up-draft:${owner}:revision`);
    sessionStorage.removeItem(
      owner ? `next-up-draft:${owner}` : "next-up-draft",
    );
  } catch {
    /* Browser storage may be unavailable. */
  }
}

export function readDraftRevision(owner: string) {
  try {
    const raw = sessionStorage.getItem(`next-up-draft:${owner}:revision`);
    const value = Number(raw);
    return raw !== null && Number.isSafeInteger(value) && value >= 0
      ? value
      : -1;
  } catch {
    return -1;
  }
}
