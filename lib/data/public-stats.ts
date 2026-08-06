import { createAdminClient } from "@/lib/supabase/admin";

export interface PublicStats {
  projectsAnalyzed: number;
  percentWithCritical: number;
}

// O próprio Basescope, ligado a si mesmo (PROJECT_SPEC § 9 — "corre o
// Basescope contra o próprio Basescope"), não é um projeto de cliente:
// excluído das contagens agregadas para não inflacionar a prova social.
const SELF_SCAN_PROJECT_ID = "9fcb60a9-cf5c-43a9-bbb1-b06b5f5b7c39";

/**
 * Números agregados e anonimizados para a landing — nunca linhas, nunca
 * nomes de projeto. Usa o admin client de propósito: um visitante anónimo
 * não tem sessão nem RLS que lhe dê visibilidade sobre `projects`/`scans`
 * de outras organizações, e é exatamente por isso que esta contagem só
 * pode ser feita do lado do servidor, nunca exposta como query direta.
 */
export async function getPublicStats(): Promise<PublicStats> {
  const admin = createAdminClient();

  const { count: projectsAnalyzed } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .not("last_scan_at", "is", null)
    .neq("id", SELF_SCAN_PROJECT_ID);

  const { data: criticalFindings } = await admin
    .from("findings")
    .select("project_id")
    .eq("severity", "critical")
    .eq("status", "open")
    .neq("project_id", SELF_SCAN_PROJECT_ID);

  const projectsWithCritical = new Set((criticalFindings ?? []).map((f) => f.project_id)).size;
  const total = projectsAnalyzed ?? 0;

  return {
    projectsAnalyzed: total,
    percentWithCritical: total > 0 ? Math.round((projectsWithCritical / total) * 100) : 0,
  };
}

/** Score real do Basescope contra si mesmo — ver 0011/0012/0013_*.sql para a correção dos achados que este scan encontrou. */
export async function getSelfScanScore(): Promise<number | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("current_score")
    .eq("id", SELF_SCAN_PROJECT_ID)
    .maybeSingle();
  return data?.current_score ?? null;
}
