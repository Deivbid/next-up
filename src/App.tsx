import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  IconDeviceGamepad2,
  IconHome,
  IconBooks,
  IconSettings,
  IconPlus,
  IconArrowRight,
  IconDeviceDesktop,
  IconClock,
  IconDownload,
  IconUpload,
  IconBrandSteam,
  IconWifiOff,
  IconCheck,
} from "@tabler/icons-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { CloudLibrary } from "./data/cloud-library";
import { readDraft, readDraftRevision, clearDraft } from "./data/draft";
import {
  defaultPreferences,
  devices,
  newGame,
  statuses,
  type Device,
  type Game,
  type Preferences,
} from "./domain/game";
import { recommend } from "./domain/recommend";
import { demoGames } from "./data/demo";
import { parseBackup, type Backup } from "./data/backup";
import { steamCoverUrl, ensureSteamOwner } from "./data/steam";
import {
  providerSchema,
  steamLibrarySchema,
  type SteamGame,
} from "../shared/contracts";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Alert, AlertDescription } from "./components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "./components/ui/empty";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldSet,
  FieldLegend,
} from "./components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "./components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { BrandLoader } from "./components/BrandLoader";
import { HeroArtwork } from "./components/HeroArtwork";
import { Cover } from "./components/Cover";
import { GameEditor } from "./components/GameEditor";
import { SteamGamePicker } from "./components/SteamGamePicker";

