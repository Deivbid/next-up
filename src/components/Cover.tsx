import { useState } from "react";
import { IconDeviceGamepad2 } from "@tabler/icons-react";
import type { Game } from "../domain/game";
export function Cover({
  game,
  eager = false,
}: {
  game: Pick<Game, "title" | "cover">;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="cover">
      {game.cover && !failed ? (
        <img
          src={game.cover}
          alt=""
          width="600"
          height="900"
          loading={eager ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-fallback">
          <IconDeviceGamepad2 aria-hidden="true" />
          <span>{game.title || "Your next game"}</span>
        </div>
      )}
    </div>
  );
}
