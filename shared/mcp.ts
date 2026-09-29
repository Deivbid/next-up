import { z } from "zod";
export const mcpConnectionSchema = z.object({
  client_id: z.string().uuid(),
  client_name: z.string().min(1).max(200),
  permission: z.enum(["read", "write"]),
  resource: z.string().url(),
  granted_at: z.string(),
});
export type McpConnection = z.infer<typeof mcpConnectionSchema>;
export const oauthDetailsSchema = z.object({
  authorization_id: z.string().min(1).max(128),
  redirect_uri: z.string().url(),
  client: z.object({
    id: z.string().uuid(),
    name: z.string().max(200).default(""),
  }),
  scope: z.string().max(1000).default(""),
  user: z.object({ id: z.string().uuid() }),
});
export type OAuthDetails = z.infer<typeof oauthDetailsSchema>;
// Redirects are only taken from authenticated Supabase responses, never URL input.
export function safeOAuthRedirect(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error(
      "Unsupported callback URL. Use HTTPS or a localhost callback.",
    );
  return url.href;
}
