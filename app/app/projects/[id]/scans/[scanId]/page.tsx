import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportView } from "./report-view";
import { CopySqlButton } from "./copy-sql-button";
import { VerifyFixesButton } from "./verify-fixes-button";
import type { FindingViewModel } from "./finding-row";

export default async function ScanReportPage({
  params,
}: {
  params: Promise<{ id: string; scanId: string }>;
}) {
  const { id, scanId } = await params;
  const supabase = await createClient();

  const { data: scan } = await supabase
    .from("scans")
    .select("id, status, score, findings_count, critical_count, high_count, medium_count, low_count, started_at, finished_at")
    .eq("id", scanId)
    .eq("project_id", id)
    .single();

  if (!scan) notFound();

  const { data: findingsRaw } = await supabase
    .from("findings")
    .select("id, rule_id, severity, resource_name, title, description, evidence, remediation_sql, status")
    .eq("scan_id", scanId)
    .order("severity");

  const findings: FindingViewModel[] = (findingsRaw ?? []).map((f) => ({
    id: f.id,
    ruleId: f.rule_id,
    severity: f.severity,
    resourceName: f.resource_name,
    title: f.title,
    description: f.description,
    evidence: (f.evidence ?? {}) as Record<string, unknown>,
    remediationSql: f.remediation_sql,
    status: f.status,
  }));

  const exposureConfirmed = findings.find(
    (f) => f.ruleId === "ANON-001" && f.severity === "critical" && f.status === "open",
  );

  return (
    <div className="px-6 py-6">
      {exposureConfirmed && (
        <div className="border-l-[3px] border-sev-crit bg-hull px-4 py-3 mb-6 flex items-center justify-between">
          <span className="font-data text-data text-sev-crit uppercase tracking-[0.04em]">
            EXPOSIÇÃO CONFIRMADA · {exposureConfirmed.resourceName}
          </span>
        </div>
      )}

      <div className="flex items-center gap-8 border-b border-rule pb-4 mb-6">
        <div>
          <p className="font-data text-label uppercase tracking-[0.12em] text-graphite">Score</p>
          <p className="font-display text-display-xl text-bone">{scan.score ?? "—"}</p>
        </div>
        <div className="flex gap-6 font-data text-data">
          <span className="text-sev-crit">████ {scan.critical_count}</span>
          <span className="text-sev-high">███░ {scan.high_count}</span>
          <span className="text-sev-med">██░░ {scan.medium_count}</span>
          <span className="text-sev-low">█░░░ {scan.low_count}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <VerifyFixesButton projectId={id} scanId={scanId} />
          <CopySqlButton findings={findings} />
        </div>
      </div>

      <p className="font-data text-body-sm text-graphite mb-4">
        {scan.status} · {scan.findings_count} achados
      </p>

      <ReportView findings={findings} />
    </div>
  );
}
