import { createAdminClient } from "@/lib/supabase/admin";

export interface PublicStats {
  projectsAnalyzed: number;
  percentWithCritical: number;
}

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
    .not("last_scan_at", "is", null);

  const { data: criticalFindings } = await admin
    .from("findings")
    .select("project_id")
    .eq("severity", "critical")
    .eq("status", "open");

  const projectsWithCritical = new Set((criticalFindings ?? []).map((f) => f.project_id)).size;
  const total = projectsAnalyzed ?? 0;

  return {
    projectsAnalyzed: total,
    percentWithCritical: total > 0 ? Math.round((projectsWithCritical / total) * 100) : 0,
  };
}
