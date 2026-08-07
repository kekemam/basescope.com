import postgres from "postgres";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto/encrypt";
import { postgresByteaToBuffer, bufferToPostgresBytea } from "@/lib/supabase/bytea";
import { SupabaseAnonRestClient } from "@/lib/rules/anon-rest-client";
import { refreshTokens } from "@/lib/oauth/supabase";
import type { ScanContext } from "@/lib/rules/types";

interface StoredCredentials {
  connectionString: string;
  anonKey: string;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthExpiresAt?: number;
}

/**
 * Descriptografa as credenciais guardadas e abre uma ligação Postgres de
 * curta duração (`max: 1`) — usada tanto pelo scan completo
 * (app/app/p/[id]/actions.ts) como por "Verificar correções". O
 * chamador é responsável por invocar `close()` no `finally`.
 *
 * Se o projeto foi ligado por OAuth (app/app/projects/new/oauth-select),
 * as credenciais também trazem o par de tokens — populamos `mgmtToken`
 * para as regras que precisam da Management API (AUTH-001, EF-*, GEN-001).
 * Os refresh tokens da Supabase rodam a cada uso: se o access token estiver
 * perto de expirar, o par novo é gravado de volta antes de o antigo deixar
 * de servir.
 */
export async function openProjectScanContext(
  projectId: string,
): Promise<{ ctx: ScanContext; close: () => Promise<void> }> {
  const admin = createAdminClient();
  const { data: project, error } = await admin
    .from("projects")
    .select("id, project_ref, encrypted_credentials")
    .eq("id", projectId)
    .single();

  if (error || !project?.encrypted_credentials) {
    throw new Error("Sem credenciais guardadas para este projeto.");
  }

  const credentials = JSON.parse(
    decryptCredentials(postgresByteaToBuffer(project.encrypted_credentials as unknown as string)),
  ) as StoredCredentials;

  let mgmtToken: string | null = null;
  if (credentials.oauthAccessToken && credentials.oauthRefreshToken) {
    mgmtToken = credentials.oauthAccessToken;

    const expiresSoon = !credentials.oauthExpiresAt || credentials.oauthExpiresAt < Date.now() + 60_000;
    if (expiresSoon) {
      try {
        const refreshed = await refreshTokens(credentials.oauthRefreshToken);
        mgmtToken = refreshed.accessToken;

        const updated: StoredCredentials = {
          ...credentials,
          oauthAccessToken: refreshed.accessToken,
          oauthRefreshToken: refreshed.refreshToken,
          oauthExpiresAt: refreshed.expiresAt,
        };
        await admin
          .from("projects")
          .update({ encrypted_credentials: bufferToPostgresBytea(encryptCredentials(JSON.stringify(updated))) })
          .eq("id", projectId);
      } catch (err) {
        // Token expirado/revogado no lado da Supabase — as regras que
        // precisam de mgmtToken simplesmente não correm (ver
        // UNVERIFIABLE_RULE_IDS), o resto do scan continua normalmente.
        console.error("[oauth] falha ao renovar token", err instanceof Error ? err.message : err);
        mgmtToken = null;
      }
    }
  }

  const sql = postgres(credentials.connectionString, { max: 1, idle_timeout: 20 });

  const ctx: ScanContext = {
    admin: sql,
    anonRest: new SupabaseAnonRestClient(project.project_ref, credentials.anonKey),
    projectRef: project.project_ref,
    verifiedDomain: null,
    mgmtToken,
  };

  return { ctx, close: () => sql.end({ timeout: 5 }) };
}
