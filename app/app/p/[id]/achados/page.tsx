import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { AchadosView } from "./achados-view";
import type { FindingViewModel } from "./types";

export default async function AchadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: latestScan } = await supabase
    .from("scans")
    .select("id, status, score, findings_count")
    .eq("project_id", id)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestScan) {
    return (
      <EmptyState
        title="Ainda não correu nenhum scan."
        description="Executa o primeiro scan a partir da página do projeto para veres achados aqui."
      />
    );
  }

  const { data: findingsRaw } = await supabase
    .from("findings")
    .select("id, rule_id, severity, resource_name, title, description, evidence, remediation_sql, remediation_steps, status")
    .eq("scan_id", latestScan.id)
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
    remediationSteps: f.remediation_steps ?? [],
    status: f.status,
  }));

  const exposureConfirmed =
    findings.find((f) => f.ruleId === "ANON-001" && f.severity === "critical" && f.status === "open") ?? null;

  // Paywall (PROJECT_SPEC § 6.2): no Free, revela na íntegra só os 3
  // primeiros achados críticos — o resto fica desfocado, mas a contagem
  // total nunca se esconde.
  const { data: org } = await supabase.from("organizations").select("plan").limit(1).maybeSingle();
  const isPaywalled = (org?.plan ?? "free") === "free";

  return (
    <AchadosView projectId={id} findings={findings} exposureConfirmed={exposureConfirmed} isPaywalled={isPaywalled} />
  );
}