function currentPage() {
  const page = location.hash.slice(1);
  return ["library", "settings"].includes(page) ? page : "today";
}
const navigation = [
  { id: "today", name: "Today", icon: IconHome },
  { id: "library", name: "Library", icon: IconBooks },
  { id: "settings", name: "Settings", icon: IconSettings },
];
export default function App({
  library,
  profilePanel,
  accountNotices,
}: {
  library: CloudLibrary;
  profilePanel: ReactNode;
  accountNotices: ReactNode;
}) {
  const cloud = useSyncExternalStore(library.subscribe, library.getSnapshot);
  const games = cloud.snapshot?.games;
  const preferences = cloud.snapshot?.preferences ?? defaultPreferences;
  const [page, setPage] = useState(currentPage);
  const [editor, setEditorState] = useState<Game | null>(() =>
    readDraft(library.userId),
  );
  const [editorRevision, setEditorRevision] = useState(() =>
    readDraftRevision(library.userId),
  );
  const setEditor = (game: Game | null) => {
    if (game) setEditorRevision(cloud.snapshot?.revision ?? -1);
    setEditorState(game);
  };
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [device, setDevice] = useState<Device>("Steam Deck");
  const [minutes, setMinutes] = useState(30);
  const [genre, setGenre] = useState("");
  const [ownership, setOwnership] = useState("owned");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [libraryLimit, setLibraryLimit] = useState(48);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [erase, setErase] = useState(false);
  const [confirmRevision, setConfirmRevision] = useState<number | undefined>();
  const [actionBusy, setBusy] = useState(false);
  const busy = actionBusy || cloud.busy;
  const [providers, setProviders] = useState({
    catalog: false,
    steam: false,
    connected: false,
  });
  const [steamGames, setSteamGames] = useState<SteamGame[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const importInput = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const navigate = () => {
      setPage(currentPage());
      requestAnimationFrame(() => {
        mainRef.current?.focus();
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    };
    window.addEventListener("hashchange", navigate);
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("hashchange", navigate);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.classList.toggle(
      "dark",
      preferences.theme === "dark",
    );
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        preferences.theme === "dark" ? "#141618" : "#f5f6f1",
      );
  }, [preferences.theme]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/providers", { signal: controller.signal })
      .then((r) => r.json())
      .then(async (body) => {
        const parsed = providerSchema.parse(body);
        const safe = await ensureSteamOwner(library.userId, parsed.connected);
        if (!controller.signal.aborted)
          setProviders({ ...parsed, connected: parsed.connected && safe });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [page, library.userId]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function action(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      setNotice(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Refresh your library before trying again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function changePreferences(patch: Partial<Preferences>) {
    await action(
      () => library.change({ preferences: { ...preferences, ...patch } }),
      "Settings saved.",
    );
  }
  async function loadDemo() {
    await action(async () => {
      if (games?.length) throw new Error("Library must be empty");
      await library.change({ games: demoGames() });
    }, "Example games added. You can edit or remove them.");
  }
  async function exportData() {
    await action(async () => {
      if (!cloud.snapshot)
        throw new Error("Open your library before exporting.");
      const data = {
        application: "next-up",
        exportedAt: new Date().toISOString(),
        games: cloud.snapshot.games,
        preferences: cloud.snapshot.preferences,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `next-up-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }, "Backup downloaded.");
  }
  async function readBackup(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Backup must be smaller than 10 MB.");
      setBackup(parseBackup(await file.text()));
      setConfirmRevision(cloud.snapshot?.revision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this backup.");
    }
  }
  async function previewSteam() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/steam/library", {
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error();
      const parsed = steamLibrarySchema.parse(await r.json());
      setSteamGames(parsed.games);
      setSelected([]);
    } catch {
      setError(
        "Could not read your Steam library. Check your connection and Steam game-details privacy, then try again. Your library has not changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  const owned = games?.filter((g) => g.ownership === "owned") ?? [];
  const current = owned.filter((g) => g.status === "Playing");
  const availableDevices = preferences.devices;
  const activeDevice = availableDevices.includes(device)
    ? device
    : availableDevices[0];
  const recommendations =
    games && activeDevice
      ? recommend(games, { device: activeDevice, minutes, genre })
      : [];
  const genres = [...new Set(owned.flatMap((g) => g.genres))].sort();
  const visible =
    games
      ?.filter(
        (g) =>
          g.ownership === ownership &&
          (!status || g.status === status) &&
          `${g.title} ${g.categories.join(" ")}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      )
      .sort((a, b) => a.title.localeCompare(b.title)) ?? [];
  return (
    <>
      <a
        className="skip-link"
        href="#content"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#today">
            <IconDeviceGamepad2 aria-hidden="true" />
            <span>Next Up</span>
          </a>
          <nav aria-label="Main navigation">
            {navigation.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={page === item.id ? "page" : undefined}
              >
                <item.icon aria-hidden="true" />
                <span>{item.name}</span>
              </a>
            ))}
          </nav>
          <Button onClick={() => setEditor(newGame())}>
            <IconPlus data-icon="inline-start" aria-hidden="true" />
            Add game
          </Button>
        </div>
      </header>
      <main id="content" ref={mainRef} tabIndex={-1} className="app-main">
        {accountNotices}
        {offline && (
          <Alert>
            <IconWifiOff aria-hidden="true" />
            <AlertDescription>
              You’re offline. You can read the saved copy of your library.
              Connect to save changes, search the catalog or use Steam.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <Button variant="ghost" onClick={() => setError("")}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div key={page} className="page-enter">
          {page === "today" && (
            <>
              <div className="page-heading">
                <p className="eyebrow">Make room for a good game</p>
                <h1>
                  A little time.
                  <br className="mobile-break" /> A good game.
                </h1>
                <p>Pick something that fits right now.</p>
              </div>
              {games === undefined ? (
                <div className="library-loading">
                  <BrandLoader />
                </div>
              ) : games.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia>
                      <IconDeviceGamepad2 aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>Your next good game starts here.</EmptyTitle>
                    <EmptyDescription>
                      Add a game you own, or try a small example library to get
                      a feel for Next Up.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button onClick={() => setEditor(newGame())}>
                      Add your first game
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={loadDemo}
                    >
                      Try example library
                    </Button>
                    <p className="quiet">
                      Examples include personal preferences, not verified device
                      recommendations.
                    </p>
                  </EmptyContent>
                </Empty>
              ) : (
                <>
                  {current.length > 0 && (
                    <section
                      aria-labelledby="current-heading"
                      className="current-game"
                    >
                      <div className="current-copy">
                        <p id="current-heading" className="eyebrow">
                          Currently playing
                          {current.length > 1
                            ? ` · ${current.length} games`
                            : ""}
                        </p>
                        <h2>{current[0].title}</h2>
                        <p>
                          <IconDeviceDesktop aria-hidden="true" />
                          {current[0].devices.join(" · ") || "Choose a device"}
                        </p>
                        {current[0].notes && (
                          <p className="current-note">{current[0].notes}</p>
                        )}
                        <Button onClick={() => setEditor(current[0])}>
                          View game
                          <IconArrowRight
                            data-icon="inline-end"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                      <HeroArtwork
                        key={`${current[0].id}:${current[0].steamId}:${current[0].igdbId}:${current[0].cover}`}
                        game={current[0]}
                      />
                    </section>
                  )}
                  <section
                    className="recommendations"
                    aria-labelledby="fit-heading"
                  >
                    <div className="section-heading">
                      <h2 id="fit-heading">What fits today?</h2>
                      <span className="quiet">
                        A few good options. No pressure.
                      </span>
                    </div>
                    <div className="occasion-filters">
                      <Field>
                        <FieldLabel htmlFor="device">Device</FieldLabel>
                        <NativeSelect
                          id="device"
                          value={activeDevice ?? ""}
                          onChange={(e) => setDevice(e.target.value as Device)}
                        >
                          {availableDevices.length === 0 && (
                            <NativeSelectOption value="">
                              Choose devices in Settings
                            </NativeSelectOption>
                          )}
                          {availableDevices.map((d) => (
                            <NativeSelectOption key={d}>{d}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="time">Time you have</FieldLabel>
                        <NativeSelect
                          id="time"
                          value={minutes}
                          onChange={(e) => setMinutes(Number(e.target.value))}
                        >
                          {[15, 30, 45, 60, 120].map((t) => (
                            <NativeSelectOption key={t} value={t}>
                              {t === 120 ? "2 hours or more" : `${t} minutes`}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="genre">
                          Genre · optional
                        </FieldLabel>
                        <NativeSelect
                          id="genre"
                          value={genre}
                          onChange={(e) => setGenre(e.target.value)}
                        >
                          <NativeSelectOption value="">
                            Any genre
                          </NativeSelectOption>
                          {genres.map((g) => (
                            <NativeSelectOption key={g}>{g}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Field>
                    </div>
                    <div className="recommendation-grid">
                      {recommendations.map(({ game, reasons }) => (
                        <article className="recommendation" key={game.id}>
                          <button
                            className="game-open"
                            onClick={() => setEditor(game)}
                            aria-label={`View ${game.title}`}
                          >
                            <Cover game={game} />
                            <div className="recommendation-copy">
                              <h3>{game.title}</h3>
                              <p className="device-line">
                                <IconDeviceGamepad2 aria-hidden="true" />
                                {activeDevice}
                              </p>
                              <p className="reason">
                                <IconCheck aria-hidden="true" />
                                {reasons[1]}
                              </p>
                              <Badge variant="secondary">{game.status}</Badge>
                            </div>
                          </button>
                        </article>
                      ))}
                    </div>
                    {recommendations.length === 0 && (
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>
                            No games match this occasion yet.
                          </EmptyTitle>
                          <EmptyDescription>
                            Try another device or genre, or add where you can
                            play your games. Finished games and your wishlist
                            stay out of these suggestions.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button variant="outline" asChild>
                            <a href="#library">Open your library</a>
                          </Button>
                        </EmptyContent>
                      </Empty>
                    )}
                  </section>
                </>
              )}
            </>
          )}
          {page === "library" && (
            <>
              <div className="page-heading">
                <p className="eyebrow">Your collection, together</p>
                <h1>Your library</h1>
                <p>Good games, at your pace.</p>
              </div>
              <div className="library-tools">
                <Field>
                  <FieldLabel className="sr-only" htmlFor="find">
                    Find a game or category
                  </FieldLabel>
                  <Input
                    id="find"
                    name="search"
                    type="search"
                    placeholder="Find a game or category…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setLibraryLimit(48);
                    }}
                  />
                </Field>
                <div className="library-switches">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    aria-label="Library ownership"
                    value={ownership}
                    onValueChange={(v) => {
                      if (v) {
                        setOwnership(v);
                        setLibraryLimit(48);
                        setStatus("");
                      }
                    }}
                  >
                    <ToggleGroupItem value="owned">
                      Owned · {owned.length}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="wishlist">
                      Wishlist · {(games?.length ?? 0) - owned.length}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {ownership === "owned" && (
                    <NativeSelect
                      aria-label="Filter by status"
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setLibraryLimit(48);
                      }}
                    >
                      <NativeSelectOption value="">
                        All statuses
                      </NativeSelectOption>
                      {statuses.map((s) => (
                        <NativeSelectOption key={s}>{s}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </div>
              </div>
              <p className="result-count" role="status">
                {visible.length} {visible.length === 1 ? "game" : "games"}
              </p>
              <div className="library-grid">
                {visible.slice(0, libraryLimit).map((game) => (
                  <article key={game.id}>
                    <button
                      className="game-open library-game"
                      aria-label={`View ${game.title}`}
                      onClick={() => setEditor(game)}
                    >
                      <Cover game={game} />
                      <h2>{game.title}</h2>
                      <p>
                        {game.ownership === "owned" ? game.status : "Wishlist"}{" "}
                        · {game.devices.join(" / ") || "Device not set"}
                      </p>
                      {game.categories.length > 0 && (
                        <p className="quiet">{game.categories.join(" · ")}</p>
                      )}
                    </button>
                  </article>
                ))}
              </div>
              {visible.length > libraryLimit && (
                <div className="button-row">
                  <Button
                    variant="outline"
                    onClick={() => setLibraryLimit((n) => n + 48)}
                  >
                    Show more games
                  </Button>
                </div>
              )}
              {games && visible.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {query || status
                        ? "No matches this time."
                        : "Room for something good."}
                    </EmptyTitle>
                    <EmptyDescription>
                      {query || status
                        ? "Try another search or status."
                        : "Add a game whenever something catches your eye."}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      onClick={() =>
                        setEditor({
                          ...newGame(),
                          ownership: ownership as Game["ownership"],
                        })
                      }
                    >
                      Add a game
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <p className="eyebrow">Make yourself at home</p>
                <h1>Settings</h1>
                <p>A few preferences. Everything stays yours.</p>
              </div>
              <div className="settings-grid">
                {profilePanel}
                <section>
                  <h2>Your setup</h2>
                  <FieldGroup>
                    <FieldSet>
                      <FieldLegend>Devices you use</FieldLegend>
                      <ToggleGroup
                        type="multiple"
                        variant="outline"
                        className="device-options"
                        aria-label="Your devices"
                        value={preferences.devices}
                        onValueChange={(v) =>
                          void changePreferences({ devices: v as Device[] })
                        }
                      >
                        {devices.map((d) => (
                          <ToggleGroupItem disabled={busy} key={d} value={d}>
                            {d}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FieldSet>
                    <Field>
                      <FieldLabel>Appearance</FieldLabel>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        aria-label="Theme"
                        value={preferences.theme}
                        onValueChange={(v) => {
                          if (v)
                            void changePreferences({
                              theme: v as Preferences["theme"],
                            });
                        }}
                      >
                        <ToggleGroupItem disabled={busy} value="dark">
                          Dark
                        </ToggleGroupItem>
                        <ToggleGroupItem disabled={busy} value="light">
                          Light
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </Field>
                  </FieldGroup>
                </section>
                <section>
                  <h2>Your data</h2>
                  <p>
                    Saved to your account. Changes appear on your other devices
                    when you open or refresh Next Up. A local copy is available
                    for offline reading.
                  </p>
                  <div className="button-row">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={exportData}
                    >
                      <IconDownload
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      Export backup
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => importInput.current?.click()}
                    >
                      <IconUpload data-icon="inline-start" aria-hidden="true" />
                      Restore backup
                    </Button>
                    <input
                      aria-label="Choose backup file"
                      className="sr-only"
                      type="file"
                      accept=".json,application/json"
                      ref={importInput}
                      onChange={(e) => {
                        void readBackup(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setConfirmRevision(cloud.snapshot?.revision);
                      setErase(true);
                    }}
                  >
                    Delete library data
                  </Button>
                </section>
                <section>
                  <h2>Optional connections</h2>
                  <p>
                    Use the catalog to find games faster. Connect Steam to
                    choose games to import; your notes and categories stay
                    intact.
                  </p>
                  <div className="provider-line">
                    <span>IGDB catalog</span>
                    <Badge variant="secondary">
                      {providers.catalog ? "Configured" : "Not configured"}
                    </Badge>
                  </div>
                  <div className="provider-line">
                    <span>Steam</span>
                    <Badge variant="secondary">
                      {providers.connected
                        ? "Connected"
                        : providers.steam
                          ? "Available"
                          : "Not configured"}
                    </Badge>
                  </div>
                  {providers.steam ? (
                    <div className="button-row">
                      {providers.connected ? (
                        <>
                          <Button onClick={previewSteam} disabled={busy}>
                            <IconBrandSteam
                              data-icon="inline-start"
                              aria-hidden="true"
                            />
                            Choose games to import
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={async () => {
                              if (
                                await action(async () => {
                                  const r = await fetch("/api/steam/logout", {
                                    method: "POST",
                                    headers: { "X-Next-Up": "1" },
                                  });
                                  if (!r.ok) throw new Error();
                                }, "Steam disconnected.")
                              )
                                setProviders((p) => ({
                                  ...p,
                                  connected: false,
                                }));
                            }}
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button asChild>
                          <a
                            href="/api/steam/login"
                            onClick={() =>
                              sessionStorage.setItem(
                                "next-up-steam-login-owner",
                                library.userId,
                              )
                            }
                          >
                            <IconBrandSteam
                              data-icon="inline-start"
                              aria-hidden="true"
                            />
                            Connect Steam
                          </a>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="quiet">
                      Personal API credentials are needed in the local server
                      setup. Manual entry works without them.
                    </p>
                  )}
                </section>
                <section>
                  <h2>Take it with you</h2>
                  <p>
                    Install Next Up from your browser menu. On iPhone, use
                    Safari’s Share menu → Add to Home Screen.
                  </p>
                  <p className="quiet">
                    {offlineReady
                      ? "The app is ready to open offline."
                      : "Offline support is enabled in the production build."}{" "}
                    Previously loaded covers may be available offline; missing
                    artwork gets a placeholder.
                  </p>
                  <p className="quiet">
                    Your library is private to your account. Export a backup
                    whenever you want.
                  </p>
                </section>
              </div>
            </>
          )}
        </div>
        <footer className="app-footer">
          <span>Less choosing. More playing.</span>
          <span>
            <IconClock aria-hidden="true" />
            At your own pace.
          </span>
        </footer>
      </main>
      <div className="toast" role="status" aria-live="polite">
        {notice && (
          <span>
            <IconCheck aria-hidden="true" />
            {notice}
          </span>
        )}
      </div>
      {needRefresh && (
        <aside className="update-prompt" aria-label="App update">
          <p>
            A new version is ready.
            {editor
              ? " Finish editing before updating."
              : " Your saved library stays here."}
          </p>
          <Button
            disabled={!!editor || busy || !!backup || !!steamGames || erase}
            onClick={() => void updateServiceWorker(true)}
          >
            Update now
          </Button>
        </aside>
      )}
      {editor && (
        <GameEditor
          key={editor.id}
          initial={editor}
          library={library}
          expectedRevision={editorRevision}
          onClose={() => {
            clearDraft(library.userId);
            setEditor(null);
          }}
          onSaved={setNotice}
        />
      )}
      <Dialog
        open={!!backup || erase}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setBackup(null);
            setErase(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {backup ? "Restore this backup?" : "Delete your library?"}
            </DialogTitle>
            <DialogDescription>
              {backup
                ? `This replaces your current library and settings with ${backup.games.length} games from the backup. Export your current data first if you want to keep it.`
                : "This removes your games, notes and preferences from your account on all devices. Your Google account stays connected. Export a backup first if you want to keep them."}
            </DialogDescription>
          </DialogHeader>
          <div className="button-row">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                const ok = await action(
                  () =>
                    backup
                      ? library.change(
                          {
                            games: backup.games,
                            preferences: backup.preferences,
                            replace: true,
                          },
                          confirmRevision,
                        )
                      : library.change(
                          {
                            games: [],
                            preferences: defaultPreferences,
                            replace: true,
                          },
                          confirmRevision,
                        ),
                  backup ? "Backup restored." : "Library data deleted.",
                );
                if (ok) {
                  setBackup(null);
                  setErase(false);
                }
              }}
            >
              {busy
                ? "Saving…"
                : backup
                  ? "Replace with backup"
                  : "Delete everything"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setBackup(null);
                setErase(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={steamGames !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSteamGames(null);
        }}
      >
        <DialogContent className="steam-import">
          <DialogHeader>
            <DialogTitle>Choose what comes with you.</DialogTitle>
            <DialogDescription>
              Existing games keep your edits. Steam collections aren’t included,
              and Steam Deck compatibility is not checked.
            </DialogDescription>
          </DialogHeader>
          {steamGames && (
            <SteamGamePicker
              games={steamGames}
              existingIds={
                games?.flatMap((g) => (g.steamId ? [g.steamId] : [])) ?? []
              }
              selected={selected}
              disabled={busy}
              onToggle={(id) =>
                setSelected((ids) =>
                  ids.includes(id)
                    ? ids.filter((value) => value !== id)
                    : [...ids, id],
                )
              }
            />
          )}
          <div className="steam-import-actions">
            <Button
              disabled={busy || !selected.length}
              onClick={async () => {
                if (
                  await action(
                    () =>
                      library.change({
                        games: (steamGames ?? [])
                          .filter(
                            (g) =>
                              selected.includes(g.steamId) &&
                              !games?.some(
                                (existing) => existing.steamId === g.steamId,
                              ),
                          )
                          .map((g) => ({
                            ...newGame(),
                            ...g,
                            devices: ["PC"] as Device[],
                            cover: steamCoverUrl(g.steamId),
                          })),
                      }),
                    "Selected games imported. Existing edits preserved.",
                  )
                )
                  setSteamGames(null);
              }}
            >
              Import {selected.length}{" "}
              {selected.length === 1 ? "game" : "games"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setSteamGames(null)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
