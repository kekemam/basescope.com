import "server-only";
import { createHash, randomBytes } from "node:crypto";

const AUTHORIZE_URL = "https://api.supabase.com/v1/oauth/authorize";
const TOKEN_URL = "https://api.supabase.com/v1/oauth/token";
const MANAGEMENT_API = "https://api.supabase.com/v1";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

export interface ManagementProject {
  ref: string;
  name: string;
  region: string;
  organizationId: string;
}

function clientId(): string {
  const id = process.env.SUPABASE_OAUTH_CLIENT_ID;
  if (!id) throw new Error("SUPABASE_OAUTH_CLIENT_ID não está definida");
  return id;
}

function clientSecret(): string {
  const secret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!secret) throw new Error("SUPABASE_OAUTH_CLIENT_SECRET não está definida");
  return secret;
}

export function redirectUri(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${siteUrl}/api/oauth/supabase/callback`;
}

export function generatePkce(): { state: string; codeVerifier: string; codeChallenge: string } {
  const state = randomBytes(16).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { state, codeVerifier, codeChallenge };
}

export function buildAuthorizeUrl(params: { state: string; codeChallenge: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
}

async function parseTokenResponse(res: Response): Promise<OAuthTokens> {
  if (!res.ok) {
    throw new Error(`Supabase OAuth token endpoint devolveu ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: basicAuthHeader() },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: codeVerifier,
    }),
  });
  return parseTokenResponse(res);
}

/** Os refresh tokens da Supabase rodam a cada uso — quem chamar isto tem de gravar o par novo devolvido, o antigo deixa de servir. */
export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: basicAuthHeader() },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  return parseTokenResponse(res);
}

export async function listManagementProjects(accessToken: string): Promise<ManagementProject[]> {
  const res = await fetch(`${MANAGEMENT_API}/projects`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Management API /projects devolveu ${res.status}`);
  const data = (await res.json()) as Array<{ id: string; name: string; region: string; organization_id: string }>;
  return data.map((p) => ({ ref: p.id, name: p.name, region: p.region, organizationId: p.organization_id }));
}

export interface ManagementApiKey {
  anonKey: string | null;
}

/** api-keys legacy endpoint — devolve a anon/publishable key, nunca a service_role (a Management API não a expõe). */
export async function getProjectAnonKey(accessToken: string, projectRef: string): Promise<string | null> {
  const res = await fetch(`${MANAGEMENT_API}/projects/${projectRef}/api-keys?reveal=true`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ name: string; api_key?: string; type?: string }>;
  const anon = data.find((k) => k.name === "anon" || k.type === "publishable");
  return anon?.api_key ?? null;
}
