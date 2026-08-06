import { createClient } from "@/lib/supabase/server";
import type { Severity } from "@/lib/rules/types";

export interface ReportFinding {
  ruleId: string;
  severity: Severity;
  resourceName: string;
  title: string;
  description: string;
  remediationSql: string | null;
}

export interface ReportData {
  projectName: string;
  generatedAt: string;
  score: number;
  counts: Record<Severity, number>;
  scanFinishedAt: string | null;
  findings: ReportFinding[];
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Dados do relatório exportável (PDF/JSON — PROJECT_SPEC § 7). Usa o
 * client normal (não admin) para que a RLS de `findings`/`scans` continue a
 * decidir quem pode ver o quê — o mesmo utilizador que vê /achados.
 */
export async function getReportData(projectId: string): Promise<ReportData | null> {
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("name, current_score").eq("id", projectId).single();
  if (!project) return null;

  const { data: latestScan } = await supabase
    .from("scans")
    .select("id, score, finished_at, critical_count, high_count, medium_count, low_count")
    .eq("project_id", projectId)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestScan) {
    return { projectName: project.name, generatedAt: new Date().toISOString(), score: 0, counts: { critical: 0, high: 0, medium: 0, low: 0 }, scanFinishedAt: null, findings: [] };
  }

  const { data: findingsRaw } = await supabase
    .from("findings")
    .select("rule_id, severity, resource_name, title, description, remediation_sql")
    .eq("scan_id", latestScan.id)
    .eq("status", "open");

  const findings: ReportFinding[] = (findingsRaw ?? [])
    .map((f) => ({
      ruleId: f.rule_id,
      severity: f.severity as Severity,
      resourceName: f.resource_name,
      title: f.title,
      description: f.description,
      remediationSql: f.remediation_sql,
    }))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return {
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    score: latestScan.score,
    counts: {
      critical: latestScan.critical_count,
      high: latestScan.high_count,
      medium: latestScan.medium_count,
      low: latestScan.low_count,
    },
    scanFinishedAt: latestScan.finished_at,
    findings,
  };
}
