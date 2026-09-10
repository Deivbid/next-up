import { useEffect, useMemo, useRef, useState } from "react";
import type { SteamGame } from "../../shared/contracts";
import { steamCoverUrl } from "../data/steam";
import { Cover } from "./Cover";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Field, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";

const pageSize = 24;

export function SteamGamePicker({
  games,
  existingIds,
  selected,
  disabled,
  onToggle,
}: {
  games: SteamGame[];
  existingIds: number[];
  selected: number[];
  disabled: boolean;
  onToggle: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const matches = useMemo(
    () =>
      games
        .filter((game) =>
          game.title.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => a.title.localeCompare(b.title)),
    [games, query],
  );
  const selectedIds = new Set(selected);
  const addedIds = new Set(existingIds);
  const hasMore = limit < matches.length;

  useEffect(() => {
    const root = scrollRef.current;
    const target = moreRef.current;
    if (!root || !target || disabled || !("IntersectionObserver" in window))
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setLimit((count) => count + pageSize);
        }
      },
      { root, rootMargin: "0px 0px 180px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [limit, matches, disabled]);

  return (
    <div className="steam-picker">
      <Field>
        <FieldLabel htmlFor="steam-search">Find a Steam game</FieldLabel>
        <Input
          id="steam-search"
          value={query}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(pageSize);
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
          }}
          placeholder="Search your Steam games…"
        />
      </Field>
      <p className="steam-results-count" role="status">
        {matches.length} {matches.length === 1 ? "game" : "games"} ·{" "}
        {selected.length} selected
      </p>
      <div
        className="steam-scroll"
        ref={scrollRef}
        role="region"
        aria-label="Steam games"
        tabIndex={0}
      >
        {matches.length === 0 && (
          <p className="steam-empty">
            {games.length === 0
              ? "No games were returned. Nothing will be imported."
              : "No matching games. Try another title."}
          </p>
        )}
        <div className="steam-grid">
          {matches.slice(0, limit).map((game) => (
            <label
              className="steam-game"
              key={game.steamId}
              data-selected={selectedIds.has(game.steamId)}
            >
              <div className="steam-art" aria-hidden="true">
                <Cover
                  game={{
                    title: game.title,
                    cover: steamCoverUrl(game.steamId),
                  }}
                />
              </div>
              <input
                type="checkbox"
                checked={selectedIds.has(game.steamId)}
                disabled={disabled}
                onChange={() => onToggle(game.steamId)}
                aria-label={game.title}
              />
              <span className="steam-game-title">{game.title}</span>
              {addedIds.has(game.steamId) && (
                <Badge variant="secondary">Already added</Badge>
              )}
            </label>
          ))}
        </div>
        {hasMore && (
          <Button
            ref={moreRef}
            className="steam-more"
            variant="outline"
            disabled={disabled}
            onClick={() => setLimit((count) => count + pageSize)}
          >
            Show more Steam games
          </Button>
        )}
      </div>
    </div>
  );
}
