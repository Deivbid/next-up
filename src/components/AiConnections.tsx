import {
  connectionToken,
  saveConnection,
  revokeProviderGrant,
} from "../data/mcp-connections";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../data/supabase";
import { mcpConnectionSchema, type McpConnection } from "../../shared/mcp";
import { Button } from "./ui/button";

export function AiConnections({ userId }: { userId: string }) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    const controller = new AbortController();
    void supabase
      .from("mcp_connections")
      .select("client_id,client_name,permission,resource,granted_at")
      .order("granted_at", { ascending: false })
      .limit(100)
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        if (error)
          setError(
            "AI connections could not be loaded. Your games are unaffected.",
          );
        else {
          const parsed = z.array(mcpConnectionSchema).safeParse(data);
          if (parsed.success) setConnections(parsed.data);
          else setError("Could not read your AI connections.");
        }
        setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function disconnect(connection: McpConnection) {
    if (!supabase || busy) return;
    setBusy(connection.client_id);
    setError("");
    try {
      const token = await connectionToken(userId);
      await saveConnection(
        token,
        connection.client_id,
        connection.client_name,
        null,
        connection.resource,
      );
      await revokeProviderGrant(token, connection.client_id);
      if (!alive.current) return;
      setConnections((current) =>
        current.filter((c) => c.client_id !== connection.client_id),
      );
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Could not remove access.");
    } finally {
      if (alive.current) setBusy("");
    }
  }
  return (
    <section
      className="ai-connections"
      aria-labelledby="ai-connections-heading"
    >
      <h2 id="ai-connections-heading">AI connections</h2>
      <p>Let your AI app work with your library. You choose what it can do.</p>
      <a className="connection-doc-link" href="/connect">
        How to connect your AI ↗
      </a>
      {loading ? (
        <p role="status">Loading connections…</p>
      ) : !error && !connections.length ? (
        <p className="connection-muted">No AI apps connected yet.</p>
      ) : null}
      <ul>
        {connections.map((c) => (
          <li key={c.client_id}>
            <div>
              <strong>{c.client_name}</strong>
              <span>
                {c.permission === "write" ? "Read & edit" : "Read only"}
              </span>
            </div>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => void disconnect(c)}
              aria-label={`Remove access for ${c.client_name}`}
            >
              {busy === c.client_id ? "Removing…" : "Remove access"}
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="connection-error">
          {error}
        </p>
      )}
    </section>
  );
}
