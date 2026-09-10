import { useEffect, useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldSet,
  FieldLegend,
  FieldDescription,
} from "./ui/field";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Alert, AlertDescription } from "./ui/alert";
import { devices, statuses, gameSchema, type Game } from "../domain/game";
import { saveGame, db } from "../data/db";
import { storeDraft } from "../data/draft";
import { useLiveQuery } from "dexie-react-hooks";
import { Cover } from "./Cover";
import { catalogSchema, type CatalogGame } from "../../shared/contracts";

export function GameEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Game;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [game, setGame] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [discard, setDiscard] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = JSON.stringify(game) !== JSON.stringify(initial);
  const existing = !!useLiveQuery(() => db.games.get(initial.id), [initial.id]);
  useEffect(() => {
    if (dirty) storeDraft(game);
  }, [dirty, game]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = <K extends keyof Game>(key: K, value: Game[K]) =>
    setGame((g) => ({ ...g, [key]: value }));
  function close() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  useEffect(() => {
    if (
      query.length < 2 ||
      query.length > 100 ||
      existing ||
      discard ||
      deleting
    )
      return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchStatus("Searching…");
      try {
        const response = await fetch(
          `/api/catalog?q=${encodeURIComponent(query)}`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(12000),
            ]),
          },
        );
        if (!response.ok) throw new Error();
        const games = catalogSchema.parse(await response.json()).games;
        if (controller.signal.aborted) return;
        setResults(games);
        setSearchStatus(
          games.length
            ? `${games.length} ${games.length === 1 ? "match" : "matches"}. Choose a title below.`
            : "No matches. You can still add this game manually.",
        );
      } catch {
        if (controller.signal.aborted) return;
        setSearchStatus(
          "Catalog search is unavailable. You can still add this game manually.",
        );
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, existing, discard, deleting]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = gameSchema.safeParse({
      ...game,
      genres: game.genres.map((s) => s.trim()).filter(Boolean),
      categories: game.categories.map((s) => s.trim()).filter(Boolean),
    });
    if (!parsed.success) {
      setError(
        "Check the title and optional details. Notes allow up to 4,000 characters.",
      );
      return;
    }
    setBusy(true);
    try {
      await saveGame(parsed.data);
      onSaved(existing ? "Game updated." : "Game added to your library.");
      onClose();
    } catch {
      setError(
        "Could not save this game. Check available storage or whether it is already in your library.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="editor"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{existing ? "Your game" : "Add a game"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Your pace. Your way to play."
              : "Search the catalog or enter a title yourself."}
          </DialogDescription>
        </DialogHeader>
        {discard ? (
          <div className="confirm-stack">
            <h3>Discard your changes?</h3>
            <p>Your saved library will stay as it is.</p>
            <Button variant="destructive" onClick={onClose}>
              Discard changes
            </Button>
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Keep editing
            </Button>
          </div>
        ) : deleting ? (
          <div className="confirm-stack">
            <h3>Remove {game.title}?</h3>
            <p>This removes the game and its notes from this device.</p>
            <Button
              disabled={busy}
              variant="destructive"
              onClick={async () => {
                setBusy(true);
                try {
                  await db.games.delete(game.id);
                  onSaved("Game removed.");
                  onClose();
                } catch {
                  setError("Could not remove the game. Try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove game
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => setDeleting(false)}
            >
              Keep game
            </Button>
            {error && <p role="alert">{error}</p>}
          </div>
        ) : (
          <form onSubmit={save}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="game-title">Game title</FieldLabel>
                <div className="search-row">
                  <Input
                    id="game-title"
                    name="title"
                    autoComplete="off"
                    maxLength={200}
                    required
                    value={game.title}
                    aria-describedby={!existing ? "catalog-status" : undefined}
                    onChange={(e) => {
                      change("title", e.target.value);
                      const nextQuery = e.target.value.trim();
                      if (nextQuery !== query) {
                        setResults([]);
                        setSearchStatus("");
                        setQuery(nextQuery);
                      }
                    }}
                    placeholder="e.g. A Short Hike"
                  />
                </div>
                {!existing && (
                  <p
                    id="catalog-status"
                    className="catalog-status"
                    role="status"
                  >
                    {searchStatus ||
                      "Suggestions appear as you type. You can also enter your own title."}
                  </p>
                )}
              </Field>
              {results.length > 0 && (
                <div
                  className="catalog-results"
                  role="region"
                  aria-label="Catalog results"
                >
                  {results.map((item) => (
                    <button
                      type="button"
                      key={item.igdbId}
                      onClick={() => {
                        setGame((g) => ({
                          ...g,
                          title: item.title,
                          igdbId: item.igdbId,
                          cover: item.cover,
                          genres: item.genres,
                        }));
                        setResults([]);
                        setQuery("");
                        setSearchStatus(
                          "Title selected. Add any details below.",
                        );
                        document.getElementById("game-title")?.focus();
                      }}
                    >
                      <div aria-hidden="true">
                        <Cover game={item} />
                      </div>
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {game.cover && (
                <div className="selected-game">
                  <Cover game={game} />
                  <span>{game.title}</span>
                </div>
              )}
              <Field>
                <FieldLabel>Ownership</FieldLabel>
                <ToggleGroup
                  type="single"
                  aria-label="Ownership"
                  variant="outline"
                  value={game.ownership}
                  onValueChange={(v) => {
                    if (v) change("ownership", v as Game["ownership"]);
                  }}
                >
                  <ToggleGroupItem value="owned">Owned</ToggleGroupItem>
                  <ToggleGroupItem value="wishlist">Wishlist</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <FieldSet>
                <FieldLegend>Where can you play?</FieldLegend>
                <FieldDescription>
                  Choose only the devices you can play this game on. You can
                  leave this for later.
                </FieldDescription>
                <ToggleGroup
                  type="multiple"
                  className="device-options"
                  aria-label="Playable devices"
                  variant="outline"
                  value={game.devices}
                  onValueChange={(v) => change("devices", v as Game["devices"])}
                >
                  {devices.map((d) => (
                    <ToggleGroupItem key={d} value={d}>
                      {d}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FieldSet>
              {game.ownership === "owned" && (
                <Field>
                  <FieldLabel htmlFor="game-status">Status</FieldLabel>
                  <NativeSelect
                    id="game-status"
                    value={game.status}
                    onChange={(e) =>
                      change("status", e.target.value as Game["status"])
                    }
                  >
                    {statuses.map((s) => (
                      <NativeSelectOption key={s}>{s}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <details>
                <summary>Optional details</summary>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="session">
                      Session preference
                    </FieldLabel>
                    <NativeSelect
                      id="session"
                      value={game.session}
                      onChange={(e) =>
                        change("session", e.target.value as Game["session"])
                      }
                    >
                      <NativeSelectOption value="unknown">
                        Not sure yet
                      </NativeSelectOption>
                      <NativeSelectOption value="short">
                        Short sessions
                      </NativeSelectOption>
                      <NativeSelectOption value="long">
                        Longer sessions
                      </NativeSelectOption>
                      <NativeSelectOption value="flexible">
                        Either works
                      </NativeSelectOption>
                    </NativeSelect>
                    <FieldDescription>
                      Your preference, not the game's total length.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="genres">Genres</FieldLabel>
                    <Input
                      id="genres"
                      name="genres"
                      value={game.genres.join(", ")}
                      onChange={(e) =>
                        change(
                          "genres",
                          e.target.value.split(",").map((s) => s.trimStart()),
                        )
                      }
                      placeholder="Adventure, RPG"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="categories">
                      Your categories
                    </FieldLabel>
                    <Input
                      id="categories"
                      name="categories"
                      value={game.categories.join(", ")}
                      onChange={(e) =>
                        change(
                          "categories",
                          e.target.value.split(",").map((s) => s.trimStart()),
                        )
                      }
                      placeholder="Weekend, Play next"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="notes">A note for later</FieldLabel>
                    <Textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      maxLength={4000}
                      value={game.notes}
                      onChange={(e) => change("notes", e.target.value)}
                      placeholder="Where you left off, or anything worth remembering…"
                    />
                  </Field>
                </FieldGroup>
              </details>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="editor-actions">
                <Button type="submit" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : existing
                      ? "Save changes"
                      : "Add to library"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={busy}
                >
                  Cancel
                </Button>
                {existing && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDeleting(true)}
                  >
                    Remove from library
                  </Button>
                )}
              </div>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
