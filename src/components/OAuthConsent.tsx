import {
  connectionToken,
  saveConnection,
  decideAuthorization,
} from "../data/mcp-connections";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  IconDeviceGamepad2,
  IconArrowLeft,
  IconShieldCheck,
} from "@tabler/icons-react";
import { supabase } from "../data/supabase";
import {
  oauthDetailsSchema,
  safeOAuthRedirect,
  type OAuthDetails,
} from "../../shared/mcp";
import { Button } from "./ui/button";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { BrandLoader } from "./BrandLoader";

const pendingKey = "next-up-oauth-authorization";
function authorizationId() {
  const direct = new URLSearchParams(location.search).get("authorization_id");
  if (direct && /^[a-zA-Z0-9_-]{1,128}$/.test(direct)) return direct;
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
    if (
      saved &&
      typeof saved.id === "string" &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(saved.id) &&
      Date.now() - saved.createdAt < 600000
    )
      return saved.id as string;
  } catch {
    /* An expired/unavailable local return path must not authorize anything. */
  }
  return "";
}
export function OAuthConsent({
  session,
  onLogin,
  loginBusy,
  loginError,
}: {
  session: Session | null;
  onLogin: () => void;
  loginBusy: boolean;
  loginError: string;
}) {
  const [id] = useState(authorizationId);
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const loaded = useRef<Promise<void> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!session || !id || !supabase) return;
    // This GET can auto-approve an existing provider grant; do not call it twice in Strict Mode.
    if (!loaded.current)
      loaded.current = (async () => {
        try {
          const { data, error } =
            await supabase.auth.oauth.getAuthorizationDetails(id);
          if (error || !data)
            throw new Error(
              "This connection request expired or could not be loaded. Start again from your AI app.",
            );
          if (!alive.current) return;
          if ("redirect_url" in data) {
            sessionStorage.removeItem(pendingKey);
            location.assign(safeOAuthRedirect(data.redirect_url));
            return;
          }
          const validation = oauthDetailsSchema.safeParse(data);
          if (!validation.success)
            throw new Error(
              "The connection details could not be verified. Start again from your AI app.",
            );
          const parsed = validation.data;
          const identityScopes = parsed.scope.split(" ").filter(Boolean);
          if (
            identityScopes.some(
              (scope) =>
                ![
                  "openid",
                  "email",
                  "profile",
                  "phone",
                  "offline_access",
                ].includes(scope),
            )
          )
            throw new Error(
              "This app requested an unsupported permission. Start again with basic sign-in scopes.",
            );
          safeOAuthRedirect(parsed.redirect_uri);
          if (parsed.user.id !== session.user.id)
            throw new Error("This request belongs to another account.");
          setDetails(parsed);
        } catch (e) {
          if (alive.current)
            setError(
              e instanceof Error ? e.message : "Could not load the connection.",
            );
        }
      })();
  }, [session, id]);
  async function decide(approve: boolean) {
    if (!details || !supabase || !session || busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await connectionToken(session.user.id);
      if (approve) {
        await saveConnection(
          token,
          details.client.id,
          details.client.name || "AI app",
          permission,
          `${location.origin}/api/mcp`,
        );
        if (!alive.current) return;
      }
      const redirectUrl = await decideAuthorization(
        token,
        id,
        approve ? "approve" : "deny",
      );
      if (!alive.current) return;
      const redirect = safeOAuthRedirect(redirectUrl);
      const actual = new URL(redirect),
        expected = new URL(details.redirect_uri);
      if (
        actual.origin !== expected.origin ||
        actual.pathname !== expected.pathname
      )
        throw new Error("The callback did not match this connection request.");
      sessionStorage.removeItem(pendingKey);
      location.assign(redirect);
    } catch (e) {
      if (alive.current) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "Authorization failed.");
      }
    }
  }
  return (
    <div className="connection-page">
      <header className="connection-header">
        <a className="brand" href="/">
          <IconDeviceGamepad2 aria-hidden="true" />
          Next Up
        </a>
        <a href="/connect">
          <IconArrowLeft aria-hidden="true" /> About AI connections
        </a>
      </header>
      <main className="consent-panel">
        <IconShieldCheck className="consent-icon" aria-hidden="true" />
        <p className="eyebrow">Your library. Your permission.</p>
        <h1>
          {details
            ? `Connect ${details.client.name || "this AI app"}?`
            : "Connect your AI"}
        </h1>
        {!id ? (
          <p role="alert">
            No connection request was found. Start by adding the Next Up server
            in your AI app.
          </p>
        ) : !session ? (
          <>
            <p>
              Sign in to choose what this app can do with your Next Up library.
            </p>
            <Button
              disabled={loginBusy}
              onClick={() => {
                try {
                  sessionStorage.setItem(
                    pendingKey,
                    JSON.stringify({ id, createdAt: Date.now() }),
                  );
                  onLogin();
                } catch {
                  setError("Allow browser storage to continue signing in.");
                }
              }}
            >
              {loginBusy ? "Opening Google…" : "Continue with Google"}
            </Button>
          </>
        ) : !details && !error ? (
          <BrandLoader />
        ) : details ? (
          <>
            <p className="consent-account">
              Using <strong>{session.user.email}</strong>
            </p>
            <p>
              This app will be able to read your games, devices, preferences and
              notes to answer your questions.
            </p>
            <div className="permission-choice">
              <span id="permission-label">Choose access</span>
              <ToggleGroup
                type="single"
                value={permission}
                onValueChange={(v) => {
                  if (v === "read" || v === "write") setPermission(v);
                }}
                aria-labelledby="permission-label"
                disabled={busy}
                variant="outline"
              >
                <ToggleGroupItem value="read">Read only</ToggleGroupItem>
                <ToggleGroupItem value="write">Read & edit</ToggleGroupItem>
              </ToggleGroup>
              <p>
                {permission === "read"
                  ? "Recommendations and lookups. Your games stay as they are."
                  : "Also allows adding, editing and removing individual games. There’s no bulk-delete action or settings editor."}
              </p>
            </div>
            {details.scope.trim() && (
              <p className="connection-muted">
                Sign-in permissions requested:{" "}
                {details.scope
                  .split(" ")
                  .filter(Boolean)
                  .map(
                    (scope) =>
                      (
                        ({
                          openid: "account identity",
                          email: "email address",
                          profile: "basic profile",
                          phone: "phone number",
                          offline_access: "stay connected between sessions",
                        }) as Record<string, string>
                      )[scope],
                  )
                  .join(", ")}
                .
              </p>
            )}
            <div className="consent-destination">
              <span>Returning to</span>
              <code>
                {new URL(details.redirect_uri).host}
                {new URL(details.redirect_uri).pathname}
              </code>
              <small>
                Client names are supplied by the connecting app. Only continue
                if you started this request.
              </small>
            </div>
            <p className="connection-muted">
              You can remove this connection in Settings at any time.
              Information already shared may remain in your AI chat.
            </p>
            <div className="button-row">
              <Button disabled={busy} onClick={() => void decide(true)}>
                {busy ? "Working…" : "Allow connection"}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void decide(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : null}
        {(error || loginError) && (
          <p role="alert" className="connection-error">
            {error || loginError}
          </p>
        )}
      </main>
    </div>
  );
}
