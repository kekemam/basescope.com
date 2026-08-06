import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runScan } from "./run-scan";
import { openProjectScanContext } from "./context";
import { dispatchScanNotifications } from "@/lib/alerts/notify";

export type ScanTrigger = "manual" | "scheduled" | "api" | "webhook";
export type ScanOutcome = "done" | "partial" | "failed";

/**
 * Corpo de execução de um scan cuja linha em `scans` já existe (id
 * `scanId`, status "running"). Quem cria essa linha varia por caminho:
 * triggerScan (app/app/p/[id]/actions.ts) insere-a com o client
 * autenticado, para a RLS (`scans_insert_own_org_authorized`,
 * 0003/0007) aplicar verificação de propriedade + quota do plano; o
 * processador de scan_jobs (app/api/cron/process-scan-jobs) insere-a com o
 * admin client depois de repetir esse mesmo teto de quota manualmente,
 * porque service_role ultrapassa RLS por definição. Esta função só trata
 * do resto — correr as regras, gravar achados, notificar — e por isso usa
 * sempre o admin client a partir daqui.
 */
export async function runScanAndPersist(scanId: string, projectId: string, trigger: ScanTrigger): Promise<ScanOutcome> {
  const admin = createAdminClient();

  const { data: project } = await admin.from("projects").select("name").eq("id", projectId).single();
  const { data: previouslyOpen } = await admin
    .from("findings")
    .select("rule_id, resource_name")
    .eq("project_id", projectId)
    .eq("status", "open");
  const previouslyKnownKeys = new Set((previouslyOpen ?? []).map((f) => `${f.rule_id}::${f.resource_name}`));

  let close: (() => Promise<void>) | null = null;
  try {
    const opened = await openProjectScanContext(projectId);
    close = opened.close;

    const summary = await runScan(opened.ctx);

    if (summary.findings.length > 0) {
      await admin.from("findings").insert(
        summary.findings.map((f) => ({
          scan_id: scanId,
          project_id: projectId,
          rule_id: f.ruleId,
          severity: f.severity,
          resource_type: f.resourceType,
          resource_name: f.resourceName,
          title: f.title,
          description: f.description,
          evidence: f.evidence,
          remediation_sql: f.remediationSql,
          remediation_steps: f.remediationSteps,
          docs_url: f.docsUrl,
        })),
      );
    }

    await admin
      .from("scans")
      .update({
        status: summary.status,
        finished_at: new Date().toISOString(),
        score: summary.score,
        findings_count: summary.findings.length,
        critical_count: summary.counts.critical,
        high_count: summary.counts.high,
        medium_count: summary.counts.medium,
        low_count: summary.counts.low,
      })
      .eq("id", scanId);

    await admin
      .from("projects")
      .update({ last_scan_at: new Date().toISOString(), current_score: summary.score })
      .eq("id", projectId);

    if (project) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const reportUrl = `${siteUrl}/app/p/${projectId}/achados`;
      const newFindings = summary.findings.filter((f) => !previouslyKnownKeys.has(`${f.ruleId}::${f.resourceName}`));

      await dispatchScanNotifications({
        projectId,
        projectName: project.name,
        trigger,
        score: summary.score,
        criticalCount: summary.counts.critical,
        newFindings,
        reportUrl,
      });
    }

    return summary.status;
  } catch (err) {
    await admin
      .from("scans")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "Erro desconhecido" })
      .eq("id", scanId);
    return "failed";
  } finally {
    if (close) await close();
  }
}

/**
 * Caminho usado pelo processador de scan_jobs: cria a linha de `scans` com
 * o admin client, repetindo o teto de plan_scan_limit() (0007) que a RLS
 * de INSERT normalmente impõe aos scans manuais — sem isto, um scan
 * agendado nunca seria travado pelo limite do plano.
 */
export async function executeScheduledScan(projectId: string): Promise<{ scanId: string; status: ScanOutcome }> {
  const admin = createAdminClient();

  const { data: projectOrg } = await admin.from("projects").select("org_id").eq("id", projectId).single();
  const { data: org } = projectOrg
    ? await admin
        .from("organizations")
        .select("plan, scans_used_this_period, period_ends_at")
        .eq("id", projectOrg.org_id)
        .maybeSingle()
    : { data: null };

  if (org) {
    const limit = org.plan === "solo" ? 4 : org.plan === "pro" ? 31 : org.plan === "agency" ? 100 : 1;
    const periodActive = org.period_ends_at && new Date(org.period_ends_at) >= new Date();
    if (periodActive && org.scans_used_this_period >= limit) {
      const { data: refusedScan } = await admin
        .from("scans")
        .insert({
          project_id: projectId,
          status: "failed",
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          trigger: "scheduled",
          error_message: "Limite de scans do plano atingido este período.",
        })
        .select("id")
        .single();
      return { scanId: refusedScan?.id ?? "", status: "failed" };
    }
  }

  const { data: scan, error: scanError } = await admin
    .from("scans")
    .insert({ project_id: projectId, status: "running", started_at: new Date().toISOString(), trigger: "scheduled" })
    .select("id")
    .single();

  if (scanError || !scan) throw new Error(scanError?.message ?? "Não foi possível iniciar o scan agendado.");

  const status = await runScanAndPersist(scan.id, projectId, "scheduled");
  return { scanId: scan.id, status };
}
