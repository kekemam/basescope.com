"use server";

import { createClient } from "@/lib/supabase/server";
import type { Severity } from "@/lib/rules/types";

export interface FindingSearchResult {
  id: string;
  ruleId: string;
  resourceName: string;
  title: string;
  severity: Severity;
  remediationSql: string | null;
}

/** Carregado sob pedido quando o Cmd+K abre dentro de um projeto — não faz sentido pré-carregar achados de todos os projetos a cada navegação. */
export async function searchProjectFindings(projectId: string): Promise<FindingSearchResult[]> {
  const supabase = await createClient();
  const { data: latestScan } = await supabase
    .from("scans")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestScan) return [];

  const { data } = await supabase
    .from("findings")
    .select("id, rule_id, resource_name, title, severity, remediation_sql")
    .eq("scan_id", latestScan.id)
    .eq("status", "open")
    .limit(200);

  return (data ?? []).map((f) => ({
    id: f.id,
    ruleId: f.rule_id,
    resourceName: f.resource_name,
    title: f.title,
    severity: f.severity,
    remediationSql: f.remediation_sql,
  }));
}
