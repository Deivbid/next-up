import { useEffect, useState } from "react";
import type { Game } from "../domain/game";
import { artworkSchema } from "../../shared/contracts";
import { Cover } from "./Cover";

export function HeroArtwork({ game }: { game: Game }) {
  const [catalogArt, setCatalogArt] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const steamArt = game.steamId
    ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.steamId}/library_hero.jpg`
    : null;
  const url = steamArt ?? catalogArt;
  useEffect(() => {
    if (game.steamId || !game.igdbId) return;
    const controller = new AbortController();
    void fetch(`/api/artwork?igdbId=${game.igdbId}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const result = artworkSchema.parse(await response.json());
        if (!controller.signal.aborted) setCatalogArt(result.url);
      })
      .catch(() => {
        /* Artwork is optional; the original cover stays usable. */
      });
    return () => controller.abort();
  }, [game.steamId, game.igdbId]);
  return (
    <>
      {(!url || failed || !loaded) && (
        <div className="hero-artwork hero-artwork-fallback">
          <Cover game={game} eager />
        </div>
      )}
      {url && !failed && (
        <div
          className="hero-artwork"
          style={
            loaded ? undefined : { position: "absolute", visibility: "hidden" }
          }
        >
          <img
            src={url}
            alt=""
            width="1920"
            height="1080"
            fetchPriority="high"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </div>
      )}
    </>
  );
}
