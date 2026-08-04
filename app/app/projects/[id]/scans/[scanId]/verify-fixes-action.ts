"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openProjectScanContext } from "@/lib/scan/context";
import { computeScore } from "@/lib/scan/run-scan";
import { ALL_RULES } from "@/lib/rules/supabase";
import type { Severity } from "@/lib/rules/types";

/**
 * Re-corre só as regras dos achados em aberto deste scan, em vez de um
 * scan completo — poupa quota e dá gratificação imediata (PROJECT_SPEC
 * § 5, botão "Verificar correções"). Uma regra que rebentou ao re-correr
 * fica de fora do recálculo (nem marcada fixed nem recontada) — mais vale
 * um achado desatualizado do que apagar um problema real por um erro de rede.
 */
export async function verifyFixes(projectId: string, scanId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

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
