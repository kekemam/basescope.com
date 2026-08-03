"use server";

import postgres from "postgres";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredentials } from "@/lib/crypto/encrypt";
import { postgresByteaToBuffer } from "@/lib/supabase/bytea";
import { SupabaseAnonRestClient } from "@/lib/rules/anon-rest-client";
import { runScan } from "@/lib/scan/run-scan";
import type { ScanContext } from "@/lib/rules/types";

interface StoredCredentials {
  connectionString: string;
  anonKey: string;
}

/**
 * Dispara um scan síncrono, dentro do próprio request (cabe no maxDuration
 * de 60s da function — ver secção 2 do PROJECT_SPEC). Sem pg_cron nem fila
 * de jobs: isso é Fase 4. A policy `scans_insert_own_org_authorized`
 * (0003_enforce_ownership_verified.sql) já recusa o INSERT se o projeto
 * não tiver `ownership_verified_at`, por isso este código nem precisa de
 * repetir essa verificação — a BD é que é a fonte de verdade.
 */
export async function triggerScan(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .insert({ project_id: projectId, status: "running", started_at: new Date().toISOString(), trigger: "manual" })
    .select("id")
    .single();

  if (scanError || !scan) {
    throw new Error(scanError?.message ?? "Não foi possível iniciar o scan — falta autorização ou verificação.");
  }

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, project_ref, encrypted_credentials")
    .eq("id", projectId)
    .single();

  if (!project?.encrypted_credentials) {
    await admin.from("scans").update({ status: "failed", error_message: "Sem credenciais guardadas." }).eq("id", scan.id);
    redirect(`/app/projects/${projectId}/scans/${scan.id}`);
  }

  const credentials = JSON.parse(
    decryptCredentials(postgresByteaToBuffer(project.encrypted_credentials as unknown as string)),
  ) as StoredCredentials;

  const sql = postgres(credentials.connectionString, { max: 1, idle_timeout: 20 });

  try {
    const ctx: ScanContext = {
      admin: sql,
      anonRest: new SupabaseAnonRestClient(project.project_ref, credentials.anonKey),
      projectRef: project.project_ref,
      verifiedDomain: null, // CLIENT-001/002 exigem OAuth ou um passo explícito extra — fora do Fase 1 síncrono
      mgmtToken: null, // AUTH-001/EF-001 exigem OAuth — ver ScanContext.skippedRuleIds no relatório
    };

    const summary = await runScan(ctx);

    if (summary.findings.length > 0) {
      await admin.from("findings").insert(
        summary.findings.map((f) => ({
          scan_id: scan.id,
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
      .eq("id", scan.id);

    await admin.from("projects").update({ last_scan_at: new Date().toISOString(), current_score: summary.score }).eq("id", projectId);
  } catch (err) {
    await admin
      .from("scans")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "Erro desconhecido" })
      .eq("id", scan.id);
  } finally {
    await sql.end({ timeout: 5 });
  }

  redirect(`/app/projects/${projectId}/scans/${scan.id}`);
}
