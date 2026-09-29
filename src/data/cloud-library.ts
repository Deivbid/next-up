import {
  librarySnapshotSchema,
  type LibrarySnapshot,
} from "../../shared/library";
import { z } from "zod";
import {
  gameSchema,
  preferencesSchema,
  type Game,
  type Preferences,
} from "../domain/game";
import Dexie, { type Table } from "dexie";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LibraryChange = {
  games?: Game[];
  preferences?: Preferences;
  remove?: string[];
  replace?: boolean;
};
type State = {
  snapshot?: LibrarySnapshot;
  busy: boolean;
  error: string;
  verified: boolean;
};
class AccountCache extends Dexie {
  snapshots!: Table<{ id: string; value: LibrarySnapshot }, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ snapshots: "id" });
  }
}
export class CloudLibrary {
  private state: State = { busy: false, error: "", verified: false };
  private listeners = new Set<() => void>();
  private controller = new AbortController();
  private cache: AccountCache;
  private disposed = false;
  constructor(
    private client: SupabaseClient,
    readonly userId: string,
  ) {
    const host = new URL(
      import.meta.env.VITE_SUPABASE_URL || "https://test.supabase.co",
    ).host;
    this.cache = new AccountCache(`next-up-account:${host}:${userId}`);
  }
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private set(patch: Partial<State>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private async token() {
    if (this.disposed) throw new Error("This session has ended.");
    const { data, error } = await this.client.auth.getSession();
    if (error || data.session?.user.id !== this.userId || this.disposed)
      throw new Error("Sign in again to save your library.");
    return data.session.access_token;
  }
  private async rpc(name: string, args: Record<string, unknown> = {}) {
    const token = await this.token();
    // Pin the account token so a concurrent account switch cannot send old data as the new user.
    const response = await this.client
      .rpc(name, args)
      .setHeader("Authorization", `Bearer ${token}`)
      .abortSignal(
        AbortSignal.any([this.controller.signal, AbortSignal.timeout(15000)]),
      )
      .retry(false);
    if (response.error) {
      if (response.error.code === "PT409")
        throw new Error(
          "Your library changed on another device. Refresh, then reopen this game before saving.",
        );
      if (response.error.code === "23505")
        throw new Error("This game is already in your library.");
      if (response.error.code === "PGRST202")
        throw new Error(
          "Database setup needs the library operations SQL. Your existing games are safe.",
        );
      if (response.status === 429)
        throw new Error("Too many requests. Wait a moment before refreshing.");
      throw new Error(
        "Could not confirm the server response. Refresh your library before trying again.",
      );
    }
    return librarySnapshotSchema.parse(response.data);
  }
  private async accept(snapshot: LibrarySnapshot) {
    if (this.disposed) return;
    this.set({ snapshot, verified: true, error: "" });
    try {
      await this.cache.snapshots.put({ id: "library", value: snapshot });
    } catch {
      this.set({
        error:
          "Saved to your account, but the offline copy could not be stored.",
      });
    }
  }
  async start() {
    try {
      const saved = await this.cache.snapshots.get("library");
      if (saved)
        this.set({ snapshot: librarySnapshotSchema.parse(saved.value) });
    } catch {
      /* The remote library remains authoritative if the optional cache fails. */
    }
    await this.refresh();
  }
  refresh = async () => {
    if (this.disposed || this.state.busy) return;
    if (!navigator.onLine) {
      this.set({
        verified: false,
        error:
          "Offline: you can read your saved copy. Connect to refresh or make changes.",
      });
      return;
    }
    this.set({ busy: true });
    try {
      await this.accept(await this.rpc("next_up_read_library"));
    } catch (e) {
      this.set({
        verified: false,
        error: e instanceof Error ? e.message : "Could not open your library.",
      });
    } finally {
      this.set({ busy: false });
    }
  };
  async change(
    change: LibraryChange,
    expectedRevision = this.state.snapshot?.revision,
  ) {
    if (this.disposed || !navigator.onLine)
      throw new Error("Connect to the internet to save changes.");
    if (this.state.busy)
      throw new Error("Wait for the current save or refresh to finish.");
    if (!this.state.verified || expectedRevision === undefined)
      throw new Error("Refresh your library before saving changes.");
    const games = z
      .array(gameSchema)
      .max(20000)
      .parse(change.games ?? []);
    const preferences = change.preferences
      ? preferencesSchema.parse(change.preferences)
      : null;
    const remove = z
      .array(z.string().uuid())
      .max(20000)
      .parse(change.remove ?? []);
    this.set({ busy: true, error: "" });
    try {
      const snapshot = await this.rpc("next_up_change_library", {
        p_expected_revision: expectedRevision,
        p_games: games,
        p_preferences: preferences,
        p_remove: remove,
        p_replace: change.replace ?? false,
      });
      await this.accept(snapshot);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Could not confirm the save. Refresh before trying again.";
      this.set({ verified: false, error: message });
      throw new Error(message, { cause: e });
    } finally {
      this.set({ busy: false });
    }
  }
  async dispose(clear = false) {
    this.disposed = true;
    this.controller.abort();
    this.listeners.clear();
    this.cache.close();
    if (clear) await Dexie.delete(this.cache.name);
  }
}
