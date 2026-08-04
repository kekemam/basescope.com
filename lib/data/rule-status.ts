import { createClient } from "@/lib/supabase/server";
import { ALL_RULES } from "@/lib/rules/supabase";

export type RuleStatus = "passing" | "failing" | "ignored" | "unverified";

export interface RuleStatusRow {
  id: string;
  title: string;
  category: string;
  status: RuleStatus;
}

/**
 * Regras que dependem de OAuth (ctx.mgmtToken) ou de domínio verificado
 * (ctx.verifiedDomain) — nenhum dos dois está disponível no scan síncrono
 * atual (ver app/app/p/[id]/actions.ts), por isso ficam sempre
 * "não verificada" em vez de "a passar", que seria enganador.
 */
const UNVERIFIABLE_RULE_IDS = new Set([
  "AUTH-001",
  "AUTH-006",
  "AUTH-007",
  "EF-001",
  "EF-002",
  "EF-004",
  "GEN-001",
  "CLIENT-001",
  "CLIENT-002",
  "CLIENT-003",
  "CLIENT-005",
]);

export async function listRuleStatusForProject(projectId: string): Promise<RuleStatusRow[]> {
  const supabase = await createClient();

  const { data: latestScan } = await supabase
    .from("scans")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const findingsByRule = new Map<string, string[]>();
  if (latestScan) {
    const { data: findings } = await supabase
      .from("findings")
      .select("rule_id, status")
      .eq("scan_id", latestScan.id);

    for (const f of findings ?? []) {
      const list = findingsByRule.get(f.rule_id) ?? [];
      list.push(f.status);
      findingsByRule.set(f.rule_id, list);
    }
  }

  return ALL_RULES.map((rule) => {
    if (UNVERIFIABLE_RULE_IDS.has(rule.id)) {
      return { id: rule.id, title: rule.title, category: rule.category, status: "unverified" as const };
    }

    const statuses = findingsByRule.get(rule.id) ?? [];
    let status: RuleStatus = "passing";
    if (statuses.includes("open")) status = "failing";
    else if (statuses.includes("ignored")) status = "ignored";

    return { id: rule.id, title: rule.title, category: rule.category, status };
  });
}
