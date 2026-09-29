import { OAuthConsent } from "./OAuthConsent";
import { AiConnections } from "./AiConnections";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../data/supabase";
import { CloudLibrary } from "../data/cloud-library";
import { BrandLoader } from "./BrandLoader";
import { Landing } from "./Landing";
import { Button } from "./ui/button";
import { db } from "../data/db";
import { parseBackup, type Backup } from "../data/backup";
import { defaultPreferences } from "../domain/game";
const App = lazy(() => import("../App"));

export function downloadBackup(backup: Backup) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `next-up-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function AccountLibrary({
  library,
  email,
  onLogout,
}: {
  library: CloudLibrary;
  email: string;
  onLogout: () => Promise<void>;
}) {
  const state = useSyncExternalStore(library.subscribe, library.getSnapshot);
  const [legacy, setLegacy] = useState<Backup | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    try {
      const owner = localStorage.getItem("next-up-legacy-owner");
      if (owner && owner !== library.userId) return;
    } catch {
      return;
    }
    void db
      .transaction("r", db.games, db.preferences, async () => ({
        application: "next-up",
        exportedAt: new Date().toISOString(),
        games: await db.games.toArray(),
        preferences:
          (await db.preferences.get("preferences")) ?? defaultPreferences,
      }))
      .then((data) => {
        if (live && data.games.length)
          setLegacy(parseBackup(JSON.stringify(data)));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [library.userId]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void library.refresh();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [library]);
  const pendingLegacy =
    legacy?.games.filter(
      (g) =>
        !state.snapshot?.games.some(
          (e) =>
            e.id === g.id ||
            (g.steamId !== undefined && e.steamId === g.steamId) ||
            (g.igdbId !== undefined && e.igdbId === g.igdbId),
        ),
    ) ?? [];
  const profile = (
    <>
      <section className="account-profile" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile</h2>
        <p>Signed in with Google</p>
        <p className="profile-email">{email || "Your account"}</p>
        <div className="button-row">
          <Button
            variant="outline"
            disabled={state.busy}
            onClick={() => void library.refresh()}
          >
            Refresh library
          </Button>
          <Button
            variant="ghost"
            disabled={state.busy}
            onClick={() =>
              void onLogout().catch(() =>
                setError(
                  "Could not sign out. Check your connection and try again.",
                ),
              )
            }
          >
            Sign out
          </Button>
        </div>
      </section>
      <AiConnections userId={library.userId} />
    </>
  );
  const notices = (
    <>
      {(state.error || error) && (
        <div className="cloud-warning" role="alert">
          <p>{error || state.error}</p>
          {state.error && (
            <Button
              variant="outline"
              disabled={state.busy}
              onClick={() => void library.refresh()}
            >
              Try again
            </Button>
          )}
        </div>
      )}
      {legacy && pendingLegacy.length > 0 && (
        <section
          className="migration-panel"
          aria-label="Bring your local library"
        >
          <h2>Bring your games with you</h2>
          <p>
            This browser has {legacy.games.length} games from the original local
            library. Download a backup, then import them into this account.
            Games already in your account keep their edits. The original local
            copy stays untouched.
          </p>
          <div className="button-row">
            <Button
              variant="outline"
              onClick={() => {
                downloadBackup(legacy);
                setBackedUp(true);
              }}
            >
              Download local backup
            </Button>
            <Button
              disabled={!backedUp || state.busy || !state.verified}
              onClick={async () => {
                try {
                  const existing = state.snapshot?.games ?? [];
                  const additions = legacy.games.filter(
                    (g) =>
                      !existing.some(
                        (e) =>
                          e.id === g.id ||
                          (g.steamId !== undefined &&
                            e.steamId === g.steamId) ||
                          (g.igdbId !== undefined && e.igdbId === g.igdbId),
                      ),
                  );
                  localStorage.setItem("next-up-legacy-owner", library.userId);
                  await library.change({
                    games: additions,
                    ...(state.snapshot?.revision === 0
                      ? { preferences: legacy.preferences }
                      : {}),
                  });
                  setLegacy(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Import failed.");
                }
              }}
            >
              Import into my account
            </Button>
            <Button variant="ghost" onClick={() => setLegacy(null)}>
              Not now
            </Button>
          </div>
        </section>
      )}
    </>
  );
  return (
    <Suspense
      fallback={
        <main className="auth-loading">
          <h1 className="sr-only">Next Up</h1>
          <BrandLoader />
        </main>
      }
    >
      <App library={library} profilePanel={profile} accountNotices={notices} />
    </Suspense>
  );
}
function SignedIn({ session }: { session: Session }) {
  const [library, setLibrary] = useState<CloudLibrary | null>(null);
  useEffect(() => {
    const next = new CloudLibrary(supabase!, session.user.id);
    setLibrary(next);
    void next.start();
    return () => {
      void next.dispose();
    };
  }, [session.user.id]);
  if (!library)
    return (
      <main className="auth-loading">
        <h1 className="sr-only">Next Up</h1>
        <BrandLoader />
      </main>
    );
  return (
    <AccountLibrary
      library={library}
      email={session.user.email ?? ""}
      onLogout={async () => {
        // Remove the optional Steam connection too; no provider credentials are saved in Supabase.
        await fetch("/api/steam/logout", {
          method: "POST",
          headers: { "X-Next-Up": "1" },
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
        localStorage.removeItem("next-up-steam-owner");
        const { error } = await supabase!.auth.signOut({ scope: "local" });
        if (error) throw error;
        await library.dispose(true);
        sessionStorage.removeItem(`next-up-draft:${session.user.id}`);
      }}
    />
  );
}
export function AccountGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const received = useRef(false);
  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setError("Sign-in is not configured in this build.");
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, value) => {
      received.current = true;
      setSession(value);
      setBusy(false);
    });
    const timer = setTimeout(() => {
      if (!received.current) {
        setError(
          "Sign-in is taking longer than expected. Reload to try again.",
        );
        setSession(null);
      }
    }, 20000);
    const parameters = new URLSearchParams(location.search);
    if (parameters.has("error")) {
      setError("Google sign-in was not completed. You can try again.");
      history.replaceState(null, "", location.pathname);
    }
    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!session) {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.classList.add("dark");
    }
  }, [session]);
  if (session === undefined)
    return (
      <main className="auth-loading">
        <h1 className="sr-only">Next Up</h1>
        <BrandLoader />
      </main>
    );
  function login() {
    if (!supabase) {
      setError("Sign-in is not configured in this build.");
      return;
    }
    setBusy(true);
    setError("");
    void supabase.auth
      .signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            location.origin +
            (location.pathname === "/oauth/consent" ? "/oauth/consent" : "/"),
        },
      })
      .then(({ error }) => {
        if (error) {
          setBusy(false);
          setError("Could not open Google sign-in. Please try again.");
        }
      })
      .catch(() => {
        setBusy(false);
        setError("Could not open Google sign-in. Check your connection.");
      });
  }
  if (location.pathname === "/oauth/consent")
    return (
      <OAuthConsent
        key={session?.user.id ?? "guest"}
        session={session}
        onLogin={login}
        loginBusy={busy}
        loginError={error}
      />
    );
  if (session) return <SignedIn key={session.user.id} session={session} />;
  return <Landing busy={busy} error={error} onLogin={login} />;
}
