import { createClient } from "@/lib/supabase/server";
import type { Severity } from "@/lib/rules/types";
import { ALL_RULES } from "@/lib/rules/supabase";
import { categoryForRuleId, categoryLabel } from "@/lib/rules/category-meta";

export type CategoryColor = "crit" | "high" | "med" | "low" | "subtle";

export interface DashboardFindingRow {
  id: string;
  severity: Severity;
  ruleId: string;
  resourceName: string;
  title: string;
  firstSeenAt: string;
}

export interface DashboardCategory {
  key: string;
  label: string;
  count: number;
  color: CategoryColor;
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  badge: string;
  badgeTone: "ok" | "crit" | "muted";
}

export interface DashboardData {
  project: { id: string; name: string };
  hasScan: boolean;
  score: number;
  counts: Record<Severity, number>;
  totalOpen: number;
  okCount: number;
  totalRules: number;
  exposureConfirmed: boolean;
  lastScan: {
    startedAt: string | null;
    finishedAt: string | null;
    trigger: string;
    status: string;
    durationLabel: string | null;
  } | null;
  recentFindings: DashboardFindingRow[];
  categories: DashboardCategory[];
  activity: DashboardActivityItem[];
}

const TRIGGER_LABEL: Record<string, string> = {
  manual: "manual",
  scheduled: "agendado",
  api: "API",
  webhook: "webhook",
};

function formatDuration(startedAt: string | null, finishedAt: string | null): string | null {
  if (!startedAt || !finishedAt) return null;
  const seconds = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

const CATEGORY_COLORS: CategoryColor[] = ["crit", "high", "med", "low"];

/** Dados da página /app/p/[id] (Dashboard). Tudo lido do último scan concluído — nunca corre regras aqui. */
export async function getDashboardData(projectId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();
  if (projectError || !project) throw projectError ?? new Error("Projeto não encontrado");

  const { data: latestScan } = await supabase
    .from("scans")
    .select("id, status, started_at, finished_at, trigger, critical_count, high_count, medium_count, low_count")
    .eq("project_id", projectId)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestScan) {
    return {
      project,
      hasScan: false,
      score: 0,
      counts: { critical: 0, high: 0, medium: 0, low: 0 },
      totalOpen: 0,
      okCount: 0,
      totalRules: ALL_RULES.length,
      exposureConfirmed: false,
      lastScan: null,
      recentFindings: [],
      categories: [],
      activity: [],
    };
  }

  const counts: Record<Severity, number> = {
    critical: latestScan.critical_count,
    high: latestScan.high_count,
    medium: latestScan.medium_count,
    low: latestScan.low_count,
  };
  const totalOpen = counts.critical + counts.high + counts.medium + counts.low;
  // Fórmula do PROJECT_SPEC § 6.4 (lib/scan/run-scan.ts), recalculada aqui em vez de
  // reler projects.current_score para nunca divergir dos counts que estamos a mostrar.
  const score = Math.max(0, 100 - (counts.critical * 20 + counts.high * 8 + counts.medium * 3 + counts.low * 1));

  const { data: openFindingsRaw } = await supabase
    .from("findings")
    .select("id, rule_id, severity, resource_name, title, first_seen_at")
    .eq("scan_id", latestScan.id)
    .eq("status", "open")
    .order("first_seen_at", { ascending: false });

  const openFindings: DashboardFindingRow[] = (openFindingsRaw ?? []).map((f) => ({
    id: f.id,
    severity: f.severity as Severity,
    ruleId: f.rule_id,
    resourceName: f.resource_name,
    title: f.title,
    firstSeenAt: f.first_seen_at,
  }));

  const rulesTriggered = new Set(openFindings.map((f) => f.ruleId));
  const okCount = Math.max(0, ALL_RULES.length - rulesTriggered.size);

  const exposureConfirmed = openFindings.some((f) => f.ruleId === "ANON-001" && f.severity === "critical");

  const categoryCounts = new Map<string, number>();
  for (const f of openFindings) {
    const key = categoryForRuleId(f.ruleId);
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }
  const sorted = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const categories: DashboardCategory[] = sorted.slice(0, 4).map(([key, count], i) => ({
    key,
    label: categoryLabel(key),
    count,
    color: CATEGORY_COLORS[i]!,
  }));
  const restCount = sorted.slice(4).reduce((sum, [, count]) => sum + count, 0);
  if (restCount > 0) categories.push({ key: "outros", label: "Outros", count: restCount, color: "subtle" });

  const { data: recentScans } = await supabase
    .from("scans")
    .select("id, status, started_at, finished_at")
    .eq("project_id", projectId)
    .in("status", ["done", "partial", "failed"])
    .order("started_at", { ascending: false })
    .limit(3);

  const { data: historyRaw } = await supabase
    .from("finding_history")
    .select("id, status, changed_at, findings!inner(rule_id, resource_name, project_id)")
    .eq("findings.project_id", projectId)
    .order("changed_at", { ascending: false })
    .limit(5);

  const scanEvents: DashboardActivityItem[] = (recentScans ?? [])
    .filter((s) => s.finished_at)
    .map((s) => ({
      id: `scan-${s.id}`,
      title: s.status === "done" ? "Scan concluído" : s.status === "partial" ? "Scan parcial" : "Scan falhou",
      subtitle: formatDuration(s.started_at, s.finished_at) ?? "",
      timestamp: s.finished_at as string,
      badge: s.status === "done" ? "Sucesso" : s.status === "partial" ? "Parcial" : "Falhou",
      badgeTone: s.status === "done" ? "ok" : s.status === "partial" ? "muted" : "crit",
    }));

  const historyEvents: DashboardActivityItem[] = (historyRaw ?? []).map((h) => {
    const finding = Array.isArray(h.findings) ? h.findings[0] : h.findings;
    const resourceLabel = finding ? `${finding.rule_id} em ${finding.resource_name}` : "";
    if (h.status === "fixed") {
      return {
        id: h.id,
        title: "Correção verificada",
        subtitle: resourceLabel,
        timestamp: h.changed_at,
        badge: "Resolvido",
        badgeTone: "ok",
      };
    }
    if (h.status === "ignored") {
      return {
        id: h.id,
        title: "Achado marcado como intencional",
        subtitle: resourceLabel,
        timestamp: h.changed_at,
        badge: "Ignorado",
        badgeTone: "muted",
      };
    }
    return {
      id: h.id,
      title: "Achado reaberto",
      subtitle: resourceLabel,
      timestamp: h.changed_at,
      badge: "Reaberto",
      badgeTone: "crit",
    };
  });

  const activity = [...scanEvents, ...historyEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  return {
    project,
    hasScan: true,
    score,
    counts,
    totalOpen,
    okCount,
    totalRules: ALL_RULES.length,
    exposureConfirmed,
    lastScan: {
      startedAt: latestScan.started_at,
      finishedAt: latestScan.finished_at,
      trigger: TRIGGER_LABEL[latestScan.trigger] ?? latestScan.trigger,
      status: latestScan.status,
      durationLabel: formatDuration(latestScan.started_at, latestScan.finished_at),
    },
    recentFindings: openFindings.slice(0, 5),
    categories,
    activity,
  };
}
