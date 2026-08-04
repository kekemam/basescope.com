"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openProjectScanContext } from "@/lib/scan/context";
import { computeScore } from "@/lib/scan/run-scan";
import { ALL_RULES } from "@/lib/rules/supabase";
import type { Severity } from "@/lib/rules/types";

/** "Isto é público de propósito" / ignorar em massa — nunca marca "fixed" a partir do browser (ver findings_update_ignore_own_org). */
export async function ignoreFindings(findingIds: string[], reason?: string) {
  const supabase = await createClient();
  await supabase
    .from("findings")
    .update({ status: "ignored", ignored_reason: reason ?? null })
    .in("id", findingIds);
}

export async function reopenFindings(findingIds: string[]) {
  const supabase = await createClient();
  await supabase.from("findings").update({ status: "open", ignored_reason: null }).in("id", findingIds);
}

/**
 * "Verificar correções": re-corre só as regras dos achados em aberto do
 * scan mais recente do projeto, em vez de um scan completo. A rota
 * achados/v2 já não tem scanId na URL, por isso descobre-o aqui.
 */
export async function verifyFixes(projectId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { data: latestScan } = await supabase
    .from("scans")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestScan) return;
  const scanId = latestScan.id as string;

  const { data: openFindings } = await supabase
    .from("findings")
    .select("id, rule_id, resource_name")
    .eq("scan_id", scanId)
    .eq("status", "open");

  if (!openFindings || openFindings.length === 0) return;

  const ruleIds = [...new Set(openFindings.map((f) => f.rule_id))];
  const rulesToRun = ALL_RULES.filter((r) => ruleIds.includes(r.id));

  const admin = createAdminClient();
  let close: (() => Promise<void>) | null = null;

  try {
    const opened = await openProjectScanContext(projectId);
    close = opened.close;

    const results = await Promise.allSettled(rulesToRun.map((r) => r.check(opened.ctx)));

    const stillFoundKeys = new Set<string>();
    const erroredRuleIds = new Set<string>();
    results.forEach((result, i) => {
      const ruleId = rulesToRun[i]!.id;
      if (result.status === "fulfilled") {
        for (const f of result.value) stillFoundKeys.add(`${f.ruleId}::${f.resourceName}`);
      } else {
        erroredRuleIds.add(ruleId);
      }
    });

    const toMarkFixed = openFindings.filter(
      (f) => !erroredRuleIds.has(f.rule_id) && !stillFoundKeys.has(`${f.rule_id}::${f.resource_name}`),
    );

    if (toMarkFixed.length > 0) {
      await admin
        .from("findings")
        .update({ status: "fixed", resolved_at: new Date().toISOString() })
        .in(
          "id",
          toMarkFixed.map((f) => f.id),
        );
    }

    const { data: remaining } = await admin.from("findings").select("severity, status").eq("scan_id", scanId);
    const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of remaining ?? []) {
      if (f.status === "open") counts[f.severity as Severity]++;
    }
    const openCount = counts.critical + counts.high + counts.medium + counts.low;
    const score = computeScore(counts);

    await admin
      .from("scans")
      .update({
        score,
        findings_count: openCount,
        critical_count: counts.critical,
        high_count: counts.high,
        medium_count: counts.medium,
        low_count: counts.low,
      })
      .eq("id", scanId);

    await admin.from("projects").update({ current_score: score }).eq("id", projectId);
  } finally {
    if (close) await close();
  }
}

export interface FindingHistoryEntry {
  status: string;
  changed_at: string;
}

export async function getFindingHistory(findingId: string): Promise<FindingHistoryEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("finding_history")
    .select("status, changed_at")
    .eq("finding_id", findingId)
    .order("changed_at", { ascending: false });
  return data ?? [];
}
