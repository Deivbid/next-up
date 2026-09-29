import { supabase } from "./supabase";

// Capture one account token for the whole operation, including provider cleanup.
export async function connectionToken(userId: string) {
  if (!supabase) throw new Error("Sign in to manage connections.");
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== userId)
    throw new Error(
      "Your account changed. Reload before managing connections.",
    );
  return data.session.access_token;
}
export async function saveConnection(
  token: string,
  clientId: string,
  name: string,
  permission: "read" | "write" | null,
  resource: string,
) {
  const { error } = await supabase!
    .rpc("next_up_set_mcp_connection", {
      p_client_id: clientId,
      p_client_name: name,
      p_permission: permission,
      p_resource: resource,
    })
    .setHeader("Authorization", `Bearer ${token}`)
    .abortSignal(AbortSignal.timeout(15000))
    .retry(false);
  if (error)
    throw new Error(
      "Could not save this permission. Check the connection and try again.",
    );
}
export async function revokeProviderGrant(token: string, clientId: string) {
  const result = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user/oauth/grants?client_id=${encodeURIComponent(clientId)}`,
    {
      method: "DELETE",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!result.ok && result.status !== 404)
    throw new Error(
      "Library access is removed. Click Remove access again to finish clearing the sign-in grant.",
    );
}

export async function decideAuthorization(
  token: string,
  id: string,
  action: "approve" | "deny",
) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/oauth/authorizations/${encodeURIComponent(id)}/consent`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(
      "Could not finish authorization. Start again from your AI app. You can remove saved permissions in Settings.",
    );
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("redirect_url" in data) ||
    typeof data.redirect_url !== "string"
  )
    throw new Error("The authorization response could not be verified.");
  return data.redirect_url;
}
