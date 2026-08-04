import postgres from "postgres";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredentials } from "@/lib/crypto/encrypt";
import { postgresByteaToBuffer } from "@/lib/supabase/bytea";
import { SupabaseAnonRestClient } from "@/lib/rules/anon-rest-client";
import type { ScanContext } from "@/lib/rules/types";

interface StoredCredentials {
  connectionString: string;
  anonKey: string;
}

/**
 * Descriptografa as credenciais guardadas e abre uma ligação Postgres de
 * curta duração (`max: 1`) — usada tanto pelo scan completo
 * (app/app/projects/[id]/actions.ts) como por "Verificar correções". O
 * chamador é responsável por invocar `close()` no `finally`.
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

  const sql = postgres(credentials.connectionString, { max: 1, idle_timeout: 20 });

  const ctx: ScanContext = {
    admin: sql,
    anonRest: new SupabaseAnonRestClient(project.project_ref, credentials.anonKey),
    projectRef: project.project_ref,
    verifiedDomain: null,
    mgmtToken: null,
  };

  return { ctx, close: () => sql.end({ timeout: 5 }) };
}
